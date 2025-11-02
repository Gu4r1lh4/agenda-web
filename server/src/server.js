// server/src/server.js - VERSÃO CORRIGIDA
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

// Middlewares
app.use(cors());
app.use(express.json());

// Conecta MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/agenda-inteligente')
  .then(() => console.log('📦 Conectado ao MongoDB!'))
  .catch(err => {
    console.error('❌ Erro ao conectar no MongoDB:', err.message);
  });

// Importa os Models
const Appointment = require('./models/Appointment');
const User = require('./models/User');
const Settings = require('./models/Settings');

// ============================
// IMPORTA AS ROTAS (CORRETO!)
// ============================
const authRoutes = require('./routes/auth');
const appointmentRoutes = require('./routes/appointments');
const settingsRoutes = require('./routes/settings');

// Disponibiliza o io para as rotas
app.set('io', io);

// ============================
// USA AS ROTAS
// ============================
app.use('/api/auth', authRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/settings', settingsRoutes);

// ============================
// ROTA DE ESTATÍSTICAS
// ============================
app.get('/api/stats', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    
    const todayAppointments = await Appointment.find({
      date: { $gte: today, $lt: tomorrow }
    });
    
    const todayConfirmed = todayAppointments.filter(apt => apt.status === 'confirmed').length;
    
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
    
    const serviceStats = await Appointment.aggregate([
      { $group: { _id: '$service', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);
    
    const upcomingAppointments = await Appointment.find({
      date: { $gte: today },
      status: { $in: ['scheduled', 'confirmed'] }
    })
    .sort({ date: 1, startTime: 1 })
    .limit(5);
    
    const allAppointments = await Appointment.find({});
    const pendingConfirmation = await Appointment.countDocuments({ status: 'scheduled' });
    
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
        pendingConfirmation: pendingConfirmation,
        todayAppointments: todayAppointments.length
      }
    };
    
    res.json(stats);
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    res.status(500).json({ 
      error: 'Erro ao buscar estatísticas',
      details: error.message 
    });
  }
});

// ============================
// WEBSOCKET
// ============================
io.on('connection', (socket) => {
  console.log('👤 Cliente conectado:', socket.id);
  io.emit('users-online', io.engine.clientsCount);
  
  socket.on('appointment-created', (data) => {
    socket.broadcast.emit('appointment-update', {
      type: 'created',
      appointment: data
    });
  });
  
  socket.on('appointment-cancelled', (id) => {
    socket.broadcast.emit('appointment-update', {
      type: 'cancelled',
      appointmentId: id
    });
  });
  
  socket.on('appointment-updated', (data) => {
    socket.broadcast.emit('appointment-update', {
      type: 'updated',
      ...data
    });
  });
  
  socket.on('disconnect', () => {
    console.log('👋 Cliente desconectado:', socket.id);
    io.emit('users-online', io.engine.clientsCount);
  });
});

// ============================
// INICIALIZAÇÃO
// ============================
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`🌐 WebSocket pronto`);
  console.log(`✅ Rotas de autenticação carregadas em /api/auth`);
  console.log(`✅ Rotas de agendamentos carregadas em /api/appointments`);
});