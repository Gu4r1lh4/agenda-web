// server/src/routes/appointments.js - VERSÃO CORRIGIDA E BLINDADA
const express = require('express');
const router = express.Router();
const Appointment = require('../models/Appointment');
const { protect, attachUser } = require('../middleware/auth');
const emailService = require('../services/emailService');

console.log('✅ Arquivo de rotas de agendamento (appointments.js) foi carregado!'); 

// ============================================
// NOVAS ROTAS PARA UNDO E BULK OPERATIONS
// ============================================

// PATCH - Marcar agendamento como pendente de cancelamento
router.patch('/:id/pending-cancel', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id; // ID do usuário logado
    
    const appointment = await Appointment.findById(id);
    
    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Agendamento não encontrado.' });
    }

    // --- VALIDAÇÃO DE SEGURANÇA (IMPEDE CANCELAR DE OUTRO) ---
    const isAdmin = req.user.role === 'admin';
    // Verifica se tem dono e se o dono é quem está pedindo
    const isOwner = appointment.client && appointment.client.userId && appointment.client.userId.toString() === userId.toString();

    // Se não for admin E não for o dono, bloqueia
    if (!isAdmin && !isOwner) {
        return res.status(403).json({ 
            success: false, 
            message: 'Este agendamento foi realizado por outro usuário, portanto não poderá ser cancelado.' 
        });
    }
    // ---------------------------------------------------------

    if (appointment.status === 'completed') {
      return res.status(400).json({ success: false, message: 'Não é possível cancelar um agendamento já concluído.' });
    }

    // Salva o status anterior para poder reverter
    appointment.previousStatus = appointment.status;
    appointment.status = 'pending_cancellation';
    appointment.pendingCancellationAt = new Date();
    
    await appointment.save();
    
    // Emitir evento via socket
    req.app.get('io').emit('appointment-update', { type: 'pending-cancel', appointment });
    
    res.json({ success: true, message: 'Cancelamento iniciado.', appointment });
  } catch (error) {
    console.error('Erro ao marcar cancelamento pendente:', error);
    res.status(500).json({ success: false, message: 'Não foi possível processar o cancelamento.' });
  }
});

// PATCH - Desfazer cancelamento pendente
router.patch('/:id/undo-cancel', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const appointment = await Appointment.findById(id);
    
    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Agendamento não encontrado.' });
    }

    if (appointment.status !== 'pending_cancellation') {
      return res.status(400).json({ success: false, message: 'Este agendamento não está pendente de cancelamento.' });
    }

    // Restaura o status anterior
    appointment.status = appointment.previousStatus || 'scheduled';
    appointment.previousStatus = undefined;
    appointment.pendingCancellationAt = undefined;
    
    await appointment.save();
    
    req.app.get('io').emit('appointment-update', { type: 'undo-cancel', appointment });
    
    res.json({ success: true, message: 'Cancelamento desfeito com sucesso.', appointment });
  } catch (error) {
    console.error('Erro ao desfazer cancelamento:', error);
    res.status(500).json({ success: false, message: 'Não foi possível desfazer o cancelamento.' });
  }
});

// DELETE - Confirmar cancelamento (após timeout)
// MUDANÇA IMPORTANTE: Alterado de PATCH para DELETE para alinhar com o axios.delete do front
router.delete('/:id/confirm-cancel', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const appointment = await Appointment.findById(id);
    
    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Agendamento não encontrado.' });
    }

    // Permite se estiver pendente OU se for admin forçando
    // (Removemos a trava estrita de status para evitar bugs de sincronia, o front já controlou o tempo)
    
    appointment.status = 'cancelled';
    appointment.previousStatus = undefined;
    appointment.pendingCancellationAt = undefined;
    appointment.deletedAt = new Date();
    
    await appointment.save();
    
    req.app.get('io').emit('appointment-update', { type: 'cancelled', appointmentId: appointment._id });
    
    res.json({ success: true, message: 'Agendamento cancelado definitivamente.', appointment });
  } catch (error) {
    console.error('Erro ao confirmar cancelamento:', error);
    res.status(500).json({ success: false, message: 'Não foi possível confirmar o cancelamento.' });
  }
});

// POST - Atualização em massa de agendamentos
router.post('/bulk-update', protect, async (req, res) => {
  try {
    const { appointmentIds, status } = req.body;
    
    if (!appointmentIds || !Array.isArray(appointmentIds) || appointmentIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Por favor, selecione pelo menos um agendamento.' });
    }
    
    const validStatuses = ['completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Status inválido para atualização em massa.' });
    }
    
    const updateData = { status };
    
    if (status === 'completed') {
      updateData.completedAt = new Date();
    } else if (status === 'cancelled') {
      updateData.deletedAt = new Date();
    }
    
    const result = await Appointment.updateMany(
      { 
        _id: { $in: appointmentIds },
        status: { $nin: ['completed', 'cancelled'] } 
      },
      { $set: updateData }
    );
    
    req.app.get('io').emit('appointment-update', { type: 'bulk-update', appointmentIds, status });
    
    res.json({ success: true, message: `${result.modifiedCount} agendamento(s) atualizado(s) com sucesso.`, modifiedCount: result.modifiedCount });
  } catch (error) {
    console.error('Erro na atualização em massa:', error);
    res.status(500).json({ success: false, message: 'Não foi possível atualizar os agendamentos.' });
  }
});

