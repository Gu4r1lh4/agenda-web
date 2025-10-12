// client/src/pages/ClientView/ClientView.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import './ClientView.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const CancelModal = ({ slot, onCancel, onClose, setError }) => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);

    const handleCancel = async () => {
        if (!email) {
            setError("Por favor, digite o e-mail usado no agendamento.");
            return;
        }
        setLoading(true);
        setError(null);
        try {
            await onCancel(slot.start, email); // Passa o horário e o e-mail
            onClose();
        } catch (err) {
            // A mensagem de erro já foi setada pela função `onCancel`.
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h2>Cancelar Agendamento</h2>
                <p>Para cancelar o horário das <strong>{slot.start}</strong>, confirme o e-mail utilizado no agendamento.</p>
                <div className="form-group">
                    <label htmlFor="cancel_email">E-mail de confirmação</label>
                    <input type="email" id="cancel_email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="modal-actions">
                    <button onClick={handleCancel} className="btn-confirm-cancel" disabled={loading}>
                        {loading ? 'Cancelando...' : 'Confirmar Cancelamento'}
                    </button>
                    <button onClick={onClose} className="btn-back">Voltar</button>
                </div>
            </div>
        </div>
    );
};

const ClientView = () => {
    const [selectedDate, setSelectedDate] = useState('');
    const [availableSlots, setAvailableSlots] = useState([]);
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [formData, setFormData] = useState({ name: '', email: '', phone: '', service: '' });
    const [slotToCancel, setSlotToCancel] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [bookingResult, setBookingResult] = useState(null);
    const [error, setError] = useState(null);
    const [message, setMessage] = useState(null);
    const [companySettings, setCompanySettings] = useState({ name: 'Agenda Inteligente', services: [] });

    useEffect(() => {
        const socket = io(process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000');
        socket.on('appointment-update', () => {
            if (selectedDate) fetchAvailableSlots(selectedDate);
        });
        fetchCompanySettings();
        return () => socket.close();
    }, [selectedDate]);
    
    const fetchCompanySettings = async () => {
        try {
            const response = await axios.get(`${API_URL}/settings`);
            setCompanySettings(response.data);
            document.documentElement.style.setProperty('--primary-color', response.data.primaryColor || '#4CAF50');
        } catch (err) { console.error('Erro ao buscar configurações:', err); }
    };
    
    const fetchAvailableSlots = async (date) => {
        if (!date) { setAvailableSlots([]); return; }
        setLoading(true);
        setError(null);
        setMessage(null);
        try {
            const response = await axios.get(`${API_URL}/appointments/available-slots`, { params: { date } });
            const slotsFromApi = response.data.slots || [];
            
            // **MANUTENÇÃO DA CORREÇÃO CRÍTICA: GARANTE 1H EM 1H**
            const filteredSlots = slotsFromApi.filter(slot => slot.start.endsWith(':00'));
            setAvailableSlots(filteredSlots);

        } catch (err) {
            setError('Erro ao carregar horários disponíveis');
        } finally {
            setLoading(false);
        }
    };
    
    const handleSlotClick = (slot) => {
        if (slot.available) {
            setSelectedSlot(slot);
        } else {
            // Se o slot está ocupado, abre o modal de cancelamento
            setSlotToCancel(slot);
        }
    };

    const handleCancelAppointment = async (startTime, email) => {
        setError(null);
        setMessage(null);
        try {
            const response = await axios.post(`${API_URL}/appointments/cancel-by-client`, { 
                date: selectedDate,
                startTime: startTime,
                email: email
            });
            if (response.data.success) {
                setMessage('Agendamento cancelado com sucesso!');
                fetchAvailableSlots(selectedDate);
            }
        } catch (err) {
            const errorMessage = err.response?.data?.error || 'Não foi possível cancelar.';
            setError(errorMessage);
            throw new Error(errorMessage);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedSlot) return;
        setLoading(true);
        setError(null);
        try {
            const appointmentData = {
                client: { name: formData.name, email: formData.email, phone: formData.phone },
                date: selectedDate, startTime: selectedSlot.start, endTime: selectedSlot.end, service: formData.service,
            };
            const response = await axios.post(`${API_URL}/appointments`, appointmentData);
            if (response.data.success || response.data.appointment) {
                setBookingResult(response.data);
                setShowConfirmation(true);
                setFormData({ name: '', email: '', phone: '', service: '' });
                setSelectedSlot(null);
                fetchAvailableSlots(selectedDate);
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Erro ao criar agendamento.');
        } finally { setLoading(false); }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleDateChange = (e) => {
        const date = e.target.value;
        setSelectedDate(date);
        setSelectedSlot(null);
        fetchAvailableSlots(date);
    };

    const today = new Date().toISOString().split('T')[0];
    
    return (
        <div className="client-view">
            {slotToCancel && (
                <CancelModal
                    slot={slotToCancel}
                    onClose={() => { setSlotToCancel(null); setError(null); }}
                    onCancel={handleCancelAppointment}
                    setError={setError}
                />
            )}
            
            <header className="header"><h1>{companySettings.name}</h1></header>
            
            <div className="booking-container">
                <h2>Agende seu Horário</h2>
                {message && <div className="alert-success">{message}</div>}
                {error && <div className="alert-error">{error}</div>}
                <div className="setup-section-simple">
                    <label htmlFor="date">Escolha a Data</label>
                    <input type="date" id="date" min={today} value={selectedDate} onChange={handleDateChange} />
                </div>
              
                {selectedDate && (
                <div className="slots-container">
                    <h3>
                        Horários para {new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR')}
                        <small>Clique em um horário ocupado (cinza) para cancelar.</small>
                    </h3>
                    {loading ? <div className="loading">Carregando...</div> : (
                    availableSlots.length > 0 ? (
                        <div className="slots-grid">
                            {availableSlots.map((slot, index) => (
                                <button
                                    key={index}
                                    className={`slot-button ${!slot.available ? 'occupied' : ''}`}
                                    onClick={() => handleSlotClick(slot)}
                                >
                                    {slot.start}
                                </button>
                            ))}
                        </div>
                    ) : <p className="no-slots">Nenhum horário disponível nesta data.</p>
                    )}
                </div>
                )}
              
                {selectedSlot && (
                    <form className="booking-form" onSubmit={handleSubmit}>
                        <h3>Preencha seus dados para agendar às {selectedSlot.start}</h3>
                        <div className="form-group">
                            <label htmlFor="name">Nome completo *</label>
                            <input type="text" id="name" name="name" value={formData.name} onChange={handleInputChange} required />
                        </div>
                        <div className="form-group">
                            <label htmlFor="email">E-mail *</label>
                            <input type="email" id="email" name="email" value={formData.email} onChange={handleInputChange} required />
                        </div>
                        <div className="form-group">
                            <label htmlFor="phone">Telefone *</label>
                            <input type="tel" id="phone" name="phone" value={formData.phone} onChange={handleInputChange} required />
                        </div>
                        <div className="form-group">
                            <label htmlFor="service">Serviço *</label>
                            <select id="service" name="service" value={formData.service} onChange={handleInputChange} required >
                                <option value="">Selecione um serviço</option>
                                {companySettings.services.map((s, i) => <option key={i} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div className="modal-actions">
                            <button type="submit" className="submit-button" disabled={loading}>
                                {loading ? 'Agendando...' : 'Confirmar'}
                            </button>
                            <button type="button" className="btn-back" onClick={() => setSelectedSlot(null)}>
                                Voltar
                            </button>
                        </div>
                    </form>
                )}
            </div>
            
            {showConfirmation && bookingResult && (
                <div className="modal-overlay" onClick={() => setShowConfirmation(false)}>
                    <div className="modal-content">
                        <h2>✅ Agendamento Realizado!</h2>
                        <div className="booking-details">
                            <p><strong>Data:</strong> {new Date(bookingResult.appointment.date).toLocaleDateString('pt-BR')}</p>
                            <p><strong>Horário:</strong> {bookingResult.appointment.startTime} - {bookingResult.appointment.endTime}</p>
                        </div>
                        <p>Você receberá um e-mail de confirmação em breve.</p>
                        <button className="close-button" onClick={() => setShowConfirmation(false)}>Fechar</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClientView;