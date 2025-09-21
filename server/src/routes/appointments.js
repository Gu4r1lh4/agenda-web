// server/src/routes/appointments.js
// Rotas para gerenciar agendamentos

const express = require('express');
const router = express.Router();
const Appointment = require('../models/Appointment');
const { v4: uuidv4 } = require('uuid');
const emailService = require('../services/emailService');

// GET - Buscar horários disponíveis
// Esta é uma das funcionalidades mais importantes - mostra slots livres
router.get('/available-slots', async (req, res) => {
  try {
    const { date, duration = 60 } = req.query;
    
    if (!date) {
      return res.status(400).json({ error: 'Data é obrigatória' });
    }
    
    const availableSlots = await Appointment.getAvailableSlots(
      new Date(date),
      parseInt(duration)
    );
    
    res.json({ slots: availableSlots });
  } catch (error) {
    console.error('Erro ao buscar slots:', error);
    res.status(500).json({ error: 'Erro ao buscar horários disponíveis' });
  }
});

// GET - Listar agendamentos
router.get('/', async (req, res) => {
  try {
    const { date, status, email } = req.query;
    const filter = { deletedAt: null };
    
    if (date) {
      // Busca agendamentos de um dia específico
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      filter.date = {
        $gte: startOfDay,
        $lte: endOfDay
      };
    }
    
    if (status) filter.status = status;
    if (email) filter['client.email'] = email;
    
    const appointments = await Appointment.find(filter)
      .sort({ date: 1, startTime: 1 })
      .populate('professional', 'name');
    
    res.json(appointments);
  } catch (error) {
    console.error('Erro ao listar agendamentos:', error);
    res.status(500).json({ error: 'Erro ao buscar agendamentos' });
  }
});

// GET - Buscar um agendamento específico
router.get('/:id', async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate('professional', 'name email');
    
    if (!appointment || appointment.deletedAt) {
      return res.status(404).json({ error: 'Agendamento não encontrado' });
    }
    
    res.json(appointment);
  } catch (error) {
    console.error('Erro ao buscar agendamento:', error);
    res.status(500).json({ error: 'Erro ao buscar agendamento' });
  }
});

// POST - Criar novo agendamento
router.post('/', async (req, res) => {
  try {
    const { client, date, startTime, endTime, service, professional, notes } = req.body;
    
    // Validação básica
    if (!client || !client.name || !client.email || !client.phone) {
      return res.status(400).json({ error: 'Dados do cliente incompletos' });
    }
    
    if (!date || !startTime || !endTime || !service) {
      return res.status(400).json({ error: 'Dados do agendamento incompletos' });
    }
    
    // Verifica se o horário está disponível
    const isAvailable = await Appointment.isTimeSlotAvailable(
      new Date(date),
      startTime,
      endTime
    );
    
    if (!isAvailable) {
      return res.status(409).json({ error: 'Horário não disponível' });
    }
    
    // Cria o agendamento
    const confirmationToken = uuidv4();
    const appointment = new Appointment({
      client,
      date: new Date(date),
      startTime,
      endTime,
      service,
      professional,
      notes,
      confirmationToken,
      status: 'scheduled'
    });
    
    await appointment.save();
    
    // Envia email de confirmação (async, não bloqueia)
    emailService.sendConfirmationEmail(appointment).catch(err => {
      console.error('Erro ao enviar email:', err);
    });
    
    // IMPORTANTE: Notifica todos os clientes conectados via WebSocket
    const io = req.app.get('io');
    io.emit('appointment-update', {
      type: 'created',
      appointment: appointment
    });
    
    res.status(201).json({
      message: 'Agendamento criado com sucesso!',
      appointment,
      confirmationLink: `/confirm/${confirmationToken}`
    });
  } catch (error) {
    console.error('Erro ao criar agendamento:', error);
    res.status(500).json({ error: 'Erro ao criar agendamento' });
  }
});

// PUT - Atualizar agendamento (reagendar)
router.put('/:id', async (req, res) => {
  try {
    const { date, startTime, endTime } = req.body;
    
    const appointment = await Appointment.findById(req.params.id);
    
    if (!appointment || appointment.deletedAt) {
      return res.status(404).json({ error: 'Agendamento não encontrado' });
    }
    
    // Se está mudando o horário, verifica disponibilidade
    if (date || startTime || endTime) {
      const newDate = date ? new Date(date) : appointment.date;
      const newStartTime = startTime || appointment.startTime;
      const newEndTime = endTime || appointment.endTime;
      
      const isAvailable = await Appointment.isTimeSlotAvailable(
        newDate,
        newStartTime,
        newEndTime,
        appointment._id
      );
      
      if (!isAvailable) {
        return res.status(409).json({ error: 'Novo horário não disponível' });
      }
      
      appointment.date = newDate;
      appointment.startTime = newStartTime;
      appointment.endTime = newEndTime;
    }
    
    // Atualiza outros campos se fornecidos
    Object.keys(req.body).forEach(key => {
      if (key !== 'date' && key !== 'startTime' && key !== 'endTime' && req.body[key] !== undefined) {
        appointment[key] = req.body[key];
      }
    });
    
    await appointment.save();
    
    // Notifica via WebSocket
    const io = req.app.get('io');
    io.emit('appointment-update', {
      type: 'rescheduled',
      appointment: appointment
    });
    
    res.json({
      message: 'Agendamento atualizado com sucesso!',
      appointment
    });
  } catch (error) {
    console.error('Erro ao atualizar agendamento:', error);
    res.status(500).json({ error: 'Erro ao atualizar agendamento' });
  }
});

// PUT - Confirmar agendamento
router.put('/:id/confirm', async (req, res) => {
  try {
    const { confirmationToken } = req.body;
    
    const appointment = await Appointment.findOne({
      _id: req.params.id,
      confirmationToken
    });
    
    if (!appointment) {
      return res.status(404).json({ error: 'Agendamento não encontrado ou token inválido' });
    }
    
    appointment.status = 'confirmed';
    appointment.confirmedAt = new Date();
    await appointment.save();
    
    // Notifica via WebSocket
    const io = req.app.get('io');
    io.emit('appointment-update', {
      type: 'confirmed',
      appointmentId: appointment._id
    });
    
    res.json({
      message: 'Agendamento confirmado com sucesso!',
      appointment
    });
  } catch (error) {
    console.error('Erro ao confirmar agendamento:', error);
    res.status(500).json({ error: 'Erro ao confirmar agendamento' });
  }
});

// DELETE - Cancelar agendamento (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    
    if (!appointment || appointment.deletedAt) {
      return res.status(404).json({ error: 'Agendamento não encontrado' });
    }
    
    appointment.status = 'cancelled';
    appointment.deletedAt = new Date();
    await appointment.save();
    
    // Notifica via WebSocket
    const io = req.app.get('io');
    io.emit('appointment-update', {
      type: 'cancelled',
      appointmentId: appointment._id
    });
    
    res.json({
      message: 'Agendamento cancelado com sucesso!'
    });
  } catch (error) {
    console.error('Erro ao cancelar agendamento:', error);
    res.status(500).json({ error: 'Erro ao cancelar agendamento' });
  }
});

module.exports = router;