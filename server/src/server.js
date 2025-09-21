// server/src/server-fixed.js
// Backend com todas as correções aplicadas

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
  }
});

app.use(cors());
app.use(express.json());

// Conecta MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('📦 Conectado ao MongoDB!'))
  .catch(err => console.error('❌ Erro ao conectar no MongoDB:', err.message));

// ====== SCHEMAS ======
const appointmentSchema = new mongoose.Schema({
  date: Date,
  startTime: String,
  endTime: String,
  client: {
    name: String,
    email: String,
    phone: String
  },
  service: String,
  notes: String,
  status: { 
    type: String, 
    default: 'scheduled',
    enum: ['scheduled', 'confirmed', 'completed', 'cancelled', 'no-show']
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const settingsSchema = new mongoose.Schema({
  companyName: { type: String, default: 'Agenda Inteligente' },
  logo: String,
  primaryColor: { type: String, default: '#4CAF50' },
  services: { type: [String], default: ['Consulta', 'Retorno', 'Avaliação', 'Procedimento'] },
  workingHours: {
    start: { type: String, default: '08:00' },
    end: { type: String, default: '18:00' }
  },
  slotDuration: { type: Number, default: 60 }
});

const Appointment = mongoose.model('Appointment', appointmentSchema);
const Settings = mongoose.model('Settings', settingsSchema);

// ====== CORREÇÃO 1: ROTA DE ATUALIZAÇÃO DE STATUS ======
// Suporta tanto PATCH quanto PUT para compatibilidade
app.patch('/api/appointments/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    console.log(`Atualizando status do agendamento ${id} para ${status}`);
    
    // Validação do status
    const validStatuses = ['scheduled', 'confirmed', 'completed', 'cancelled', 'no-show'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ 
        error: 'Status inválido. Use: ' + validStatuses.join(', ') 
      });
    }
    
    // Verifica se o ID é válido
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID de agendamento inválido' });
    }
    
    // Atualiza o agendamento
    const appointment = await Appointment.findByIdAndUpdate(
      id,
      { 
        status: status, 
        updatedAt: new Date() 
      },
      { 
        new: true, // Retorna o documento atualizado
        runValidators: true // Valida os dados
      }
    );
    
    if (!appointment) {
      return res.status(404).json({ error: 'Agendamento não encontrado' });
    }
    
    // Notifica via WebSocket
    io.emit('appointment-update', {
      type: 'status-changed',
      appointment: appointment,
      oldStatus: appointment.status,
      newStatus: status
    });
    
    console.log(`Status atualizado com sucesso: ${appointment._id}`);
    
    res.json({
      success: true,
      message: `Status atualizado para ${status}`,
      appointment: appointment
    });
  } catch (error) {
    console.error('Erro ao atualizar status:', error);
    res.status(500).json({ 
      error: 'Erro ao atualizar status', 
      details: error.message 
    });
  }
});

// Rota alternativa PUT para compatibilidade
app.put('/api/appointments/:id/status', async (req, res) => {
  return app._router.handle(
    Object.assign(req, { method: 'PATCH' }), 
    res
  );
});

