// client/src/pages/ClientView/ClientView.jsx
import React, { useState, useEffect, useRef } from 'react'; 
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import io from 'socket.io-client';
import './ClientView.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

const COLOR_PALETTES = {
  purple: { name: 'Roxo Profissional', primary: '#5a67d8', secondary: '#4a4fb8' },
  green: { name: 'Verde Natureza', primary: '#48bb78', secondary: '#38a169' },
  blue: { name: 'Azul Confiança', primary: '#4299e1', secondary: '#3182ce' },
  orange: { name: 'Laranja Energia', primary: '#ed8936', secondary: '#dd6b20' },
  pink: { name: 'Rosa Criativo', primary: '#d53f8c', secondary: '#b83280' },
  teal: { name: 'Turquesa Moderno', primary: '#38b2ac', secondary: '#319795' }
};

// Modal de Login/Registro
const ClientLoginModal = ({ onLoginSuccess, onContinueGuest }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [formData, setFormData] = useState({ name: '', email: '', password: '', confirmPassword: '', phone: '' });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);

    const handleInputChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        setError('');
        setSuccess('');
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const response = await axios.post(`${API_URL}/auth/login`, {
                email: formData.email,
                password: formData.password
            });
            if (response.data.success && response.data.token) {
                localStorage.setItem('token', response.data.token);
                localStorage.setItem('user', JSON.stringify(response.data.user));
                setSuccess('Login realizado com sucesso!');
                setTimeout(() => onLoginSuccess(response.data.user), 500);
            } else {
                setError(response.data.message || 'Erro ao fazer login.');
            }
        } catch (err) {
            setError(err.response?.data?.message || err.response?.data?.error || 'Erro de conexão.');
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        if (!formData.name || !formData.email || !formData.password) {
            setError('Preencha todos os campos obrigatórios');
            return;
        }
        if (formData.password !== formData.confirmPassword) {
            setError('As senhas não coincidem');
            return;
        }
        if (formData.password.length < 6) {
            setError('A senha deve ter pelo menos 6 caracteres');
            return;
        }
        setLoading(true);
        try {
            const response = await axios.post(`${API_URL}/auth/register`, {
                name: formData.name,
                email: formData.email,
                password: formData.password,
                role: 'client'
            });
            if (response.data.token) {
                localStorage.setItem('token', response.data.token);
                localStorage.setItem('user', JSON.stringify(response.data.user));
                setSuccess('Cadastro realizado! Redirecionando...');
                setTimeout(() => onLoginSuccess(response.data.user), 1000);
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Erro ao criar conta. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content login-modal-content">
                <div className="tabs-container">
                    <button className={`tab-button ${isLogin ? 'active' : ''}`} onClick={() => setIsLogin(true)} type="button">Entrar</button>
                    <button className={`tab-button ${!isLogin ? 'active' : ''}`} onClick={() => setIsLogin(false)} type="button">Cadastrar</button>
                </div>
                <div className="tab-content">
                    <h2>{isLogin ? '👋 Bem-vindo!' : '✨ Criar Conta'}</h2>
                    <p>{isLogin ? 'Entre para gerenciar seus agendamentos' : 'Cadastre-se para agendar e gerenciar seus horários'}</p>
                    {error && <div className="alert-error">{error}</div>}
                    {success && <div className="alert-success">{success}</div>}
                    {isLogin ? (
                        <form onSubmit={handleLogin}>
                            <div className="form-group">
                                <label htmlFor="login_email">E-mail</label>
                                <input type="email" id="login_email" name="email" value={formData.email} onChange={handleInputChange} placeholder="seu@email.com" required />
                            </div>
                            <div className="form-group">
                                <label htmlFor="login_pass">Senha</label>
                                <input type="password" id="login_pass" name="password" value={formData.password} onChange={handleInputChange} placeholder="••••••••" required />
                            </div>
                            <div className="modal-actions">
                                <button type="submit" className="submit-button" disabled={loading}>{loading ? '⏳ Entrando...' : '🚀 Entrar'}</button>
                                <button type="button" className="btn-back" onClick={onContinueGuest}>Continuar sem login</button>
                            </div>
                        </form>
                    ) : (
                        <form onSubmit={handleRegister}>
                            <div className="form-group"><label htmlFor="register_name">Nome Completo *</label><input type="text" id="register_name" name="name" value={formData.name} onChange={handleInputChange} placeholder="Seu nome completo" required /></div>
                            <div className="form-group"><label htmlFor="register_email">E-mail *</label><input type="email" id="register_email" name="email" value={formData.email} onChange={handleInputChange} placeholder="seu@email.com" required /></div>
                            <div className="form-group"><label htmlFor="register_pass">Senha *</label><input type="password" id="register_pass" name="password" value={formData.password} onChange={handleInputChange} placeholder="Mínimo 6 caracteres" required /></div>
                            <div className="form-group"><label htmlFor="register_confirm">Confirmar Senha *</label><input type="password" id="register_confirm" name="confirmPassword" value={formData.confirmPassword} onChange={handleInputChange} placeholder="Digite a senha novamente" required /></div>
                            <div className="modal-actions">
                                <button type="submit" className="submit-button" disabled={loading}>{loading ? '⏳ Criando conta...' : '✨ Criar Conta'}</button>
                                <button type="button" className="btn-back" onClick={onContinueGuest}>Continuar sem cadastro</button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

// Modal de Cancelamento
const CancelModal = ({ slot, onCancel, onClose, setError }) => {
    const [loading, setLoading] = useState(false);
    const handleCancel = async () => {
        setLoading(true);
        setError(null);
        try {
            await onCancel(slot.appointmentId);
            // Se sucesso, o pai fecha. Se erro 403, o pai trata.
        } catch (err) { 
            // Tratado no pai
        } finally {
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

// Modal de Undo (Popup de Sucesso Invertido)
const UndoToast = ({ timeLeft, onUndo }) => (
    <div className="modal-overlay">
        <div className="modal-content">
            <div className="undo-icon-container">🗑️</div>
            <h2>Agendamento Excluído!</h2>
            <div className="booking-details">
                <p>Esta ação será permanente em:</p>
                <div className="timer-countdown">{timeLeft} segundos</div>
            </div>
            <p className="undo-hint">Foi um engano? Você pode recuperar agora.</p>
            <button onClick={onUndo} className="submit-button btn-block">
                Desfazer Exclusão
            </button>
        </div>
    </div>
);

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
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [showLoginModal, setShowLoginModal] = useState(false);
    
    const [undoState, setUndoState] = useState({ show: false, appointmentId: null, timeLeft: 0 });
    const timerRef = useRef(null);

    const selectedDateRef = useRef(selectedDate);
    const navigate = useNavigate();

    useEffect(() => {
        selectedDateRef.current = selectedDate;
    }, [selectedDate]);

    // Timer do Undo
    useEffect(() => {
        if (undoState.show && undoState.timeLeft > 0) {
            timerRef.current = setTimeout(() => {
                setUndoState(prev => ({ ...prev, timeLeft: prev.timeLeft - 1 }));
            }, 1000);
        } else if (undoState.show && undoState.timeLeft === 0) {
            finalizeCancellation(undoState.appointmentId);
        }
        return () => clearTimeout(timerRef.current);
    }, [undoState]);

    // Configuração Inicial
    useEffect(() => {
        const token = localStorage.getItem('token');
        const userStr = localStorage.getItem('user');
        
        if (token && userStr) {
            try {
                const user = JSON.parse(userStr);
                if (user.role === 'client') {
                    setIsAuthenticated(true);
                    setFormData(prev => ({ ...prev, name: user.name || '', email: user.email || '' }));
                } else {
                    localStorage.clear();
                    setShowLoginModal(true);
                }
            } catch (e) {
                localStorage.clear();
                setShowLoginModal(true);
            }
        } else {
            setShowLoginModal(true);
        }

        fetchCompanySettings();
        const socket = io(SOCKET_URL);
        socket.on('appointment-update', () => {
            const currentDate = selectedDateRef.current;
            if (currentDate) {
                fetchAvailableSlots(currentDate, true);
            }
        });
        
        return () => socket.close();
    }, []);

    useEffect(() => {
        if (selectedDate) {
            fetchAvailableSlots(selectedDate, false);
        }
    }, [selectedDate]);
    
    const handleLoginSuccess = (user) => {
        setIsAuthenticated(true);
        setShowLoginModal(false);
        setFormData(prev => ({ ...prev, name: user.name || '', email: user.email || '' }));
        setMessage('Login realizado com sucesso!');
    };

    const handleContinueGuest = () => {
        setShowLoginModal(false);
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setIsAuthenticated(false);
        setFormData({ name: '', email: '', phone: '', service: '' });
        navigate('/');
    };

    const fetchCompanySettings = async () => {
        try {
            const response = await axios.get(`${API_URL}/settings`);
            setCompanySettings(response.data);
            const palette = COLOR_PALETTES[response.data.colorPalette || 'purple'];
            if (palette) {
                document.documentElement.style.setProperty('--primary-color', palette.primary);
                document.documentElement.style.setProperty('--secondary-color', palette.secondary);
            }
        } catch (err) { console.error('Erro ao buscar configurações:', err); }
    };
    
    const fetchAvailableSlots = async (date, isBackground = false) => {
        if (!date) { setAvailableSlots([]); return; }
        if (!isBackground) setLoading(true);
        if (!isBackground) setError(null); 
        if (!isBackground) setMessage(null);

        try {
            const response = await axios.get(`${API_URL}/appointments/available-slots`, { params: { date } });
            const slotsFromApi = response.data.slots || [];
            const filteredSlots = slotsFromApi.filter(slot => slot.start.endsWith(':00'));
            setAvailableSlots(filteredSlots);
        } catch (err) {
            if (!isBackground) setError('Erro ao carregar horários disponíveis');
        } finally {
            if (!isBackground) setLoading(false);
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
                setShowLoginModal(true);
            } else {
                 setError("Não foi possível identificar este agendamento para cancelamento.");
            }
        }
    };

    // --- CANCELAMENTO (COM VALIDAÇÃO RESTAURADA) ---
    const handleCancelAppointment = async (appointmentId) => {
        setError(null);
        setMessage(null);
        const token = localStorage.getItem('token');
        
        if (!token) {
            setError("Sessão expirada.");
            setShowLoginModal(true);
            throw new Error("Não autorizado");
        }

        try {
            const response = await axios.patch(
                `${API_URL}/appointments/${appointmentId}/pending-cancel`, 
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (response.data.success) {
                setSlotToCancel(null); // Fecha modal de confirmação
                
                fetchAvailableSlots(selectedDate, true); // Atualiza tela
                
                // Abre modal de Undo
                setUndoState({
                    show: true,
                    appointmentId: appointmentId,
                    timeLeft: 5 
                });
            }
        } catch (err) {
            // --- VALIDAÇÃO RESTAURADA AQUI ---
            if (err.response && err.response.status === 403) {
                setSlotToCancel(null); // Fecha modal se estiver aberto
                setError("Este agendamento foi realizado por outro usuário, portanto não poderá ser cancelado.");
            } else {
                const errorMessage = err.response?.data?.message || 'Não foi possível iniciar o cancelamento.';
                setError(errorMessage);
            }
        }
    };

    const finalizeCancellation = async (id) => {
        const token = localStorage.getItem('token');
        try {
            await axios.delete(`${API_URL}/appointments/${id}/confirm-cancel`, { headers: { Authorization: `Bearer ${token}` } });
            setUndoState({ show: false, appointmentId: null, timeLeft: 0 });
            fetchAvailableSlots(selectedDate, true);
        } catch (err) {
            console.error("Erro ao finalizar:", err);
        }
    };

    const handleUndoClick = async () => {
        const token = localStorage.getItem('token');
        clearTimeout(timerRef.current);
        
        try {
            const response = await axios.patch(
                `${API_URL}/appointments/${undoState.appointmentId}/undo-cancel`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (response.data.success) {
                setMessage("Cancelamento desfeito! Seu agendamento está ativo.");
                setUndoState({ show: false, appointmentId: null, timeLeft: 0 });
                fetchAvailableSlots(selectedDate, true); 
            }
        } catch (err) {
            setError("Erro ao tentar desfazer.");
            setUndoState({ show: false, appointmentId: null, timeLeft: 0 });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!isAuthenticated) {
            setError("Por favor, faça login ou cadastre-se para finalizar o agendamento.");
            setShowLoginModal(true);
            return;
        }

        if (!selectedSlot) return;
        setLoading(true);
        setError(null);
        
        const token = localStorage.getItem('token');
        const headers = {};
        if (token) {
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
                setFormData(prev => ({ ...prev, phone: '', service: '' }));
                setSelectedSlot(null);
                fetchAvailableSlots(selectedDate, true);
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Erro ao criar agendamento.');
        } finally { setLoading(false); }
    };

    const handleDateChange = (e) => {
        const date = e.target.value;
        setSelectedDate(date);
        setSelectedSlot(null);
    };
    
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const today = new Date().toISOString().split('T')[0];
    
    return (
        <div className="client-view">
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

            {undoState.show && (
                <UndoToast 
                    timeLeft={undoState.timeLeft} 
                    onUndo={handleUndoClick} 
                />
            )}
            
            <header className="header">
                <h1>{companySettings.name}</h1>
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
                        <div style={{fontSize: '4rem', color: '#4CAF50', marginBottom: '1rem'}}>✅</div>
                        <h2>Agendamento Realizado!</h2>
                        <div className="booking-details">
                            <p><strong>Data:</strong> {new Date(bookingResult.appointment.date).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</p>
                            <p><strong>Horário:</strong> {bookingResult.appointment.startTime} - {bookingResult.appointment.endTime}</p>
                        </div>
                        <p>Você receberá um e-mail de confirmação em breve.</p>
                        <button className="submit-button btn-block" onClick={() => setShowConfirmation(false)}>Fechar</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClientView;