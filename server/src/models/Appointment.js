// server/src/models/Appointment.js
const mongoose = require('mongoose');
const Settings = require('./Settings'); 

const appointmentSchema = new mongoose.Schema({
  client: { 
    name: { type: String, required: true }, 
    email: { type: String, required: true }, 
    phone: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null } // CAMPO NOVO
  },
  date: { type: Date, required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  service: { type: String, required: true },
  status: { type: String, enum: ['scheduled', 'confirmed', 'completed', 'cancelled'], default: 'scheduled' },
  deletedAt: { type: Date, default: null }
});

appointmentSchema.statics.isTimeSlotAvailable = async function(date, startTime, endTime) {
  const startOfDay = new Date(date);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setUTCHours(23, 59, 59, 999);
  const existingAppointment = await this.findOne({ date: { $gte: startOfDay, $lte: endOfDay }, status: { $nin: ['cancelled'] }, startTime: { $lt: endTime }, endTime: { $gt: startTime } });
  return !existingAppointment;
};

// MODIFICADO para incluir appointmentId
appointmentSchema.statics.getAvailableSlots = async function(date) {
    let settings = await Settings.findOne();
    let workingHours = { start: '08:00', end: '18:00' };
    if (settings && settings.workingHours) {
        workingHours = settings.workingHours;
    } else {
        console.error("ALERTA: Configurações de horário de trabalho não encontradas. Usando horários padrão.");
    }
    const { start, end } = workingHours;
    const startHour = parseInt(start.split(':')[0], 10);
    const endHour = parseInt(end.split(':')[0], 10);

    const appointmentsOnDate = await this.find({
        date: { $gte: new Date(date).setUTCHours(0, 0, 0, 0), $lt: new Date(date).setUTCHours(23, 59, 59, 999) },
        status: { $in: ['scheduled', 'confirmed'] }
    });

    const slots = [];
    for (let hour = startHour; hour < endHour; hour++) {
        const startTime = `${String(hour).padStart(2, '0')}:00`;
        const endTime = `${String(hour + 1).padStart(2, '0')}:00`;
        
        const matchingApt = appointmentsOnDate.find(apt => apt.startTime === startTime);
        const isOccupied = !!matchingApt;
        
        slots.push({
            start: startTime,
            end: endTime,
            available: !isOccupied,
            appointmentId: matchingApt ? matchingApt._id : null // Envia o ID para o front-end
        });
    }
    return slots;
};

module.exports = mongoose.model('Appointment', appointmentSchema);