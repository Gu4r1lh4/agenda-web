// server/src/models/Appointment.js
// Modelo de dados para os agendamentos

const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  // Dados do cliente
  client: {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    phone: {
      type: String,
      required: true,
      trim: true
    }
  },
  
  // Dados do agendamento
  date: {
    type: Date,
    required: true,
    index: true // índice para buscar mais rápido
  },
  
  startTime: {
    type: String, // formato "14:00"
    required: true
  },
  
  endTime: {
    type: String, // formato "15:00"
    required: true
  },
  
  service: {
    type: String,
    required: true
  },
  
  professional: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // nem todos os negócios precisam de profissional específico
  },
  
  status: {
    type: String,
    enum: ['scheduled', 'confirmed', 'cancelled', 'completed', 'no-show'],
    default: 'scheduled'
  },
  
  notes: {
    type: String,
    maxlength: 500
  },
  
  // Controle de confirmação
  confirmationToken: {
    type: String,
    unique: true,
    sparse: true // permite valores null sem conflito de unique
  },
  
  confirmedAt: Date,
  
  // Lembretes enviados
  reminders: [{
    type: {
      type: String,
      enum: ['email', 'sms']
    },
    sentAt: Date
  }],
  
  // Para reagendamentos
  rescheduledFrom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment'
  },
  
  // Metadados
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  },
  
  // Campo para soft delete - nunca deletamos de verdade
  deletedAt: Date
});

// Índices compostos para melhorar performance
appointmentSchema.index({ date: 1, startTime: 1 });
appointmentSchema.index({ 'client.email': 1 });
appointmentSchema.index({ status: 1, date: 1 });

// Método para verificar se um horário está disponível
appointmentSchema.statics.isTimeSlotAvailable = async function(date, startTime, endTime, excludeId = null) {
  const query = {
    date: date,
    status: { $nin: ['cancelled', 'no-show'] },
    $or: [
      // Novo agendamento começa durante um existente
      { startTime: { $lte: startTime }, endTime: { $gt: startTime } },
      // Novo agendamento termina durante um existente
      { startTime: { $lt: endTime }, endTime: { $gte: endTime } },
      // Novo agendamento engloba um existente
      { startTime: { $gte: startTime }, endTime: { $lte: endTime } }
    ]
  };
  
  // Se estamos editando, exclui o próprio agendamento da busca
  if (excludeId) {
    query._id = { $ne: excludeId };
  }
  
  const conflictingAppointment = await this.findOne(query);
  return !conflictingAppointment;
};

// Método para buscar horários disponíveis em um dia
appointmentSchema.statics.getAvailableSlots = async function(date, duration = 60) {
  // Busca todos os agendamentos do dia
  const appointments = await this.find({
    date: date,
    status: { $nin: ['cancelled', 'no-show'] },
    deletedAt: null
  }).sort('startTime');
  
  // Define horário de funcionamento (customizável futuramente)
  const workStart = '08:00';
  const workEnd = '18:00';
  const slotDuration = duration; // em minutos
  
  const availableSlots = [];
  let currentTime = workStart;
  
  // Função auxiliar para adicionar minutos a um horário
  const addMinutes = (time, minutes) => {
    const [hours, mins] = time.split(':').map(Number);
    const totalMinutes = hours * 60 + mins + minutes;
    const newHours = Math.floor(totalMinutes / 60);
    const newMins = totalMinutes % 60;
    return `${String(newHours).padStart(2, '0')}:${String(newMins).padStart(2, '0')}`;
  };
  
  // Verifica cada slot possível
  while (currentTime < workEnd) {
    const slotEnd = addMinutes(currentTime, slotDuration);
    
    // Verifica se o slot está livre
    const isConflict = appointments.some(apt => {
      return (currentTime >= apt.startTime && currentTime < apt.endTime) ||
             (slotEnd > apt.startTime && slotEnd <= apt.endTime);
    });
    
    if (!isConflict && slotEnd <= workEnd) {
      availableSlots.push({
        start: currentTime,
        end: slotEnd
      });
    }
    
    currentTime = addMinutes(currentTime, 30); // Avança de 30 em 30 minutos
  }
  
  return availableSlots;
};

// Atualiza o updatedAt automaticamente
appointmentSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Appointment', appointmentSchema);