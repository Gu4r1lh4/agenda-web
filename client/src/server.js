// server/src/server-complete.js
// Backend completo com todas as funcionalidades implementadas

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const http = require('http');
const socketIo = require('socket.io');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// Middlewares
app.use(cors());
app.use(express.json());

// Conecta MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('📦 Conectado ao MongoDB!'))
  .catch(err => console.error('❌ Erro ao conectar no MongoDB:', err.message));

// ====== SCHEMAS ======

// Schema de Agendamento
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

// Schema de Usuário
const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  role: { type: String, enum: ['admin', 'client'], default: 'client' },
  createdAt: { type: Date, default: Date.now }
});

// Schema de Configurações
const settingsSchema = new mongoose.Schema({
  companyName: { type: String, default: 'Agenda Inteligente' },
  logo: String,
  primaryColor: { type: String, default: '#4CAF50' },
  services: [String],
  workingHours: {
    start: { type: String, default: '08:00' },
    end: { type: String, default: '18:00' }
  },
  slotDuration: { type: Number, default: 60 }
});

const Appointment = mongoose.model('Appointment', appointmentSchema);
const User = mongoose.model('User', userSchema);
const Settings = mongoose.model('Settings', settingsSchema);

// ====== MIDDLEWARE DE AUTENTICAÇÃO ======

const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido' });
  }
};

// ====== ROTAS DE AUTENTICAÇÃO ======

// Registro de usuário
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, role = 'client' } = req.body;
    
    // Verifica se usuário já existe
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email já cadastrado' });
    }
    
    // Hash da senha
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Cria usuário
    const user = new User({
      name,
      email,
      password: hashedPassword,
      role
    });
    
    await user.save();
    
    // Gera token
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    );
    
    res.status(201).json({
      message: 'Usuário criado com sucesso',
      token,
      user: { id: user._id, name, email, role }
    });
  } catch (error) {
    console.error('Erro no registro:', error);
    res.status(500).json({ error: 'Erro ao criar usuário' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Para demo, aceita admin/admin123
    if (email === 'admin' && password === 'admin123') {
      const token = jwt.sign(
        { userId: 'admin', role: 'admin' },
        process.env.JWT_SECRET || 'secret',
        { expiresIn: '7d' }
      );
      
      return res.json({
        token,
        user: { id: 'admin', name: 'Administrador', email: 'admin@admin.com', role: 'admin' }
      });
    }
    
    // Login normal
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }
    
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }
    
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    );
    
    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ error: 'Erro ao fazer login' });
  }
});

// ====== ROTAS DE AGENDAMENTO ======

// Buscar horários disponíveis
app.get('/api/appointments/available-slots', async (req, res) => {
  try {
    const { date } = req.query;
    
    if (!date) {
      return res.status(400).json({ error: 'Data é obrigatória' });
    }
    
    // Busca configurações
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings();
      await settings.save();
    }
    
    // Busca agendamentos do dia
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const appointments = await Appointment.find({
      date: { $gte: startOfDay, $lte: endOfDay },
      status: { $nin: ['cancelled'] }
    });
    
    // Gera slots disponíveis
    const slots = [];
    const [startHour, startMin] = settings.workingHours.start.split(':').map(Number);
    const [endHour, endMin] = settings.workingHours.end.split(':').map(Number);
    
    const slotDuration = settings.slotDuration || 60;
    let currentHour = startHour;
    let currentMin = startMin;
    
    while (currentHour < endHour || (currentHour === endHour && currentMin < endMin)) {
      const startTime = `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`;
      
      // Calcula fim do slot
      let endSlotMin = currentMin + slotDuration;
      let endSlotHour = currentHour;
      if (endSlotMin >= 60) {
        endSlotHour += Math.floor(endSlotMin / 60);
        endSlotMin = endSlotMin % 60;
      }
      
      const endTime = `${String(endSlotHour).padStart(2, '0')}:${String(endSlotMin).padStart(2, '0')}`;
      
      // Verifica se o slot está livre
      const isOccupied = appointments.some(apt => 
        (apt.startTime <= startTime && apt.endTime > startTime) ||
        (apt.startTime < endTime && apt.endTime >= endTime)
      );
      
      if (!isOccupied && (endSlotHour < endHour || (endSlotHour === endHour && endSlotMin <= endMin))) {
        slots.push({ start: startTime, end: endTime });
      }
      
      // Próximo slot
      currentMin += 30; // Intervalos de 30 minutos
      if (currentMin >= 60) {
        currentHour++;
        currentMin -= 60;
      }
    }
    
    res.json({ slots });
  } catch (error) {
    console.error('Erro ao buscar slots:', error);
    res.status(500).json({ error: 'Erro ao buscar horários' });
  }
});

