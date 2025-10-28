// server/src/services/emailService.js
// Serviço para envio de emails automatizados

const nodemailer = require('nodemailer');

// Cria o transportador do email
// Usa as variáveis de ambiente para as credenciais
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS // Use senha de aplicativo, não a senha normal
  }
});

// Template de email bonito em HTML
const getEmailTemplate = (type, data) => {
  const baseStyle = `
    <style>
      body { font-family: 'Arial', sans-serif; line-height: 1.6; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
      .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
      .button { display: inline-block; padding: 12px 30px; background: #4CAF50; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
      .details { background: white; padding: 15px; border-radius: 5px; margin: 20px 0; }
      .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    </style>
  `;
  
  // O 'data' deve ser o objeto 'appointment' completo
  const clientName = data.client ? data.client.name : 'Cliente';
  const clientEmail = data.client ? data.client.email : '';
  const dateFormatted = data.date ? new Date(data.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'N/D';

  switch(type) {
    case 'confirmation':
      return `
        <!DOCTYPE html>
        <html>
        <head>${baseStyle}</head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✅ Agendamento Realizado!</h1>
            </div>
            <div class="content">
              <p>Olá <strong>${clientName}</strong>,</p>
              <p>Seu agendamento foi realizado com sucesso!</p>
              
              <div class="details">
                <h3>Detalhes do Agendamento:</h3>
                <p><strong>📅 Data:</strong> ${dateFormatted}</p>
                <p><strong>🕐 Horário:</strong> ${data.startTime} - ${data.endTime}</p>
                <p><strong>💼 Serviço:</strong> ${data.service}</p>
                ${data.notes ? `<p><strong>📝 Observações:</strong> ${data.notes}</p>` : ''}
              </div>
              
              <p><small>Se você não solicitou este agendamento, por favor, entre em contato.</small></p>
            </div>
            <div class="footer">
              <p>© 2024 Agenda Inteligente - Todos os direitos reservados</p>
            </div>
          </div>
        </body>
        </html>
      `;
      
    case 'reminder':
      return `
        <!DOCTYPE html>
        <html>
        <head>${baseStyle}</head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔔 Lembrete de Agendamento</h1>
            </div>
            <div class="content">
              <p>Olá <strong>${clientName}</strong>,</p>
              <p>Este é um lembrete do seu agendamento amanhã!</p>
              
              <div class="details">
                <h3>Seu Agendamento:</h3>
                <p><strong>📅 Data:</strong> ${dateFormatted}</p>
                <p><strong>🕐 Horário:</strong> ${data.startTime} - ${data.endTime}</p>
                <p><strong>💼 Serviço:</strong> ${data.service}</p>
              </div>
              
              <p>Caso precise reagendar, entre em contato ou acesse nossa plataforma.</p>
            </div>
            <div class="footer">
              <p>© 2024 Agenda Inteligente - Todos os direitos reservados</p>
            </div>
          </div>
        </body>
        </html>
      `;
      
    case 'cancellation':
      return `
        <!DOCTYPE html>
        <html>
        <head>${baseStyle}</head>
        <body>
          <div class="container">
            <div class="header" style="background: linear-gradient(135deg, #f44336 0%, #e91e63 100%);">
              <h1>❌ Agendamento Cancelado</h1>
            </div>
            <div class="content">
              <p>Olá <strong>${clientName}</strong>,</p>
              <p>Seu agendamento foi cancelado conforme solicitado.</p>
              
              <div class="details">
                <h3>Agendamento Cancelado:</h3>
                <p><strong>📅 Data:</strong> ${dateFormatted}</p>
                <p><strong>🕐 Horário:</strong> ${data.startTime} - ${data.endTime}</p>
                <p><strong>💼 Serviço:</strong> ${data.service}</p>
              </div>
              
              <p>Se quiser agendar novamente, acesse nossa plataforma a qualquer momento.</p>
            </div>
            <div class="footer">
              <p>© 2024 Agenda Inteligente - Todos os direitos reservados</p>
            </div>
          </div>
        </body>
        </html>
      `;
      
    default:
      return '';
  }
};

// Envia email de confirmação
const sendConfirmationEmail = async (appointment) => {
  try {
    const mailOptions = {
      from: `"Agenda Inteligente" <${process.env.EMAIL_USER}>`,
      to: appointment.client.email,
      subject: '✅ Confirmação de Agendamento',
      html: getEmailTemplate('confirmation', appointment)
    };
    
    const info = await transporter.sendMail(mailOptions);
    console.log('Email de confirmação enviado:', info.messageId);
    return info;
  } catch (error) {
    console.error('Erro ao enviar email de confirmação:', error);
    throw error;
  }
};

// Envia lembrete (pode ser chamado por um cron job)
const sendReminderEmail = async (appointment) => {
  try {
    const mailOptions = {
      from: `"Agenda Inteligente" <${process.env.EMAIL_USER}>`,
      to: appointment.client.email,
      subject: '🔔 Lembrete: Seu agendamento é amanhã!',
      html: getEmailTemplate('reminder', appointment)
    };
    
    const info = await transporter.sendMail(mailOptions);
    console.log('Email de lembrete enviado:', info.messageId);
    
    // NOTA: O model Appointment não possui o campo 'reminders'.
    // Esta parte do código (original) causará um erro se não for tratada.
    // Comentando para evitar falhas.
    /*
    appointment.reminders.push({
      type: 'email',
      sentAt: new Date()
    });
    await appointment.save();
    */
    
    return info;
  } catch (error) {
    console.error('Erro ao enviar email de lembrete:', error);
    throw error;
  }
};

// Envia notificação de cancelamento
const sendCancellationEmail = async (appointment) => {
  try {
    const mailOptions = {
      from: `"Agenda Inteligente" <${process.env.EMAIL_USER}>`,
      to: appointment.client.email,
      subject: '❌ Agendamento Cancelado',
      html: getEmailTemplate('cancellation', appointment)
    };
    
    const info = await transporter.sendMail(mailOptions);
    console.log('Email de cancelamento enviado:', info.messageId);
    return info;
  } catch (error) {
    console.error('Erro ao enviar email de cancelamento:', error);
    throw error;
  }
};

// Envia lembretes para todos os agendamentos de amanhã
// Isso seria executado por um cron job diariamente
const sendDailyReminders = async () => {
  const Appointment = require('../models/Appointment');
  
  // Pega a data de amanhã
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  
  const dayAfter = new Date(tomorrow);
  dayAfter.setDate(dayAfter.getDate() + 1);
  
  try {
    // Busca agendamentos de amanhã que ainda não receberam lembrete
    // NOTA: O filtro 'reminders.type' foi removido pois o campo não existe no Model.
    const appointments = await Appointment.find({
      date: {
        $gte: tomorrow,
        $lt: dayAfter
      },
      status: { $in: ['scheduled', 'confirmed'] },
    });
    
    console.log(`Enviando ${appointments.length} lembretes para amanhã`);
    
    // Envia lembretes em paralelo
    const promises = appointments.map(apt => sendReminderEmail(apt));
    await Promise.all(promises);
    
    console.log('Todos os lembretes foram enviados!');
  } catch (error) {
    console.error('Erro ao enviar lembretes diários:', error);
  }
};

module.exports = {
  sendConfirmationEmail,
  sendReminderEmail,
  sendCancellationEmail,
  sendDailyReminders
};