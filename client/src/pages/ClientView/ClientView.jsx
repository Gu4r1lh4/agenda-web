// client/src/pages/ClientView/ClientView.jsx
// Interface principal para o cliente fazer agendamentos

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import './ClientView.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

const ClientView = () => {
  const [selectedDate, setSelectedDate] = useState('');
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [socket, setSocket] = useState(null);
  
  // Dados do formulário
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    service: '',
    notes: ''
  });
  
  // Modal de confirmação
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [bookingResult, setBookingResult] = useState(null);
  
  // Configurações da empresa (vem do backend)
  const [companySettings, setCompanySettings] = useState({
    name: 'Agenda Inteligente',
    logo: null,
    primaryColor: '#4CAF50',
    services: ['Consulta', 'Retorno', 'Avaliação', 'Procedimento']
  });

  // Conecta ao WebSocket quando o componente monta
  useEffect(() => {
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);
    
    // Escuta atualizações em tempo real
    newSocket.on('appointment-update', (update) => {
      console.log('Atualização em tempo real:', update);
      
      // Se alguém agendou/cancelou, atualiza os slots disponíveis
      if (selectedDate) {
        fetchAvailableSlots(selectedDate);
      }
    });
    
    // Carrega configurações da empresa
    fetchCompanySettings();
    
    return () => {
      newSocket.close();
    };
  }, []);
  
  // Busca as configurações customizadas da empresa
  const fetchCompanySettings = async () => {
    try {
      const response = await axios.get(`${API_URL}/settings`);
      setCompanySettings(response.data);
      
      // Aplica a cor primária customizada
      document.documentElement.style.setProperty('--primary-color', response.data.primaryColor);
    } catch (error) {
      console.error('Erro ao buscar configurações:', error);
    }
  };
  
  // Busca slots disponíveis quando a data muda
  const fetchAvailableSlots = async (date) => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/appointments/available-slots`, {
        params: { date, duration: 60 }
      });
      setAvailableSlots(response.data.slots);
    } catch (error) {
      console.error('Erro ao buscar horários:', error);
      setAvailableSlots([]);
    } finally {
      setLoading(false);
    }
  };
  
  // Quando seleciona uma data
  const handleDateChange = (e) => {
    const date = e.target.value;
    setSelectedDate(date);
    setSelectedSlot(null);
    
    if (date) {
      fetchAvailableSlots(date);
    }
  };
  
  // Quando seleciona um horário
  const handleSlotSelect = (slot) => {
    setSelectedSlot(slot);
  };
  
  // Atualiza os dados do formulário
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Envia o agendamento
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedSlot) {
      alert('Por favor, selecione um horário');
      return;
    }
    
    setLoading(true);
    try {
      const appointmentData = {
        client: {
          name: formData.name,
          email: formData.email,
          phone: formData.phone
        },
        date: selectedDate,
        startTime: selectedSlot.start,
        endTime: selectedSlot.end,
        service: formData.service,
        notes: formData.notes
      };
      
      const response = await axios.post(`${API_URL}/appointments`, appointmentData);
      
      setBookingResult(response.data);
      setShowConfirmation(true);
      
      // Notifica outros usuários via WebSocket
      if (socket) {
        socket.emit('appointment-created', response.data.appointment);
      }
      
      // Limpa o formulário
      setFormData({
        name: '',
        email: '',
        phone: '',
        service: '',
        notes: ''
      });
      setSelectedSlot(null);
      
      // Atualiza slots disponíveis
      fetchAvailableSlots(selectedDate);
    } catch (error) {
      console.error('Erro ao criar agendamento:', error);
      alert(error.response?.data?.error || 'Erro ao criar agendamento. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };
  
  // Define data mínima (hoje)
  const today = new Date().toISOString().split('T')[0];
  
  return (
    <div className="client-view">
      {/* Header com logo e nome da empresa */}
      <header className="header">
        {companySettings.logo && (
          <img src={companySettings.logo} alt="Logo" className="company-logo" />
        )}
        <h1>{companySettings.name}</h1>
        <a href="/login" className="admin-link">Área Admin</a>
      </header>
      
      <div className="booking-container">
        <h2>Agende seu horário</h2>
        
        {/* Seleção de data */}
        <div className="date-selection">
          <label htmlFor="date">Escolha a data:</label>
          <input
            type="date"
            id="date"
            min={today}
            value={selectedDate}
            onChange={handleDateChange}
            className="date-input"
          />
        </div>
        
        {/* Horários disponíveis */}
        {selectedDate && (
          <div className="slots-container">
            <h3>Horários disponíveis</h3>
            {loading ? (
              <div className="loading">Carregando horários...</div>
            ) : availableSlots.length > 0 ? (
              <div className="slots-grid">
                {availableSlots.map((slot, index) => (
                  <button
                    key={index}
                    className={`slot-button ${selectedSlot === slot ? 'selected' : ''}`}
                    onClick={() => handleSlotSelect(slot)}
                  >
                    {slot.start} - {slot.end}
                  </button>
                ))}
              </div>
            ) : (
              <p className="no-slots">Nenhum horário disponível nesta data.</p>
            )}
          </div>
        )}
        
        {/* Formulário de dados */}
        {selectedSlot && (
          <form className="booking-form" onSubmit={handleSubmit}>
            <h3>Seus dados</h3>
            
            <div className="form-group">
              <label htmlFor="name">Nome completo *</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="email">E-mail *</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="phone">Telefone *</label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                placeholder="(00) 00000-0000"
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="service">Serviço *</label>
              <select
                id="service"
                name="service"
                value={formData.service}
                onChange={handleInputChange}
                required
              >
                <option value="">Selecione um serviço</option>
                {companySettings.services.map((service, index) => (
                  <option key={index} value={service}>{service}</option>
                ))}
              </select>
            </div>
            
            <div className="form-group">
              <label htmlFor="notes">Observações (opcional)</label>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                rows="3"
                maxLength="500"
              />
            </div>
            
            <button type="submit" className="submit-button" disabled={loading}>
              {loading ? 'Agendando...' : 'Confirmar Agendamento'}
            </button>
          </form>
        )}
      </div>
      
      {/* Modal de confirmação */}
      {showConfirmation && bookingResult && (
        <div className="modal-overlay" onClick={() => setShowConfirmation(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>✅ Agendamento Realizado!</h2>
            <p>Seu agendamento foi criado com sucesso.</p>
            <div className="booking-details">
              <p><strong>Data:</strong> {new Date(bookingResult.appointment.date).toLocaleDateString('pt-BR')}</p>
              <p><strong>Horário:</strong> {bookingResult.appointment.startTime} - {bookingResult.appointment.endTime}</p>
              <p><strong>Serviço:</strong> {bookingResult.appointment.service}</p>
            </div>
            <p className="confirmation-note">
              Você receberá um e-mail de confirmação em breve.
            </p>
            <button className="close-button" onClick={() => setShowConfirmation(false)}>
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientView;