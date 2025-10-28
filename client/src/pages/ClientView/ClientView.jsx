// client/src/pages/ClientView/ClientView.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; // Importado para logout
import axios from 'axios';
import io from 'socket.io-client';
import './ClientView.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// REQ 3.0: Modal de Login do Cliente
const ClientLoginModal = ({ onLoginSuccess, onContinueGuest }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await axios.post(`${API_URL}/auth/login`, {
                email,
                password
            });
            if (response.data.success && response.data.token) {
                // Salva token e usuário
                localStorage.setItem('token', response.data.token);
                localStorage.setItem('user', JSON.stringify(response.data.user));
                onLoginSuccess(response.data.user); // Chama a função do componente pai
            } else {
                setError(response.data.message || 'Erro ao fazer login.');
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Erro de conexão.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content login-modal-content">
                <h2>Login do Cliente</h2>
                <p>Acesse para ver seus agendamentos ou continue como convidado.</p>
                <form onSubmit={handleLogin}>
                    <div className="form-group">
                        <label htmlFor="login_email">E-mail</label>
                        <input
                            type="email"
                            id="login_email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="login_pass">Senha</label>
                        <input
                            type="password"
                            id="login_pass"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    {error && <div className="alert-error" style={{marginBottom: '1rem'}}>{error}</div>}
                    <div className="modal-actions">
                        <button type="submit" className="submit-button" disabled={loading}>
                            {loading ? 'Entrando...' : 'Entrar'}
                        </button>
                        <button type="button" className="btn-back" onClick={onContinueGuest}>
                            Continuar sem login
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// Modal de Cancelamento (Sem alterações da etapa anterior)
const CancelModal = ({ slot, onCancel, onClose, setError }) => {
    const [loading, setLoading] = useState(false);
    const handleCancel = async () => {
        setLoading(true);
        setError(null);
        try {
            await onCancel(slot.appointmentId); 
            onClose();
        } catch (err) { } finally {
            setLoading(false);
        }
    };
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h2>Cancelar Agendamento</h2>
                <p>Tem certeza que deseja cancelar o agendamento das <strong>{slot.start}</strong>?</p>
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
    
    const [isAuthenticated, setIsAuthenticated] = useState(false); // Estado de autenticação
    const [showLoginModal, setShowLoginModal] = useState(false); // Estado do modal
    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem('token');
        const userStr = localStorage.getItem('user');
        
        if (token && userStr) {
            try {
                const user = JSON.parse(userStr);
                // Valida se é cliente
                if (user.role === 'client') {
                    setIsAuthenticated(true);
                    setFormData(prev => ({ ...prev, name: user.name || '', email: user.email || '' }));
                } else {
                    // Se for admin, ou token inválido, limpa
                    localStorage.clear();
                    setShowLoginModal(true); // Pede login
                }
            } catch (e) {
                localStorage.clear();
                setShowLoginModal(true); // Pede login
            }
        } else {
            // Se não há token, mostra o modal de login
            setShowLoginModal(true);
        }

        const socket = io(process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000');
        socket.on('appointment-update', () => {
            if (selectedDate) fetchAvailableSlots(selectedDate);
        });
        fetchCompanySettings();
        
        return () => socket.close();
    }, [selectedDate]); // Dependência removida para executar só 1 vez
    
    // Função chamada pelo modal ao logar com sucesso
    const handleLoginSuccess = (user) => {
        setIsAuthenticated(true);
        setShowLoginModal(false);
        // Preenche os dados do formulário com o usuário logado
        setFormData(prev => ({ ...prev, name: user.name || '', email: user.email || '' }));
        setMessage('Login realizado com sucesso!');
    };

    // Função para fechar o modal (continuar como convidado)
    const handleContinueGuest = () => {
        setShowLoginModal(false);
    };

    // Função de Logout
    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setIsAuthenticated(false);
        setFormData({ name: '', email: '', phone: '', service: '' }); // Limpa o formulário
        navigate('/'); // Volta para a Home
    };

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
            const filteredSlots = slotsFromApi.filter(slot => slot.start.endsWith(':00'));
            setAvailableSlots(filteredSlots);
        } catch (err) {
            setError('Erro ao carregar horários disponíveis');
        } finally {
            setLoading(false);
        }
    };
    
    const handleSlotClick = (slot) => {
        setError(null);
        if (slot.available) {
            setSelectedSlot(slot);
        } else {
            if (isAuthenticated && slot.appointmentId) {
                setSlotToCancel(slot);
            } else if (!isAuthenticated) {
                setError("Faça login para poder cancelar seus agendamentos.");
                setShowLoginModal(true); // Abre o modal se tentar cancelar sem login
            } else {
                 setError("Não foi possível identificar este agendamento para cancelamento.");
            }
        }
    };

    const handleCancelAppointment = async (appointmentId) => {
        setError(null);
        setMessage(null);
        const token = localStorage.getItem('token');
        if (!token) {
            setError("Sua sessão expirou. Faça login novamente.");
            setIsAuthenticated(false);
            setShowLoginModal(true);
            throw new Error("Não autorizado");
        }
        try {
            const response = await axios.post(
                `${API_URL}/appointments/cancel-by-client`, 
                { appointmentId: appointmentId },
                { headers: { Authorization: `Bearer ${token}` } }
            );
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
        
        const token = localStorage.getItem('token');
        const headers = {};
        if (token && isAuthenticated) { // Envia token só se estiver autenticado
            headers.Authorization = `Bearer ${token}`;
        }

        try {
            const appointmentData = {
                client: { name: formData.name, email: formData.email, phone: formData.phone },
                date: selectedDate, startTime: selectedSlot.start, endTime: selectedSlot.end, service: formData.service,
            };
            
            const response = await axios.post(
                `${API_URL}/appointments`, 
                appointmentData,
                { headers: headers }
            );

            if (response.data.success || response.data.appointment) {
                setBookingResult(response.data);
                setShowConfirmation(true);
                // Não limpar nome/email se estiver logado
                setFormData(prev => ({ ...prev, phone: '', service: '' }));
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
            {/* REQ 3.0: Renderiza o modal de login */}
            {showLoginModal && (
                <ClientLoginModal 
                    onLoginSuccess={handleLoginSuccess}
                    onContinueGuest={handleContinueGuest}
                />
            )}

            {slotToCancel && (
                <CancelModal
                    slot={slotToCancel}
                    onClose={() => { setSlotToCancel(null); setError(null); }}
                    onCancel={handleCancelAppointment}
                    setError={setError}
                />
            )}
            
            <header className="header">
                <h1>{companySettings.name}</h1>
                {/* Botão de Logout se estiver logado */}
                {isAuthenticated && (
                    <button onClick={handleLogout} className="btn-logout">Sair</button>
                )}
            </header>
            
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
                        {isAuthenticated && <small>Clique em um horário ocupado (cinza) para cancelar.</small>}
                        {!isAuthenticated && <small>Horários em cinza estão indisponíveis.</small>}
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
                            <input type="text" id="name" name="name" value={formData.name} onChange={handleInputChange} required disabled={isAuthenticated} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="email">E-mail *</label>
                            <input type="email" id="email" name="email" value={formData.email} onChange={handleInputChange} required disabled={isAuthenticated} />
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
                            <p><strong>Data:</strong> {new Date(bookingResult.appointment.date).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</p>
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