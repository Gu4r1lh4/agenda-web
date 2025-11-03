// server/src/routes/appointments.js - VERSÃO CORRIGIDA
const express = require('express');
const router = express.Router();
const Appointment = require('../models/Appointment');
const { protect, attachUser } = require('../middleware/auth');
const emailService = require('../services/emailService');

console.log('✅ Arquivo de rotas de agendamento (appointments.js) foi carregado!'); 

// ============================================
// GET - Listar agendamentos com filtros (SEM AUTENTICAÇÃO)
// ============================================
router.get('/', async (req, res) => {
  try {
    const { date, status } = req.query;
    const filter = {};

    if (date) {
      // Correção para buscar pela data independente do timezone
      const [year, month, day] = date.split('-').map(Number);
      const startOfDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
      const endOfDay = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
      filter.date = { $gte: startOfDay, $lte: endOfDay };
    }

    if (status && status !== 'Todos') {
      filter.status = status;
    } else {
      // Não mostrar cancelados por padrão
      filter.status = { $ne: 'cancelled' };
    }

    const appointments = await Appointment.find(filter).sort({ date: 1, startTime: 1 });

    console.log(`✅ Retornando ${appointments.length} agendamentos para data: ${date || 'todas'}`);

    res.status(200).json({ 
      success: true, 
      appointments 
    });
  } catch (error) {
    console.error('❌ Erro ao buscar agendamentos:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao buscar agendamentos',
      error: error.message 
    });
  }
});

// ============================================
// GET - Buscar horários disponíveis
// ============================================
router.get('/available-slots', async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'Data é obrigatória' });
    const availableSlots = await Appointment.getAvailableSlots(new Date(date));
    res.json({ slots: availableSlots });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar horários' });
  }
});

// ============================================
// POST - Criar novo agendamento (Anexa usuário se logado)
// ============================================
router.post('/', attachUser, async (req, res) => {
  try {
    const { client, date, startTime, endTime, service } = req.body;
    if (!client || !date || !startTime || !endTime || !service) {
      return res.status(400).json({ error: 'Dados incompletos' });
    }
    const isAvailable = await Appointment.isTimeSlotAvailable(new Date(date), startTime, endTime);
    if (!isAvailable) return res.status(409).json({ error: 'Horário não disponível' });
    
    // Adiciona o userId ao objeto do cliente, se o usuário estiver logado
    const clientData = {
        ...client,
        userId: req.user ? req.user._id : null
    };

    const appointment = new Appointment({ ...req.body, date: new Date(date), client: clientData });
    await appointment.save();

    // Envia e-mail de confirmação
    try {
        await emailService.sendConfirmationEmail(appointment);
    } catch (emailError) {
        console.error('Falha ao enviar email, mas agendamento foi criado:', emailError);
    }

    req.app.get('io').emit('appointment-update', { type: 'created', appointment });
    res.status(201).json({ success: true, appointment });
  } catch (error) {
    console.error('Erro ao criar agendamento:', error.message);
    res.status(500).json({ error: 'Erro ao criar agendamento' });
  }
});

// ============================================
// POST - Cancelamento pelo cliente (PROTEGIDA)
// ============================================
router.post('/cancel-by-client', protect, async (req, res) => {
    try {
        const { appointmentId } = req.body;
        const userId = req.user._id;

        if (!appointmentId) {
            return res.status(400).json({ error: 'ID do agendamento é obrigatório.' });
        }

        const appointment = await Appointment.findById(appointmentId);

        if (!appointment) {
            return res.status(404).json({ error: 'Agendamento não encontrado.' });
        }
        
        // Verifica se o usuário logado é o "dono" do agendamento
        if (!appointment.client.userId || !appointment.client.userId.equals(userId)) {
             return res.status(403).json({ error: 'Não será possível cancelar o agendamento pois foi realizado por outro usuário.' });
        }

        if (appointment.status === 'completed') {
             return res.status(400).json({ error: 'Não é possível cancelar um agendamento já concluído.' });
        }
        if (appointment.status === 'cancelled') {
             return res.status(400).json({ error: 'Este agendamento já está cancelado.' });
        }
        
        appointment.status = 'cancelled';
        appointment.deletedAt = new Date();
        await appointment.save();

        req.app.get('io').emit('appointment-update', {
            type: 'cancelled',
            appointmentId: appointment._id
        });

        res.json({ success: true, message: 'Agendamento cancelado com sucesso!' });
    } catch (error) {
        console.error("Erro no cancelamento:", error);
        res.status(500).json({ error: 'Erro interno ao tentar cancelar o agendamento.' });
    }
});

// ============================================
// DELETE - Cancelar agendamento (Admin - PROTEGIDA)
// ============================================
router.delete('/:id', protect, async (req, res) => {
    try {
        const appointment = await Appointment.findById(req.params.id);
        if (!appointment) return res.status(404).json({ error: 'Agendamento não encontrado' });
        
        appointment.status = 'cancelled';
        appointment.deletedAt = new Date();
        await appointment.save();
        
        req.app.get('io').emit('appointment-update', { type: 'cancelled', appointmentId: appointment._id });
        res.json({ success: true, message: 'Agendamento cancelado!' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao cancelar agendamento' });
    }
});

// ============================================
// PATCH - Atualizar status do agendamento (Admin - PROTEGIDA)
// ============================================
router.patch('/:id/status', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ 
        success: false, 
        message: 'Status é obrigatório' 
      });
    }
    
    // Validar status contra o Enum do Model
    const validStatus = ['scheduled', 'confirmed', 'completed', 'cancelled'];
    if (!validStatus.includes(status)) {
        return res.status(400).json({ success: false, message: 'Status inválido.' });
    }

    const appointment = await Appointment.findById(id);
    
    if (!appointment) {
      return res.status(404).json({ 
        success: false, 
        message: 'Agendamento não encontrado' 
      });
    }

    // REGRA: Não permitir cancelamento de agendamentos concluídos
    if (appointment.status === 'completed' && status === 'cancelled') {
      return res.status(400).json({ 
        success: false, 
        message: 'Não é possível cancelar um agendamento já concluído' 
      });
    }

    appointment.status = status;
    if(status === 'cancelled' && !appointment.deletedAt) {
        appointment.deletedAt = new Date();
    }
    
    await appointment.save();

    req.app.get('io').emit('appointment-update', {
      type: 'updated',
      appointment
    });

    res.status(200).json({ 
      success: true, 
      message: 'Status atualizado com sucesso',
      appointment 
    });
  } catch (error) {
    console.error('Erro ao atualizar status:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao atualizar status',
      error: error.message 
    });
  }
});

module.exports = router;