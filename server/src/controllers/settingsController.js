// server/src/controllers/settingsController.js
const Settings = require('../models/Settings');

// Buscar configurações
exports.getSettings = async (req, res) => {
  try {
    let settings = await Settings.findOne();
    
    if (!settings) {
      // Cria configurações padrão se não existir
      settings = new Settings({
        companyName: 'Agenda Inteligente',
        logo: null,
        colorPalette: 'purple',
        homePageCards: [
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
        ],
        services: ['Consulta', 'Retorno', 'Avaliação'],
        workingHours: {
          start: '08:00',
          end: '18:00'
        },
        blockedSlots: [], // Adicionado valor padrão
        slotDuration: 60
      });
      
      await settings.save();
    }
    
    res.status(200).json(settings);
  } catch (error) {
    console.error('Erro ao buscar configurações:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao buscar configurações',
      error: error.message 
    });
  }
};

// Atualizar configurações
exports.updateSettings = async (req, res) => {
  try {
    const {
      companyName,
      logo,
      colorPalette,
      homePageCards,
      services,
      workingHours,
      slotDuration,
      blockedSlots // <--- ADICIONADO AQUI
    } = req.body;
    
    let settings = await Settings.findOne();
    
    if (!settings) {
      settings = new Settings();
    }
    
    // Atualiza os campos
    if (companyName !== undefined) settings.companyName = companyName;
    if (logo !== undefined) settings.logo = logo;
    if (colorPalette !== undefined) settings.colorPalette = colorPalette;
    if (homePageCards !== undefined) settings.homePageCards = homePageCards;
    if (services !== undefined) settings.services = services;
    if (workingHours !== undefined) settings.workingHours = workingHours;
    if (slotDuration !== undefined) settings.slotDuration = slotDuration;
    
    // --- ADICIONADO AQUI: Salva os bloqueios ---
    if (blockedSlots !== undefined) settings.blockedSlots = blockedSlots;
    
    await settings.save();
    
    res.status(200).json({
      success: true,
      message: 'Configurações atualizadas com sucesso',
      settings
    });
  } catch (error) {
    console.error('Erro ao atualizar configurações:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar configurações',
      error: error.message
    });
  }
};

module.exports = exports;