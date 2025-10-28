// server/src/routes/appointments.js
const express = require('express');
const router = express.Router();
const Appointment = require('../models/Appointment');
const { protect, attachUser } = require('../middleware/auth'); // Importa o middleware
const emailService = require('../services/emailService');

console.log('✅ Arquivo de rotas de agendamento (appointments.js) foi carregado!'); 

// GET - Buscar horários disponíveis
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

// POST - Criar novo agendamento (Anexa o usuário se logado)
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

// ROTA para cancelamento pelo cliente (Protegida)
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

// Rota do Admin (sem alterações, mas deve ser protegida também)
router.delete('/:id', async (req, res) => {
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

module.exports = router;