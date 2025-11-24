// server/src/models/Settings.js
const mongoose = require('mongoose');

const homePageCardSchema = new mongoose.Schema({
  id: { type: Number, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true }
}, { _id: false });

const settingsSchema = new mongoose.Schema({
  companyName: { 
    type: String, 
    default: 'Agenda Inteligente' 
  },
  logo: { 
    type: String, 
    default: null 
  },
  colorPalette: {
    type: String,
    enum: ['purple', 'green', 'blue', 'orange', 'pink', 'teal'],
    default: 'purple'
  },
  homePageCards: {
    type: [homePageCardSchema],
    default: [
      {
        id: 1,
        title: 'Fácil de Usar',
        description: 'Interface intuitiva tanto para o cliente quanto para o administrador.'
      },
      {
        id: 2,
        title: 'Notificações Automáticas',
        description: 'Envio de lembretes e confirmações por e-mail para reduzir faltas.'
      },
      {
        id: 3,
        title: 'Painel Administrativo',
        description: 'Visão completa dos agendamentos, com estatísticas e gerenciamento fácil.'
      },
      {
        id: 4,
        title: 'Flexível e Customizável',
        description: 'Adapte o sistema com suas cores, serviços e horários de atendimento.'
      }
    ]
  },
  services: { 
    type: [String], 
    default: ['Consulta', 'Retorno', 'Avaliação'] 
  },
  workingHours: {
    start: { type: String, default: '08:00' },
    end: { type: String, default: '18:00' }
  },
  // --- NOVO: Array para bloquear horários específicos ---
  blockedSlots: [{
    date: String, // Formato YYYY-MM-DD
    times: [String] // Array de horários ex: ["09:00", "14:00"]
  }],
  slotDuration: { 
    type: Number, 
    default: 60 
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Settings', settingsSchema);