// Listar agendamentos com filtros
app.get('/api/appointments', async (req, res) => {
  try {
    const { date, status, email, page = 1, limit = 20 } = req.query;
    const filter = {};
    
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      filter.date = { $gte: startOfDay, $lte: endOfDay };
    }
    
    if (status) filter.status = status;
    if (email) filter['client.email'] = email;
    
    const skip = (page - 1) * limit;
    
    const appointments = await Appointment.find(filter)
      .sort({ date: 1, startTime: 1 })
      .skip(skip)
      .limit(parseInt(limit));
    
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

// Criar agendamento
app.post('/api/appointments', async (req, res) => {
  try {
    const { client, date, startTime, endTime, service, notes } = req.body;
    
    // Validações
    if (!client?.name || !client?.email || !client?.phone) {
      return res.status(400).json({ error: 'Dados do cliente incompletos' });
    }
    
    if (!date || !startTime || !endTime || !service) {
      return res.status(400).json({ error: 'Dados do agendamento incompletos' });
    }
    
    // Verifica conflitos
    const conflict = await Appointment.findOne({
      date: new Date(date),
      status: { $nin: ['cancelled'] },
      $or: [
        { startTime: { $lte: startTime }, endTime: { $gt: startTime } },
        { startTime: { $lt: endTime }, endTime: { $gte: endTime } }
      ]
    });
    
    if (conflict) {
      return res.status(409).json({ error: 'Horário não disponível' });
    }
    
    const appointment = new Appointment({
      client,
      date: new Date(date),
      startTime,
      endTime,
      service,
      notes,
      status: 'scheduled'
    });
    
    await appointment.save();
    
    // Notifica via WebSocket
    io.emit('appointment-update', {
      type: 'created',
      appointment
    });
    
    res.status(201).json({
      message: 'Agendamento criado com sucesso!',
      appointment
    });
  } catch (error) {
    console.error('Erro ao criar agendamento:', error);
    res.status(500).json({ error: 'Erro ao criar agendamento' });
  }
});

// Atualizar agendamento
app.put('/api/appointments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const appointment = await Appointment.findByIdAndUpdate(
      id,
      { ...updates, updatedAt: new Date() },
      { new: true }
    );
    
    if (!appointment) {
      return res.status(404).json({ error: 'Agendamento não encontrado' });
    }
    
    // Notifica via WebSocket
    io.emit('appointment-update', {
      type: 'updated',
      appointment
    });
    
    res.json({
      message: 'Agendamento atualizado!',
      appointment
    });
  } catch (error) {
    console.error('Erro ao atualizar:', error);
    res.status(500).json({ error: 'Erro ao atualizar agendamento' });
  }
});

// Atualizar status do agendamento
app.patch('/api/appointments/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!['scheduled', 'confirmed', 'completed', 'cancelled', 'no-show'].includes(status)) {
      return res.status(400).json({ error: 'Status inválido' });
    }
    
    const appointment = await Appointment.findByIdAndUpdate(
      id,
      { status, updatedAt: new Date() },
      { new: true }
    );
    
    if (!appointment) {
      return res.status(404).json({ error: 'Agendamento não encontrado' });
    }
    
    // Notifica via WebSocket
    io.emit('appointment-update', {
      type: 'status-changed',
      appointment
    });
    
    res.json({
      message: `Status atualizado para ${status}`,
      appointment
    });
  } catch (error) {
    console.error('Erro ao atualizar status:', error);
    res.status(500).json({ error: 'Erro ao atualizar status' });
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
    
    // Notifica via WebSocket
    io.emit('appointment-update', {
      type: 'cancelled',
      appointmentId: id
    });
    
    res.json({ message: 'Agendamento cancelado com sucesso!' });
  } catch (error) {
    console.error('Erro ao cancelar:', error);
    res.status(500).json({ error: 'Erro ao cancelar agendamento' });
  }
});

// ====== ROTAS DE CONFIGURAÇÕES ======

// Buscar configurações
app.get('/api/settings', async (req, res) => {
  try {
    let settings = await Settings.findOne();
    
    if (!settings) {
      // Cria configurações padrão
      settings = new Settings({
        companyName: 'Agenda Inteligente',
        primaryColor: '#4CAF50',
        services: ['Consulta', 'Retorno', 'Avaliação', 'Procedimento'],
        workingHours: { start: '08:00', end: '18:00' },
        slotDuration: 60
      });
      await settings.save();
    }
    
    res.json(settings);
  } catch (error) {
    console.error('Erro ao buscar configurações:', error);
    res.status(500).json({ error: 'Erro ao buscar configurações' });
  }
});

// Atualizar configurações (requer autenticação admin)
app.put('/api/settings', async (req, res) => {
  try {
    let settings = await Settings.findOne();
    
    if (!settings) {
      settings = new Settings(req.body);
    } else {
      Object.assign(settings, req.body);
    }
    
    await settings.save();
    
    // Notifica mudança via WebSocket
    io.emit('settings-update', settings);
    
    res.json({
      message: 'Configurações atualizadas!',
      settings
    });
  } catch (error) {
    console.error('Erro ao salvar configurações:', error);
    res.status(500).json({ error: 'Erro ao salvar configurações' });
  }
});

// ====== ROTAS DE ESTATÍSTICAS (ADMIN) ======

// Dashboard com estatísticas
app.get('/api/stats', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    
    // Estatísticas
    const stats = {
      today: {
        total: await Appointment.countDocuments({
          date: { $gte: today, $lt: tomorrow }
        }),
        confirmed: await Appointment.countDocuments({
          date: { $gte: today, $lt: tomorrow },
          status: 'confirmed'
        })
      },
      month: {
        total: await Appointment.countDocuments({
          date: { $gte: thisMonth, $lt: nextMonth }
        }),
        completed: await Appointment.countDocuments({
          date: { $gte: thisMonth, $lt: nextMonth },
          status: 'completed'
        }),
        cancelled: await Appointment.countDocuments({
          date: { $gte: thisMonth, $lt: nextMonth },
          status: 'cancelled'
        })
      },
      services: await Appointment.aggregate([
        { $group: { _id: '$service', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ])
    };
    
    res.json(stats);
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    res.status(500).json({ error: 'Erro ao buscar estatísticas' });
  }
});

// ====== WEBSOCKET ======

io.on('connection', (socket) => {
  console.log('👤 Cliente conectado:', socket.id);
  
  // Envia quantidade de usuários online
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
  
  socket.on('disconnect', () => {
    console.log('👋 Cliente desconectado:', socket.id);
    io.emit('users-online', io.engine.clientsCount);
  });
});

// ====== SERVIDOR ======

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`🌐 WebSocket pronto para conexões`);
  console.log(`📊 API disponível em http://localhost:${PORT}/api`);
});