// ============================================
// GET - Listar agendamentos com filtros
// ============================================
router.get('/', async (req, res) => {
  try {
    const { date, status } = req.query;
    const filter = {};

    if (date) {
      const [year, month, day] = date.split('-').map(Number);
      const startOfDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
      const endOfDay = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
      filter.date = { $gte: startOfDay, $lte: endOfDay };
    }

    // --- CORREÇÃO DO FILTRO DE STATUS ---
    if (status === 'all') {
       // Se for 'all', NÃO aplica filtro de status (traz tudo: ativos, pendentes E cancelados)
    } else if (status && status !== 'Todos') {
       filter.status = status;
    } else {
       // Se não vier status nenhum (comportamento padrão), esconde os cancelados para limpar a vista
       filter.status = { $ne: 'cancelled' };
    }

    const appointments = await Appointment.find(filter).sort({ date: 1, startTime: 1 });

    console.log(`✅ Retornando ${appointments.length} agendamentos.`);

    res.status(200).json({ success: true, appointments });
  } catch (error) {
    console.error('❌ Erro ao buscar agendamentos:', error);
    res.status(500).json({ success: false, message: 'Erro ao buscar agendamentos', error: error.message });
  }
});

// ============================================
// GET - Buscar horários disponíveis
// ============================================
router.get('/available-slots', async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'Data é obrigatória' });
    
    // Passa a string direta para evitar problemas de timezone
    const availableSlots = await Appointment.getAvailableSlots(date);
    res.json({ slots: availableSlots });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar horários' });
  }
});

// ============================================
// POST - Criar novo agendamento
// ============================================
router.post('/', attachUser, async (req, res) => {
  try {
    const { client, date, startTime, endTime, service } = req.body;
    if (!client || !date || !startTime || !endTime || !service) {
      return res.status(400).json({ error: 'Dados incompletos' });
    }
    
    // Verifica disponibilidade usando string ou data
    const isAvailable = await Appointment.isTimeSlotAvailable(new Date(date), startTime, endTime);
    if (!isAvailable) return res.status(409).json({ error: 'Horário não disponível' });
    
    const clientData = {
        ...client,
        userId: req.user ? req.user._id : null
    };

    const appointment = new Appointment({ ...req.body, date: new Date(date), client: clientData });
    await appointment.save();

    try {
        await emailService.sendConfirmationEmail(appointment);
    } catch (emailError) {
        console.error('Falha ao enviar email:', emailError);
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

        if (!appointmentId) return res.status(400).json({ error: 'ID obrigatório.' });

        const appointment = await Appointment.findById(appointmentId);

        if (!appointment) return res.status(404).json({ error: 'Agendamento não encontrado.' });
        
        if (!appointment.client.userId || !appointment.client.userId.equals(userId)) {
             return res.status(403).json({ error: 'Não será possível cancelar o agendamento pois foi realizado por outro usuário.' });
        }

        if (appointment.status === 'completed') return res.status(400).json({ error: 'Não é possível cancelar um já concluído.' });
        if (appointment.status === 'cancelled') return res.status(400).json({ error: 'Já cancelado.' });
        
        appointment.status = 'cancelled';
        appointment.deletedAt = new Date();
        await appointment.save();

        req.app.get('io').emit('appointment-update', { type: 'cancelled', appointmentId: appointment._id });
        res.json({ success: true, message: 'Agendamento cancelado com sucesso!' });
    } catch (error) {
        console.error("Erro no cancelamento:", error);
        res.status(500).json({ error: 'Erro interno.' });
    }
});

// ============================================
// DELETE - Cancelar Simples (Admin)
// ============================================
router.delete('/:id', protect, async (req, res) => {
    try {
        const appointment = await Appointment.findById(req.params.id);
        if (!appointment) return res.status(404).json({ error: 'Não encontrado' });
        
        appointment.status = 'cancelled';
        appointment.deletedAt = new Date();
        await appointment.save();
        
        req.app.get('io').emit('appointment-update', { type: 'cancelled', appointmentId: appointment._id });
        res.json({ success: true, message: 'Cancelado!' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao cancelar' });
    }
});

// ============================================
// PATCH - Atualizar status (Admin)
// ============================================
router.patch('/:id/status', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) return res.status(400).json({ success: false, message: 'Status obrigatório' });
    
    // --- CORREÇÃO: Adicionado 'pending_cancellation' para evitar erro 400 no AdminPanel ---
    const validStatus = ['scheduled', 'confirmed', 'completed', 'cancelled', 'pending_cancellation'];
    if (!validStatus.includes(status)) {
        return res.status(400).json({ success: false, message: 'Status inválido.' });
    }

    const appointment = await Appointment.findById(id);
    if (!appointment) return res.status(404).json({ success: false, message: 'Não encontrado' });

    if (appointment.status === 'completed' && (status === 'cancelled' || status === 'pending_cancellation')) {
      return res.status(400).json({ success: false, message: 'Não é possível cancelar um concluído' });
    }

    // Lógica de transição de estado
    if (status === 'pending_cancellation') {
        appointment.previousStatus = appointment.status;
        appointment.pendingCancellationAt = new Date();
    } else if (appointment.status === 'pending_cancellation' && status !== 'cancelled') {
        // Undo logic
        appointment.previousStatus = undefined;
        appointment.pendingCancellationAt = undefined;
    }

    appointment.status = status;
    
    if(status === 'cancelled' && !appointment.deletedAt) appointment.deletedAt = new Date();
    if(status === 'completed') appointment.completedAt = new Date();
    
    await appointment.save();

    req.app.get('io').emit('appointment-update', { type: 'updated', appointment });

    res.status(200).json({ success: true, message: 'Atualizado com sucesso', appointment });
  } catch (error) {
    console.error('Erro ao atualizar status:', error);
    res.status(500).json({ success: false, message: 'Erro ao atualizar status', error: error.message });
  }
});

module.exports = router;