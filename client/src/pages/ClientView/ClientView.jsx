// client/src/pages/ClientView/ClientView.jsx
// Interface do cliente com horários ocupados desabilitados

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
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    service: '',
    notes: ''
  });
  
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [bookingResult, setBookingResult] = useState(null);
  const [error, setError] = useState(null);
  
  const [companySettings, setCompanySettings] = useState({
    name: 'Agenda Inteligente',
    logo: null,
    primaryColor: '#4CAF50',
    services: ['Consulta', 'Retorno', 'Avaliação', 'Procedimento']
  });

  useEffect(() => {
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);
    
    // REQUISITO 3: Escuta atualizações em tempo real para recarregar slots
    newSocket.on('appointment-update', (update) => {
      console.log('Atualização em tempo real:', update);
      
      // Se um agendamento foi criado ou cancelado para a data selecionada, atualiza slots
      if (selectedDate) {
        if (update.type === 'created' || update.type === 'cancelled' || update.type === 'status-changed') {
          // Recarrega os slots disponíveis
          fetchAvailableSlots(selectedDate);
        }
      }
    });
    
    fetchCompanySettings();
    
    return () => {
      newSocket.close();
    };
  }, [selectedDate]); // Adiciona selectedDate como dependência
  
  const fetchCompanySettings = async () => {
    try {
      const response = await axios.get(`${API_URL}/settings`);
      setCompanySettings(response.data);
      document.documentElement.style.setProperty('--primary-color', response.data.primaryColor);
    } catch (error) {
      console.error('Erro ao buscar configurações:', error);
    }
  };
  
  // REQUISITO 3: Busca slots com status de disponibilidade
  const fetchAvailableSlots = async (date) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API_URL}/appointments/available-slots`, {
        params: { date }
      });
      
      console.log('Slots recebidos:', response.data);
      
      // A resposta agora inclui o status de cada slot
      setAvailableSlots(response.data.slots || []);
      
      // Remove seleção se o slot selecionado não está mais disponível
      if (selectedSlot && response.data.slots) {
        const stillAvailable = response.data.slots.find(
          s => s.start === selectedSlot.start && s.available
        );
        if (!stillAvailable) {
          setSelectedSlot(null);
        }
      }
    } catch (error) {
      console.error('Erro ao buscar horários:', error);
      setAvailableSlots([]);
      setError('Erro ao carregar horários disponíveis');
    } finally {
      setLoading(false);
    }
  };
  
  const handleDateChange = (e) => {
    const date = e.target.value;
    setSelectedDate(date);
    setSelectedSlot(null);
    setError(null);
    
    if (date) {
      fetchAvailableSlots(date);
    }
  };
  
  // REQUISITO 3: Só permite selecionar slots disponíveis
  const handleSlotSelect = (slot) => {
    if (!slot.available) {
      setError('Este horário não está disponível');
      return;
    }
    setSelectedSlot(slot);
    setError(null);
  };
  
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedSlot) {
      setError('Por favor, selecione um horário');
      return;
    }
    
    // REQUISITO 3: Verifica novamente se o slot ainda está disponível
    if (!selectedSlot.available) {
      setError('Este horário não está mais disponível');
      setSelectedSlot(null);
      fetchAvailableSlots(selectedDate);
      return;
    }
    
    setLoading(true);
    setError(null);
    
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
      
      if (response.data.success) {
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
      }
    } catch (error) {
      console.error('Erro ao criar agendamento:', error);
      if (error.response?.status === 409) {
        setError('Este horário foi reservado por outro cliente. Por favor, escolha outro horário.');
        setSelectedSlot(null);
        fetchAvailableSlots(selectedDate);
      } else {
        setError(error.response?.data?.error || 'Erro ao criar agendamento. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };
  
  const today = new Date().toISOString().split('T')[0];
  
  return (
    <div className="client-view">
      <header className="header">
        {companySettings.logo && (
          <img src={companySettings.logo} alt="Logo" className="company-logo" />
        )}
        <h1>{companySettings.name}</h1>
      </header>
      
      <div className="booking-container">
        <h2>Agende seu horário</h2>
        
        {error && (
          <div style={{
            padding: '12px',
            marginBottom: '20px',
            background: '#ffebee',
            color: '#c62828',
            borderRadius: '5px',
            borderLeft: '4px solid #f44336'
          }}>
            {error}
          </div>
        )}
        
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
        
        {selectedDate && (
          <div className="slots-container">
            <h3>Horários disponíveis</h3>
            {loading ? (
              <div className="loading">Carregando horários...</div>
            ) : availableSlots.length > 0 ? (
              <>
                <div className="slots-legend" style={{ marginBottom: '15px', fontSize: '14px' }}>
                  <span style={{ marginRight: '20px' }}>
                    <span style={{ display: 'inline-block', width: '12px', height: '12px', background: companySettings.primaryColor, marginRight: '5px' }}></span>
                    Disponível
                  </span>
                  <span>
                    <span style={{ display: 'inline-block', width: '12px', height: '12px', background: '#ccc', marginRight: '5px' }}></span>
                    Ocupado
                  </span>
                </div>
                <div className="slots-grid">
                  {availableSlots.map((slot, index) => (
                    <button
                      key={index}
                      className={`slot-button ${
                        selectedSlot?.start === slot.start ? 'selected' : ''
                      } ${!slot.available ? 'occupied' : ''}`}
                      onClick={() => handleSlotSelect(slot)}
                      disabled={!slot.available}
                      style={{
                        cursor: slot.available ? 'pointer' : 'not-allowed',
                        opacity: slot.available ? 1 : 0.5,
                        background: !slot.available ? '#f5f5f5' : 
                                   selectedSlot?.start === slot.start ? companySettings.primaryColor :
                                   'white',
                        color: !slot.available ? '#999' :
                               selectedSlot?.start === slot.start ? 'white' :
                               '#333',
                        borderColor: !slot.available ? '#ddd' : 
                                    selectedSlot?.start === slot.start ? companySettings.primaryColor :
                                    '#ddd',
                        textDecoration: !slot.available ? 'line-through' : 'none'
                      }}
                    >
                      {slot.start} - {slot.end}
                      {!slot.available && <span style={{ display: 'block', fontSize: '10px', marginTop: '2px' }}>Ocupado</span>}
                    </button>
                  ))}
                </div>
                <div style={{ marginTop: '10px', fontSize: '14px', color: '#666' }}>
                  {availableSlots.filter(s => s.available).length} de {availableSlots.length} horários disponíveis
                </div>
              </>
            ) : (
              <p className="no-slots">Nenhum horário disponível nesta data.</p>
            )}
          </div>
        )}
        
        {selectedSlot && selectedSlot.available && (
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