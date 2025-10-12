const Appointment = require('../models/Appointment');
const Settings = require('../models/Settings');

// Função auxiliar para validar se um horário está dentro do horário de funcionamento
const isWithinWorkingHours = (time, settings) => {
  const [hours, minutes] = time.split(':').map(Number);
  const timeInMinutes = hours * 60 + minutes;
  
  const [startHours, startMinutes] = settings.workingHours.start.split(':').map(Number);
  const startInMinutes = startHours * 60 + startMinutes;
  
  const [endHours, endMinutes] = settings.workingHours.end.split(':').map(Number);
  const endInMinutes = endHours * 60 + endMinutes;
  
  return timeInMinutes >= startInMinutes && timeInMinutes < endInMinutes;
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

    // Verificar se já existe agendamento para este horário exato
    const existingAppointment = await Appointment.findOne({
      date,
      time,
      status: { $ne: 'Cancelado' } // Ignora agendamentos cancelados
    });

    if (existingAppointment) {
      return res.status(400).json({ 
        success: false, 
        message: 'Horário já está ocupado' 
      });
    }

    // Criar o agendamento com duração fixa de 1 hora
    const appointment = new Appointment({
      clientName,
      clientEmail,
      clientPhone,
      date,
      time,
      endTime, // Sempre 1 hora depois
      service,
      status: 'Pendente',
      createdAt: new Date()
    });

    await appointment.save();

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
      filter.date = date;
    }

    if (status && status !== 'Todos') {
      filter.status = status;
    }

    const appointments = await Appointment.find(filter).sort({ date: 1, time: 1 });

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

    // Buscar configurações
    const settings = await Settings.findOne();
    if (!settings) {
      return res.status(400).json({ 
        success: false, 
        message: 'Configurações do sistema não encontradas' 
      });
    }

    // Gerar todos os horários possíveis (blocos de 1 hora)
    const availableSlots = [];
    const [startHours, startMinutes] = settings.workingHours.start.split(':').map(Number);
    const [endHours, endMinutes] = settings.workingHours.end.split(':').map(Number);

    for (let hour = startHours; hour < endHours; hour++) {
      const timeSlot = `${String(hour).padStart(2, '0')}:${String(startMinutes).padStart(2, '0')}`;
      availableSlots.push({
        time: timeSlot,
        endTime: calculateEndTime(timeSlot),
        available: true
      });
    }

    // Buscar agendamentos já existentes para esta data
    const bookedAppointments = await Appointment.find({
      date,
      status: { $ne: 'Cancelado' }
    });

    // Marcar horários ocupados
    bookedAppointments.forEach(appointment => {
      const slot = availableSlots.find(s => s.time === appointment.time);
      if (slot) {
        slot.available = false;
        slot.appointmentId = appointment._id;
      }
    });

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

// Atualizar status do agendamento
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

    // Buscar o agendamento
    const appointment = await Appointment.findById(id);
    
    if (!appointment) {
      return res.status(404).json({ 
        success: false, 
        message: 'Agendamento não encontrado' 
      });
    }

    // REGRA: Não permitir cancelamento de agendamentos concluídos
    if (appointment.status === 'Concluído' && status === 'Cancelado') {
      return res.status(400).json({ 
        success: false, 
        message: 'Não é possível cancelar um agendamento já concluído' 
      });
    }

    appointment.status = status;
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
    
    // Se não houver data, usar a data atual
    const targetDate = date || new Date().toISOString().split('T')[0];

    // Total de agendamentos para a data selecionada
    const totalAppointments = await Appointment.countDocuments({
      date: targetDate
    });

    // Agendamentos confirmados para a data selecionada
    const confirmedAppointments = await Appointment.countDocuments({
      date: targetDate,
      status: 'Confirmado'
    });

    // Agendamentos pendentes para a data selecionada
    const pendingAppointments = await Appointment.countDocuments({
      date: targetDate,
      status: 'Pendente'
    });

    // Agendamentos concluídos para a data selecionada
    const completedAppointments = await Appointment.countDocuments({
      date: targetDate,
      status: 'Concluído'
    });

    // Agendamentos cancelados para a data selecionada
    const cancelledAppointments = await Appointment.countDocuments({
      date: targetDate,
      status: 'Cancelado'
    });

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

// Cancelar agendamento
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

    // REGRA: Não permitir cancelamento de agendamentos concluídos
    if (appointment.status === 'Concluído') {
      return res.status(400).json({ 
        success: false, 
        message: 'Não é possível cancelar um agendamento já concluído' 
      });
    }

    appointment.status = 'Cancelado';
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