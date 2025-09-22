// server/src/server.js
// Servidor completo com todas as funcionalidades e melhorias implementadas

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const http = require('http');
const socketIo = require('socket.io');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');
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
    console.log('⚠️  Verifique sua string de conexão no arquivo .env');
  });

// ============================
// SCHEMAS
// ============================

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
  confirmationToken: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  role: { type: String, enum: ['admin', 'client'], default: 'client' },
  createdAt: { type: Date, default: Date.now }
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
const User = mongoose.model('User', userSchema);
const Settings = mongoose.model('Settings', settingsSchema);

// ============================
// CONFIGURAÇÃO DE EMAIL (Opcional)
// ============================

let transporter;
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
}

// ============================
// MIDDLEWARE DE AUTENTICAÇÃO
// ============================

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

// ============================
// ROTAS DE AUTENTICAÇÃO
// ============================

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, role = 'client' } = req.body;
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email já cadastrado' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      name,
      email,
      password: hashedPassword,
      role
    });
    
    await user.save();
    
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

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Login simplificado para admin
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

// ============================
// ROTAS DE AGENDAMENTOS
// ============================

// MELHORADO: Buscar horários disponíveis com verificação de ocupação
app.get('/api/appointments/available-slots', async (req, res) => {
  try {
    const { date } = req.query;
    
    if (!date) {
      return res.status(400).json({ error: 'Data é obrigatória' });
    }
    
    console.log(`Buscando slots disponíveis para ${date}`);
    
    // Busca configurações
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings();
      await settings.save();
    }
    
    // Busca agendamentos existentes do dia
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const existingAppointments = await Appointment.find({
      date: { $gte: startOfDay, $lte: endOfDay },
      status: { $nin: ['cancelled', 'no-show'] }
    }).select('startTime endTime status');
    
    console.log(`Encontrados ${existingAppointments.length} agendamentos existentes`);
    
    // Gera todos os slots possíveis do dia
    const slots = [];
    const [startHour, startMin] = (settings.workingHours?.start || '08:00').split(':').map(Number);
    const [endHour, endMin] = (settings.workingHours?.end || '18:00').split(':').map(Number);
    const slotDuration = settings.slotDuration || 60;
    
    let currentHour = startHour;
    let currentMin = startMin;
    
    while (currentHour < endHour || (currentHour === endHour && currentMin < endMin)) {
      const startTime = `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`;
      
      // Calcula o fim do slot
      let endSlotMin = currentMin + slotDuration;
      let endSlotHour = currentHour;
      
      while (endSlotMin >= 60) {
        endSlotHour++;
        endSlotMin -= 60;
      }
      
      const endTime = `${String(endSlotHour).padStart(2, '0')}:${String(endSlotMin).padStart(2, '0')}`;
      
      // Verifica se este slot está ocupado
      const isOccupied = existingAppointments.some(apt => {
        return (
          (startTime >= apt.startTime && startTime < apt.endTime) ||
          (endTime > apt.startTime && endTime <= apt.endTime) ||
          (startTime <= apt.startTime && endTime >= apt.endTime)
        );
      });
      
      // Só adiciona se o slot terminar dentro do horário de trabalho
      if (endSlotHour < endHour || (endSlotHour === endHour && endSlotMin <= endMin)) {
        slots.push({
          start: startTime,
          end: endTime,
          available: !isOccupied,
          status: isOccupied ? 'occupied' : 'available'
        });
      }
      
      // Avança para o próximo slot (intervalos de 30 minutos)
      currentMin += 30;
      if (currentMin >= 60) {
        currentHour++;
        currentMin -= 60;
      }
    }
    
    console.log(`Retornando ${slots.length} slots (${slots.filter(s => s.available).length} disponíveis)`);
    
    res.json({ 
      slots,
      summary: {
        total: slots.length,
        available: slots.filter(s => s.available).length,
        occupied: slots.filter(s => !s.available).length
      }
    });
  } catch (error) {
    console.error('Erro ao buscar slots:', error);
    res.status(500).json({ error: 'Erro ao buscar horários disponíveis' });
  }
});

