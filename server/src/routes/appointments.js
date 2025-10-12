// server/src/routes/appointments.js
const express = require('express');
const router = express.Router();
const Appointment = require('../models/Appointment');

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

// POST - Criar novo agendamento
router.post('/', async (req, res) => {
  try {
    const { client, date, startTime, endTime, service } = req.body;
    if (!client || !date || !startTime || !endTime || !service) {
      return res.status(400).json({ error: 'Dados incompletos' });
    }
    const isAvailable = await Appointment.isTimeSlotAvailable(new Date(date), startTime, endTime);
    if (!isAvailable) return res.status(409).json({ error: 'Horário não disponível' });
    
    const appointment = new Appointment({ ...req.body, date: new Date(date) });
    await appointment.save();
    req.app.get('io').emit('appointment-update', { type: 'created', appointment });
    res.status(201).json({ success: true, appointment });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao criar agendamento' });
  }
});

// **ROTA FINAL E CORRIGIDA para cancelamento pelo cliente**
router.post('/cancel-by-client', async (req, res) => {
    try {
        const { date, startTime, email } = req.body;

        if (!date || !startTime || !email) {
            return res.status(400).json({ error: 'Dados insuficientes para o cancelamento.' });
        }
        
        const startOfDay = new Date(date);
        startOfDay.setUTCHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setUTCHours(23, 59, 59, 999);

        const appointment = await Appointment.findOne({
            date: { $gte: startOfDay, $lte: endOfDay },
            startTime: startTime,
            'client.email': { $regex: new RegExp(`^${email.trim()}$`, 'i') },
            status: { $in: ['scheduled', 'confirmed'] }
        });

        if (!appointment) {
            return res.status(404).json({ error: 'Nenhum agendamento ativo encontrado. Verifique os dados e tente novamente.' });
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
        res.status(500).json({ error: 'Erro interno ao tentar cancelar o agendamento.' });
    }
});

// Rota do Admin (sem alterações)
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