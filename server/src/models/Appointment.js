// server/src/models/Appointment.js
const mongoose = require('mongoose');
const Settings = require('./Settings'); 

const appointmentSchema = new mongoose.Schema({
  client: { 
    name: { type: String, required: true }, 
    email: { type: String, required: true }, 
    phone: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  },
  date: { type: Date, required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  service: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['scheduled', 'confirmed', 'completed', 'cancelled', 'pending_cancellation'], 
    default: 'scheduled' 
  },
  deletedAt: { type: Date, default: null },
  previousStatus: {
    type: String, 
    enum: ['scheduled', 'confirmed', 'completed', null], 
    default: null 
  },
  pendingCancellationAt: {type: Date, default: null },
  completedAt: { type: Date, default: null }
});

// Verifica disponibilidade ao tentar criar um agendamento
appointmentSchema.statics.isTimeSlotAvailable = async function(date, startTime, endTime) {
  const startOfDay = new Date(date);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setUTCHours(23, 59, 59, 999);
  
  // 1. Verifica bloqueios manuais do Admin
  const settings = await Settings.findOne();
  if (settings && settings.blockedSlots) {
      const dateString = date.toISOString().split('T')[0];
      const blockForDay = settings.blockedSlots.find(b => b.date === dateString);
      
      // Se houver bloqueio para este dia e horário, retorna indisponível
      if (blockForDay && blockForDay.times.includes(startTime)) {
          return false;
      }
  }

  // 2. Verifica conflito com agendamentos existentes
  const existingAppointment = await this.findOne({ 
    date: { $gte: startOfDay, $lte: endOfDay }, 
    status: { $nin: ['cancelled'] }, // Ignora cancelados, mas pending_cancel conta como ocupado
    startTime: { $lt: endTime }, 
    endTime: { $gt: startTime } 
  });
  
  return !existingAppointment;
};

// Gera a lista de slots para o Frontend
appointmentSchema.statics.getAvailableSlots = async function(date) {
    let settings = await Settings.findOne();
    
    // Horário Padrão ou do Banco
    let workingHours = { start: '08:00', end: '18:00' };
    if (settings && settings.workingHours) {
        workingHours = settings.workingHours;
    } else {
        console.error("ALERTA: Configurações de horário não encontradas. Usando padrão.");
    }

    const { start, end } = workingHours;
    const startHour = parseInt(start.split(':')[0], 10);
    const endHour = parseInt(end.split(':')[0], 10);

    // Busca agendamentos existentes no banco (exceto cancelados definitivos)
    const appointmentsOnDate = await this.find({
        date: { $gte: new Date(date).setUTCHours(0, 0, 0, 0), $lt: new Date(date).setUTCHours(23, 59, 59, 999) },
        status: { $in: ['scheduled', 'confirmed', 'pending_cancellation'] }
    });

    // Verifica bloqueios manuais (Imprevistos)
    const dateString = new Date(date).toISOString().split('T')[0];
    let blockedTimes = [];
    if (settings && settings.blockedSlots) {
        const blockDay = settings.blockedSlots.find(b => b.date === dateString);
        if (blockDay) blockedTimes = blockDay.times;
    }

    const slots = [];
    for (let hour = startHour; hour < endHour; hour++) {
        const startTime = `${String(hour).padStart(2, '0')}:00`;
        const endTime = `${String(hour + 1).padStart(2, '0')}:00`;
        
        // Se estiver na lista de bloqueios manuais, o slot NÃO é adicionado (some da tela)
        if (blockedTimes.includes(startTime)) {
            continue; 
        }

        const matchingApt = appointmentsOnDate.find(apt => apt.startTime === startTime);
        const isOccupied = !!matchingApt;
        
        slots.push({
            start: startTime,
            end: endTime,
            available: !isOccupied, // Se tiver agendamento, fica false (cinza/ocupado)
            appointmentId: matchingApt ? matchingApt._id : null
        });
    }
    return slots;
};

appointmentSchema.statics.cleanupPendingCancellations = async function() {
  const fiveSecondsAgo = new Date(Date.now() - 5000);
  
  const result = await this.updateMany(
    {
      status: 'pending_cancellation',
      pendingCancellationAt: { $lte: fiveSecondsAgo }
    },
    {
      $set: { 
        status: 'cancelled',
        deletedAt: new Date()
      },
      $unset: { 
        previousStatus: '',
        pendingCancellationAt: ''
      }
    }
  );
  
  return result;
};

module.exports = mongoose.model('Appointment', appointmentSchema);