// MELHORADO: Listar agendamentos com filtro de data específica
app.get('/api/appointments', async (req, res) => {
  try {
    const { date, status, page = 1, limit = 50 } = req.query;
    const filter = {};
    
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      filter.date = { $gte: startOfDay, $lte: endOfDay };
      console.log(`Buscando agendamentos de ${startOfDay} a ${endOfDay}`);
    }
    
    if (status && status !== 'all') {
      filter.status = status;
    }
    
    const appointments = await Appointment.find(filter)
      .sort({ date: 1, startTime: 1 })
      .limit(parseInt(limit))
      .skip((page - 1) * limit);
    
    const total = await Appointment.countDocuments(filter);
    
    console.log(`Retornando ${appointments.length} agendamentos`);
    
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

// MELHORADO: Criar agendamento com verificação de conflito
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
    
    // Verifica se o horário está disponível
    const appointmentDate = new Date(date);
    const startOfDay = new Date(appointmentDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(appointmentDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    const conflictingAppointment = await Appointment.findOne({
      date: { $gte: startOfDay, $lte: endOfDay },
      status: { $nin: ['cancelled', 'no-show'] },
      $or: [
        { startTime: { $lte: startTime }, endTime: { $gt: startTime } },
        { startTime: { $lt: endTime }, endTime: { $gte: endTime } },
        { startTime: { $gte: startTime }, endTime: { $lte: endTime } }
      ]
    });
    
    if (conflictingAppointment) {
      return res.status(409).json({ 
        error: 'Horário não disponível', 
        details: 'Este horário já foi agendado por outro cliente' 
      });
    }
    
    // Cria o agendamento
    const confirmationToken = uuidv4();
    const appointment = new Appointment({
      client,
      date: appointmentDate,
      startTime,
      endTime,
      service,
      notes,
      status: 'scheduled',
      confirmationToken
    });
    
    await appointment.save();
    
    // Envia email de confirmação se configurado
    if (transporter) {
      try {
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: client.email,
          subject: 'Confirmação de Agendamento',
          html: `
            <h2>Agendamento Confirmado!</h2>
            <p>Olá ${client.name},</p>
            <p>Seu agendamento foi realizado com sucesso!</p>
            <ul>
              <li><strong>Data:</strong> ${new Date(date).toLocaleDateString('pt-BR')}</li>
              <li><strong>Horário:</strong> ${startTime} - ${endTime}</li>
              <li><strong>Serviço:</strong> ${service}</li>
            </ul>
            <p>Para confirmar, use o código: ${confirmationToken}</p>
          `
        });
      } catch (emailError) {
        console.error('Erro ao enviar email:', emailError);
      }
    }
    
    // Notifica via WebSocket
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

// MELHORADO: Atualizar status com resposta completa
app.patch('/api/appointments/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    console.log(`Atualizando status do agendamento ${id} para ${status}`);
    
    const validStatuses = ['scheduled', 'confirmed', 'completed', 'cancelled', 'no-show'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ 
        error: 'Status inválido', 
        validStatuses 
      });
    }
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    
    const appointment = await Appointment.findByIdAndUpdate(
      id,
      { 
        status: status, 
        updatedAt: new Date() 
      },
      { 
        new: true,
        runValidators: true
      }
    );
    
    if (!appointment) {
      return res.status(404).json({ error: 'Agendamento não encontrado' });
    }
    
    // Se cancelando, o horário volta a ficar disponível
    if (status === 'cancelled' || status === 'no-show') {
      console.log(`Horário ${appointment.startTime} - ${appointment.endTime} liberado`);
    }
    
    // Notifica via WebSocket
    io.emit('appointment-update', {
      type: 'status-changed',
      appointment: appointment
    });
    
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

// Atualizar agendamento completo
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

// MELHORADO: Cancelar agendamento e liberar horário
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
    
    console.log(`Agendamento cancelado - horário ${appointment.startTime} liberado`);
    
    // Notifica que o horário foi liberado
    io.emit('appointment-update', {
      type: 'cancelled',
      appointmentId: id,
      freedSlot: {
        date: appointment.date,
        startTime: appointment.startTime,
        endTime: appointment.endTime
      }
    });
    
    res.json({ 
      success: true,
      message: 'Agendamento cancelado - horário disponível novamente' 
    });
  } catch (error) {
    console.error('Erro ao cancelar:', error);
    res.status(500).json({ error: 'Erro ao cancelar agendamento' });
  }
});

// ============================
// ROTAS DE ESTATÍSTICAS
// ============================

app.get('/api/stats', async (req, res) => {
  try {
    console.log('Buscando estatísticas...');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    
    // Estatísticas do dia
    const todayAppointments = await Appointment.find({
      date: { $gte: today, $lt: tomorrow }
    });
    
    const todayConfirmed = todayAppointments.filter(apt => apt.status === 'confirmed').length;
    
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
    
    // Total de agendamentos
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

// ============================
// ROTAS DE CONFIGURAÇÕES
// ============================

app.get('/api/settings', async (req, res) => {
  try {
    console.log('Buscando configurações...');
    
    let settings = await Settings.findOne();
    
    if (!settings) {
      console.log('Criando configurações padrão...');
      
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
    
    res.json(settings);
  } catch (error) {
    console.error('Erro ao buscar configurações:', error);
    
    // Retorna configurações padrão em caso de erro
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

app.put('/api/settings', async (req, res) => {
  try {
    console.log('Atualizando configurações:', req.body);
    
    let settings = await Settings.findOne();
    
    if (!settings) {
      settings = new Settings(req.body);
    } else {
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

// ============================
// WEBSOCKET
// ============================

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
// INICIALIZAÇÃO DO SERVIDOR
// ============================

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`🌐 WebSocket pronto para conexões`);
  console.log(`📊 Dashboard: http://localhost:${PORT}/api/stats`);
  console.log(`⚙️  Configurações: http://localhost:${PORT}/api/settings`);
});