// ====== CORREÇÃO 2: DASHBOARD COM DADOS REAIS ======
app.get('/api/stats', async (req, res) => {
  try {
    console.log('Buscando estatísticas do dashboard...');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    
    // Busca todos os agendamentos para debug
    const allAppointments = await Appointment.find({});
    console.log(`Total de agendamentos no banco: ${allAppointments.length}`);
    
    // Estatísticas do dia
    const todayAppointments = await Appointment.find({
      date: { $gte: today, $lt: tomorrow }
    });
    
    const todayConfirmed = await Appointment.countDocuments({
      date: { $gte: today, $lt: tomorrow },
      status: 'confirmed'
    });
    
    // Estatísticas do mês
    const monthTotal = await Appointment.countDocuments({
      date: { $gte: thisMonth, $lt: nextMonth }
    });
    
    const monthCompleted = await Appointment.countDocuments({
      date: { $gte: thisMonth, $lt: nextMonth },
      status: 'completed'
    });
    
    const monthCancelled = await Appointment.countDocuments({
      date: { $gte: thisMonth, $lt: nextMonth },
      status: 'cancelled'
    });
    
    // Serviços mais procurados
    const serviceStats = await Appointment.aggregate([
      { 
        $group: { 
          _id: '$service', 
          count: { $sum: 1 } 
        } 
      },
      { 
        $sort: { count: -1 } 
      },
      { 
        $limit: 5 
      }
    ]);
    
    // Próximos agendamentos
    const upcomingAppointments = await Appointment.find({
      date: { $gte: today },
      status: { $in: ['scheduled', 'confirmed'] }
    })
    .sort({ date: 1, startTime: 1 })
    .limit(5);
    
    const stats = {
      today: {
        total: todayAppointments.length,
        confirmed: todayConfirmed,
        appointments: todayAppointments
      },
      month: {
        total: monthTotal,
        completed: monthCompleted,
        cancelled: monthCancelled
      },
      services: serviceStats,
      upcoming: upcomingAppointments,
      summary: {
        totalAppointments: allAppointments.length,
        pendingConfirmation: await Appointment.countDocuments({ status: 'scheduled' }),
        todayAppointments: todayAppointments.length
      }
    };
    
    console.log('Estatísticas compiladas:', {
      hoje: stats.today.total,
      mes: stats.month.total,
      servicos: stats.services.length
    });
    
    res.json(stats);
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    res.status(500).json({ 
      error: 'Erro ao buscar estatísticas',
      details: error.message 
    });
  }
});

// ====== CORREÇÃO 3: CONFIGURAÇÕES COM VALORES PADRÃO ======
app.get('/api/settings', async (req, res) => {
  try {
    console.log('Buscando configurações...');
    
    let settings = await Settings.findOne();
    
    // Se não existir configuração, cria uma com valores padrão
    if (!settings) {
      console.log('Nenhuma configuração encontrada. Criando padrão...');
      
      const defaultSettings = {
        companyName: 'Agenda Inteligente',
        primaryColor: '#4CAF50',
        services: ['Consulta', 'Retorno', 'Avaliação', 'Procedimento'],
        workingHours: {
          start: '08:00',
          end: '18:00'
        },
        slotDuration: 60,
        logo: null
      };
      
      settings = new Settings(defaultSettings);
      await settings.save();
      console.log('Configurações padrão criadas');
    }
    
    // Garante que workingHours sempre existe
    if (!settings.workingHours) {
      settings.workingHours = {
        start: '08:00',
        end: '18:00'
      };
      await settings.save();
    }
    
    // Garante que services sempre é um array
    if (!settings.services || !Array.isArray(settings.services)) {
      settings.services = ['Consulta', 'Retorno', 'Avaliação'];
      await settings.save();
    }
    
    console.log('Configurações retornadas:', {
      companyName: settings.companyName,
      hasWorkingHours: !!settings.workingHours,
      servicesCount: settings.services.length
    });
    
    res.json(settings);
  } catch (error) {
    console.error('Erro ao buscar configurações:', error);
    
    // Em caso de erro, retorna configurações padrão para não quebrar o frontend
    const fallbackSettings = {
      companyName: 'Agenda Inteligente',
      primaryColor: '#4CAF50',
      services: ['Consulta', 'Retorno', 'Avaliação'],
      workingHours: {
        start: '08:00',
        end: '18:00'
      },
      slotDuration: 60,
      logo: null
    };
    
    res.json(fallbackSettings);
  }
});

