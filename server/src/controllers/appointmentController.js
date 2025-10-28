const Appointment = require('../models/Appointment');
const Settings = require('../models/Settings');
const emailService = require('../services/emailService'); // REQ 2.1

// Função auxiliar para validar se um horário está dentro do horário de funcionamento
const isWithinWorkingHours = (time, settings) => {
  const [hours, minutes] = time.split(':').map(Number);
  const timeInMinutes = hours * 60 + minutes;
  
  const [startHours, startMinutes] = settings.workingHours.start.split(':').map(Number);
  const startInMinutes = startHours * 60 + startMinutes;
  
  const [endHours, endMinutes] = settings.workingHours.end.split(':').map(Number);
  const endInMinutes = endHours * 60 - 1; // Ajuste para permitir até o último minuto
  
  return timeInMinutes >= startInMinutes && timeInMinutes <= endInMinutes;
};

// Função auxiliar para calcular horário final (1 hora depois)
const calculateEndTime = (startTime) => {
  const [hours, minutes] = startTime.split(':').map(Number);
  const endHours = hours + 1;
  return `${String(endHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

// Criar novo agendamento
exports.createAppointment = async (req, res) => {
  try {
    // req.user pode vir de um middleware de autenticação opcional
    const { clientName, clientEmail, clientPhone, date, time, service } = req.body;

    // Validar campos obrigatórios
    if (!clientName || !clientEmail || !clientPhone || !date || !time || !service) {
      return res.status(400).json({ 
        success: false, 
        message: 'Todos os campos são obrigatórios' 
      });
    }

    // Buscar configurações
    const settings = await Settings.findOne();
    if (!settings) {
      return res.status(400).json({ 
        success: false, 
        message: 'Configurações do sistema não encontradas' 
      });
    }

    // Validar se o horário está dentro do horário de funcionamento
    if (!isWithinWorkingHours(time, settings)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Horário fora do expediente de funcionamento' 
      });
    }

    // Calcular horário final (sempre 1 hora de duração)
    const endTime = calculateEndTime(time);

    // Verificar se já existe agendamento para este horário (usando método do Model)
    const isAvailable = await Appointment.isTimeSlotAvailable(new Date(date), time, endTime);

    if (!isAvailable) {
      return res.status(400).json({ 
        success: false, 
        message: 'Horário já está ocupado' 
      });
    }

    // Criar o agendamento (MODIFICADO para o schema correto)
    const appointment = new Appointment({
      client: {
        name: clientName,
        email: clientEmail,
        phone: clientPhone,
        userId: req.user ? req.user._id : null // REQ 1.7
      },
      date: new Date(date),
      startTime: time,
      endTime: endTime,
      service,
      status: 'scheduled' // 'Pendente' não está no enum, 'scheduled' é o default
    });

    await appointment.save();

    // REQ 2.1: Enviar email de confirmação
    try {
      await emailService.sendConfirmationEmail(appointment);
    } catch (emailError) {
      console.error('Falha ao enviar email, mas agendamento foi criado:', emailError);
      // Não reverter a transação por falha de e-mail, apenas logar.
    }

    res.status(201).json({ 
      success: true, 
      message: 'Agendamento criado com sucesso',
      appointment 
    });
  } catch (error) {
    console.error('Erro ao criar agendamento:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao criar agendamento',
      error: error.message 
    });
  }
};

// Listar agendamentos com filtros
exports.getAppointments = async (req, res) => {
  try {
    const { date, status } = req.query;
    const filter = {};

    if (date) {
      // Correção para buscar pela data independente do timezone
      const [year, month, day] = date.split('-').map(Number);
      const startOfDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
      const endOfDay = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
      filter.date = { $gte: startOfDay, $lte: endOfDay };
    }

    if (status && status !== 'Todos') {
      filter.status = status;
    } else {
      // Não mostrar cancelados por padrão, a menos que "Todos" seja selecionado
      filter.status = { $ne: 'cancelled' };
    }


    const appointments = await Appointment.find(filter).sort({ date: 1, startTime: 1 });

    res.status(200).json({ 
      success: true, 
      appointments 
    });
  } catch (error) {
    console.error('Erro ao buscar agendamentos:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao buscar agendamentos',
      error: error.message 
    });
  }
};

// Buscar horários disponíveis para uma data específica
exports.getAvailableSlots = async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ 
        success: false, 
        message: 'Data é obrigatória' 
      });
    }

    // Usar a função do Model que já está correta
    const availableSlots = await Appointment.getAvailableSlots(date);
    
    res.status(200).json({ 
      success: true, 
      slots: availableSlots 
    });
    
  } catch (error) {
    console.error('Erro ao buscar horários disponíveis:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao buscar horários disponíveis',
      error: error.message 
    });
  }
};

// Atualizar status do agendamento (Admin)
exports.updateAppointmentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ 
        success: false, 
        message: 'Status é obrigatório' 
      });
    }
    
    // Validar status contra o Enum do Model
    const validStatus = ['scheduled', 'confirmed', 'completed', 'cancelled'];
    if (!validStatus.includes(status)) {
        return res.status(400).json({ success: false, message: 'Status inválido.' });
    }

    const appointment = await Appointment.findById(id);
    
    if (!appointment) {
      return res.status(404).json({ 
        success: false, 
        message: 'Agendamento não encontrado' 
      });
    }

    // REGRA: Não permitir cancelamento de agendamentos concluídos
    if (appointment.status === 'completed' && status === 'cancelled') {
      return res.status(400).json({ 
        success: false, 
        message: 'Não é possível cancelar um agendamento já concluído' 
      });
    }

    appointment.status = status;
    if(status === 'cancelled' && !appointment.deletedAt) {
        appointment.deletedAt = new Date();
    }
    
    await appointment.save();

    res.status(200).json({ 
      success: true, 
      message: 'Status atualizado com sucesso',
      appointment 
    });
  } catch (error) {
    console.error('Erro ao atualizar status:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao atualizar status',
      error: error.message 
    });
  }
};

// Obter estatísticas do dashboard
exports.getDashboardStats = async (req, res) => {
  try {
    const { date } = req.query;
    
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    const [year, month, day] = targetDate.split('-').map(Number);
    const startOfDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    const endOfDay = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
    
    const dateFilter = { date: { $gte: startOfDay, $lte: endOfDay } };

    const totalAppointments = await Appointment.countDocuments(dateFilter);
    const confirmedAppointments = await Appointment.countDocuments({ ...dateFilter, status: 'confirmed' });
    const pendingAppointments = await Appointment.countDocuments({ ...dateFilter, status: 'scheduled' }); // 'Pendente' agora é 'scheduled'
    const completedAppointments = await Appointment.countDocuments({ ...dateFilter, status: 'completed' });
    const cancelledAppointments = await Appointment.countDocuments({ ...dateFilter, status: 'cancelled' });

    res.status(200).json({ 
      success: true, 
      stats: {
        date: targetDate,
        total: totalAppointments,
        confirmed: confirmedAppointments,
        pending: pendingAppointments,
        completed: completedAppointments,
        cancelled: cancelledAppointments
      }
    });
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao buscar estatísticas',
      error: error.message 
    });
  }
};

// Cancelar agendamento (Rota Admin /:id)
exports.cancelAppointment = async (req, res) => {
  try {
    const { id } = req.params;

    const appointment = await Appointment.findById(id);
    
    if (!appointment) {
      return res.status(404).json({ 
        success: false, 
        message: 'Agendamento não encontrado' 
      });
    }

    if (appointment.status === 'completed') {
      return res.status(400).json({ 
        success: false, 
        message: 'Não é possível cancelar um agendamento já concluído' 
      });
    }

    appointment.status = 'cancelled';
    appointment.deletedAt = new Date();
    await appointment.save();

    res.status(200).json({ 
      success: true, 
      message: 'Agendamento cancelado com sucesso',
      appointment 
    });
  } catch (error) {
    console.error('Erro ao cancelar agendamento:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao cancelar agendamento',
      error: error.message 
    });
  }
};

module.exports = exports;