// Atualizar configurações
app.put('/api/settings', async (req, res) => {
  try {
    console.log('Atualizando configurações:', req.body);
    
    let settings = await Settings.findOne();
    
    if (!settings) {
      settings = new Settings(req.body);
    } else {
      // Atualiza apenas os campos enviados
      Object.keys(req.body).forEach(key => {
        settings[key] = req.body[key];
      });
    }
    
    // Valida workingHours
    if (settings.workingHours) {
      if (!settings.workingHours.start) settings.workingHours.start = '08:00';
      if (!settings.workingHours.end) settings.workingHours.end = '18:00';
    }
    
    await settings.save();
    
    io.emit('settings-update', settings);
    
    res.json({
      success: true,
      message: 'Configurações atualizadas!',
      settings: settings
    });
  } catch (error) {
    console.error('Erro ao salvar configurações:', error);
    res.status(500).json({ 
      error: 'Erro ao salvar configurações',
      details: error.message 
    });
  }
});

// ====== OUTRAS ROTAS NECESSÁRIAS ======

// Listar agendamentos
app.get('/api/appointments', async (req, res) => {
  try {
    const { date, status, page = 1, limit = 20 } = req.query;
    const filter = {};
    
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      filter.date = { $gte: startOfDay, $lte: endOfDay };
    }
    
    if (status && status !== 'all') {
      filter.status = status;
    }
    
    const appointments = await Appointment.find(filter)
      .sort({ date: 1, startTime: 1 })
      .limit(parseInt(limit))
      .skip((page - 1) * limit);
    
    const total = await Appointment.countDocuments(filter);
    
    res.json({
      appointments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Erro ao listar agendamentos:', error);
    res.status(500).json({ error: 'Erro ao buscar agendamentos' });
  }
});

// Buscar slots disponíveis
app.get('/api/appointments/available-slots', async (req, res) => {
  try {
    const { date } = req.query;
    
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings();
      await settings.save();
    }
    
    const slots = [];
    const [startHour, startMin] = (settings.workingHours?.start || '08:00').split(':').map(Number);
    const [endHour, endMin] = (settings.workingHours?.end || '18:00').split(':').map(Number);
    
    let currentHour = startHour;
    let currentMin = startMin;
    
    while (currentHour < endHour || (currentHour === endHour && currentMin < endMin)) {
      const startTime = `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`;
      
      currentMin += 30;
      if (currentMin >= 60) {
        currentHour++;
        currentMin -= 60;
      }
      
      const endTime = `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`;
      
      if (currentHour < endHour || (currentHour === endHour && currentMin <= endMin)) {
        slots.push({ start: startTime, end: endTime });
      }
    }
    
    res.json({ slots });
  } catch (error) {
    console.error('Erro ao buscar slots:', error);
    res.status(500).json({ error: 'Erro ao buscar horários' });
  }
});

// Criar agendamento
app.post('/api/appointments', async (req, res) => {
  try {
    const appointment = new Appointment(req.body);
    await appointment.save();
    
    io.emit('appointment-update', {
      type: 'created',
      appointment
    });
    
    res.status(201).json({
      success: true,
      message: 'Agendamento criado com sucesso!',
      appointment
    });
  } catch (error) {
    console.error('Erro ao criar agendamento:', error);
    res.status(500).json({ error: 'Erro ao criar agendamento' });
  }
});

// Cancelar agendamento
app.delete('/api/appointments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const appointment = await Appointment.findByIdAndUpdate(
      id,
      { status: 'cancelled', updatedAt: new Date() },
      { new: true }
    );
    
    if (!appointment) {
      return res.status(404).json({ error: 'Agendamento não encontrado' });
    }
    
    io.emit('appointment-update', {
      type: 'cancelled',
      appointmentId: id
    });
    
    res.json({ 
      success: true,
      message: 'Agendamento cancelado com sucesso!' 
    });
  } catch (error) {
    console.error('Erro ao cancelar:', error);
    res.status(500).json({ error: 'Erro ao cancelar agendamento' });
  }
});

// WebSocket
io.on('connection', (socket) => {
  console.log('👤 Cliente conectado:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('👋 Cliente desconectado:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}/api/stats`);
  console.log(`⚙️  Configurações: http://localhost:${PORT}/api/settings`);
});