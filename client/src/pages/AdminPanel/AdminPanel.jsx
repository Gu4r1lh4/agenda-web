// src/pages/AdminPanel/AdminPanel.jsx - VERSÃO CORRIGIDA
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import './AdminPanel.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

const COLOR_PALETTES = {
  purple: {
    name: 'Roxo Profissional',
    primary: '#5a67d8',
    secondary: '#4a4fb8',
    gradient: 'linear-gradient(135deg, #5a67d8 0%, #4a4fb8 100%)'
  },
  green: {
    name: 'Verde Natureza',
    primary: '#48bb78',
    secondary: '#38a169',
    gradient: 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)'
  },
  blue: {
    name: 'Azul Confiança',
    primary: '#4299e1',
    secondary: '#3182ce',
    gradient: 'linear-gradient(135deg, #4299e1 0%, #3182ce 100%)'
  },
  orange: {
    name: 'Laranja Energia',
    primary: '#ed8936',
    secondary: '#dd6b20',
    gradient: 'linear-gradient(135deg, #ed8936 0%, #dd6b20 100%)'
  },
  pink: {
    name: 'Rosa Criativo',
    primary: '#d53f8c',
    secondary: '#b83280',
    gradient: 'linear-gradient(135deg, #d53f8c 0%, #b83280 100%)'
  },
  teal: {
    name: 'Turquesa Moderno',
    primary: '#38b2ac',
    secondary: '#319795',
    gradient: 'linear-gradient(135deg, #38b2ac 0%, #319795 100%)'
  }
};

const AdminPanel = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [appointments, setAppointments] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [socket, setSocket] = useState(null);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [message, setMessage] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [dashboardDate, setDashboardDate] = useState(new Date().toISOString().split('T')[0]);
  const [dashboardAppointments, setDashboardAppointments] = useState([]);
  
  const [settings, setSettings] = useState({
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
    services: [],
    workingHours: {
      start: '08:00',
      end: '18:00'
    },
    slotDuration: 60
  });

  useEffect(() => {
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);
    
    newSocket.on('appointment-update', (update) => {
      console.log('🔄 Atualização em tempo real:', update);
      if (activeTab === 'appointments') fetchAppointments();
      if (activeTab === 'dashboard') fetchDashboardAppointments(dashboardDate);
      fetchStats();
    });
    
    loadInitialData();
    
    return () => {
      newSocket.close();
    };
  }, []);

  useEffect(() => {
    if (activeTab === 'dashboard') {
      console.log('📊 Dashboard ativo, buscando agendamentos para:', dashboardDate);
      fetchDashboardAppointments(dashboardDate);
    }
  }, [dashboardDate, activeTab]);

  useEffect(() => {
    if (activeTab === 'appointments') {
      console.log('📅 Aba de agendamentos ativa, buscando para:', selectedDate);
      fetchAppointments();
    }
  }, [selectedDate, statusFilter, activeTab]);
  
  const loadInitialData = async () => {
    console.log('🚀 Carregando dados iniciais...');
    await Promise.all([
      fetchSettings(),
      fetchStats(),
      fetchDashboardAppointments(dashboardDate)
    ]);
  };
  
  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };
  
  const fetchStats = async () => {
    try {
      console.log('📈 Buscando estatísticas...');
      const response = await axios.get(`${API_URL}/stats`);
      console.log('✅ Estatísticas recebidas:', response.data);
      setStats(response.data);
    } catch (error) {
      console.error('❌ Erro ao buscar estatísticas:', error);
    }
  };
  
  const fetchAppointments = async () => {
    setLoading(true);
    try {
      console.log('📅 Buscando agendamentos para:', selectedDate, 'Status:', statusFilter);
      
      const params = { date: selectedDate };
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      
      const response = await axios.get(`${API_URL}/appointments`, { params });
      console.log('✅ Resposta completa:', response.data);
      
      const appointmentsList = response.data.appointments || response.data || [];
      console.log('📋 Lista de agendamentos:', appointmentsList);
      console.log('🔢 Total de agendamentos:', appointmentsList.length);
      
      setAppointments(appointmentsList);
    } catch (error) {
      console.error('❌ Erro ao buscar agendamentos:', error);
      console.error('Detalhes do erro:', error.response?.data);
      setAppointments([]);
      showMessage('Erro ao buscar agendamentos', 'error');
    } finally {
      setLoading(false);
    }
  };
  
  const fetchDashboardAppointments = async (date) => {
    try {
      console.log('📊 Buscando agendamentos do dashboard para:', date);
      
      const response = await axios.get(`${API_URL}/appointments`, {
        params: { date: date }
      });
      
      console.log('✅ Resposta do dashboard:', response.data);
      
      const appointmentsList = response.data.appointments || response.data || [];
      console.log('📋 Dashboard - Total de agendamentos:', appointmentsList.length);
      console.log('📋 Dashboard - Agendamentos:', appointmentsList);
      
      setDashboardAppointments(appointmentsList);
    } catch (error) {
      console.error('❌ Erro ao buscar agendamentos do dashboard:', error);
      console.error('Detalhes do erro:', error.response?.data);
      setDashboardAppointments([]);
    }
  };
  
  const fetchSettings = async () => {
    try {
      console.log('⚙️ Buscando configurações...');
      const response = await axios.get(`${API_URL}/settings`);
      console.log('✅ Configurações recebidas:', response.data);
      
      setSettings(prev => ({
        ...prev,
        ...response.data,
        homePageCards: response.data.homePageCards || prev.homePageCards,
        workingHours: response.data.workingHours || prev.workingHours,
        services: response.data.services || []
      }));
      
      const palette = COLOR_PALETTES[response.data.colorPalette || 'purple'];
      document.documentElement.style.setProperty('--primary-color', palette.primary);
      document.documentElement.style.setProperty('--secondary-color', palette.secondary);
    } catch (error) {
      console.error('❌ Erro ao buscar configurações:', error);
    }
  };
  
  const updateAppointmentStatus = async (appointmentId, newStatus) => {
    try {
      console.log(`🔄 Atualizando status do agendamento ${appointmentId} para ${newStatus}`);
      
      const token = localStorage.getItem('adminToken') || localStorage.getItem('token');
      const response = await axios.patch(
        `${API_URL}/appointments/${appointmentId}/status`,
        { status: newStatus },
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      console.log('✅ Status atualizado:', response.data);
      
      if (response.data.success || response.data.appointment) {
        const updatedAppointment = response.data.appointment;
        
        const updateList = (list) => list.map(apt => 
          apt._id === appointmentId 
            ? { ...apt, ...updatedAppointment, status: newStatus }
            : apt
        );

        setAppointments(prev => updateList(prev));
        setDashboardAppointments(prev => updateList(prev));
        
        showMessage(`Status atualizado para ${newStatus} com sucesso!`, 'success');
        setTimeout(() => {
          fetchStats();
          if (activeTab === 'dashboard') fetchDashboardAppointments(dashboardDate);
          if (activeTab === 'appointments') fetchAppointments();
        }, 500);
      }
    } catch (error) {
      console.error('❌ Erro ao atualizar status:', error);
      showMessage('Erro ao atualizar status', 'error');
    }
  };
  
  const cancelAppointment = async (appointmentId) => {
    if (!window.confirm('Tem certeza que deseja cancelar este agendamento?')) {
      return;
    }
    
    try {
      console.log(`❌ Cancelando agendamento ${appointmentId}`);
      
      const token = localStorage.getItem('adminToken') || localStorage.getItem('token');
      const response = await axios.delete(`${API_URL}/appointments/${appointmentId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('✅ Agendamento cancelado:', response.data);
      
      if (response.data.success) {
        const removeFromList = (list) => list.filter(apt => apt._id !== appointmentId);
        setAppointments(prev => removeFromList(prev));
        setDashboardAppointments(prev => removeFromList(prev));
        
        showMessage('Agendamento cancelado com sucesso', 'success');
        setTimeout(() => {
          fetchStats();
          if (activeTab === 'dashboard') fetchDashboardAppointments(dashboardDate);
          if (activeTab === 'appointments') fetchAppointments();
        }, 500);
      }
    } catch (error) {
      console.error('❌ Erro ao cancelar:', error);
      showMessage(error.response?.data?.error || 'Erro ao cancelar agendamento', 'error');
    }
  };

  const handleLogoUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSettings(prev => ({ ...prev, logo: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCardUpdate = (cardId, field, value) => {
    setSettings(prev => ({
      ...prev,
      homePageCards: prev.homePageCards.map(card =>
        card.id === cardId ? { ...card, [field]: value } : card
      )
    }));
  };

  const handleSaveSettings = async () => {
    try {
      const token = localStorage.getItem('adminToken') || localStorage.getItem('token');
      
      if (!token) {
        showMessage('Erro: Token de autenticação não encontrado', 'error');
        return;
      }

      await axios.put(`${API_URL}/settings`, settings, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const palette = COLOR_PALETTES[settings.colorPalette];
      document.documentElement.style.setProperty('--primary-color', palette.primary);
      document.documentElement.style.setProperty('--secondary-color', palette.secondary);
      
      showMessage('Configurações salvas com sucesso!', 'success');
    } catch (error) {
      console.error('❌ Erro ao salvar configurações:', error);
      if (error.response?.status === 401) {
        showMessage('Erro: Não autorizado. Faça login novamente.', 'error');
      } else {
        showMessage('Erro ao salvar configurações', 'error');
      }
    }
  };
  
  const handleLogout = () => {
    localStorage.removeItem('isAdmin');
    localStorage.removeItem('adminToken');
    localStorage.removeItem('token');
    window.location.href = '/';
  };
  
  const renderAppointmentCard = (appointment) => {
    console.log('🎴 Renderizando card do agendamento:', appointment);
    
    return (
      <div key={appointment._id} style={{ 
        border: '2px solid #e2e8f0', 
        borderRadius: '12px', 
        padding: '20px', 
        marginBottom: '15px',
        background: 'white',
        transition: 'all 0.3s ease',
        opacity: appointment.status === 'cancelled' ? 0.6 : 1,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h3 style={{ margin: 0, color: '#2d3748', fontSize: '1.2rem' }}>
            {appointment.client?.name || 'Cliente sem nome'}
          </h3>
          <span style={{
            padding: '6px 14px',
            borderRadius: '20px',
            fontSize: '0.8rem',
            fontWeight: '700',
            background: appointment.status === 'confirmed' ? '#d4edda' : 
                       appointment.status === 'scheduled' ? '#fff3cd' :
                       appointment.status === 'completed' ? '#d1ecf1' :
                       appointment.status === 'cancelled' ? '#f8d7da' : '#f5f5f5',
            color: appointment.status === 'confirmed' ? '#155724' :
                   appointment.status === 'scheduled' ? '#856404' :
                   appointment.status === 'completed' ? '#0c5460' :
                   appointment.status === 'cancelled' ? '#721c24' : '#666'
          }}>
            {appointment.status === 'scheduled' ? '⏳ AGENDADO' :
             appointment.status === 'confirmed' ? '✅ CONFIRMADO' :
             appointment.status === 'completed' ? '✔️ CONCLUÍDO' :
             appointment.status === 'cancelled' ? '❌ CANCELADO' :
             appointment.status?.toUpperCase()}
          </span>
        </div>
        
        <div style={{ color: '#718096', fontSize: '0.95rem', marginBottom: '15px', lineHeight: '1.6' }}>
          <p style={{ margin: '8px 0' }}><strong>📧 Email:</strong> {appointment.client?.email || 'N/A'}</p>
          <p style={{ margin: '8px 0' }}><strong>📱 Telefone:</strong> {appointment.client?.phone || 'N/A'}</p>
          <p style={{ margin: '8px 0' }}><strong>🕐 Horário:</strong> {appointment.startTime} - {appointment.endTime}</p>
          <p style={{ margin: '8px 0' }}><strong>💼 Serviço:</strong> {appointment.service}</p>
          <p style={{ margin: '8px 0' }}>
            <strong>📅 Data:</strong> {new Date(appointment.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
          </p>
          {appointment.notes && <p style={{ margin: '8px 0' }}><strong>📝 Obs:</strong> {appointment.notes}</p>}
        </div>
        
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {appointment.status === 'scheduled' && (
            <button
              onClick={() => updateAppointmentStatus(appointment._id, 'confirmed')}
              className="btn-small" 
              style={{ background: '#48bb78', color: 'white' }}
            >
              ✓ Confirmar
            </button>
          )}
          {appointment.status === 'confirmed' && (
            <button
              onClick={() => updateAppointmentStatus(appointment._id, 'completed')}
              className="btn-small" 
              style={{ background: '#4299e1', color: 'white' }}
            >
              ✓ Concluir
            </button>
          )}
          {appointment.status !== 'cancelled' && appointment.status !== 'completed' && (
            <button
              onClick={() => cancelAppointment(appointment._id)}
              className="btn-small" 
              style={{ 
                background: '#f56565', 
                color: 'white'
              }}
            >
              ✕ Cancelar
            </button>
          )}
        </div>
      </div>
    );
  };

  const dashboardTotal = dashboardAppointments.length;
  const dashboardConfirmed = dashboardAppointments.filter(apt => apt.status === 'confirmed').length;
  const dashboardScheduled = dashboardAppointments.filter(apt => apt.status === 'scheduled').length;
  const dashboardCompleted = dashboardAppointments.filter(apt => apt.status === 'completed').length;

  console.log('🎯 Estado atual do componente:', {
    activeTab,
    dashboardDate,
    selectedDate,
    dashboardAppointmentsCount: dashboardAppointments.length,
    appointmentsCount: appointments.length,
    dashboardTotal,
    dashboardConfirmed
  });

  return (
    <div className="admin-panel">
      <div className="page-container">
        <div className="container">
          <div className="main-header">
            <h1>{settings.companyName || 'Agenda Inteligente'}</h1>
            <div>
              {stats && (
                <>
                  <span className="badge" style={{ background: '#e3f2fd', color: '#1976d2' }}>
                    📅 AGENDADOS (DIA SELECIONADO): {activeTab === 'dashboard' ? dashboardTotal : stats.today?.total || 0}
                  </span>
                  <span className="badge" style={{ background: '#e8f5e9', color: '#388e3c' }}>
                    ✅ CONFIRMADOS (DIA SELECIONADO): {activeTab === 'dashboard' ? dashboardConfirmed : stats.today?.confirmed || 0}
                  </span>
                  <span className="badge" style={{ background: '#fff3e0', color: '#f57c00' }}>
                    ⏳ PENDENTES (TOTAL): {stats.summary?.pendingConfirmation || 0}
                  </span>
                </>
              )}
              <button onClick={handleLogout} className="btn btn-secondary">
                🚪 Sair
              </button>
            </div>
          </div>
          
          {message && (
            <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-error'}`}>
              {message.text}
            </div>
          )}
          
          <div className="tabs-container">
            <button 
              className={`tab-button ${activeTab === 'dashboard' ? 'active' : ''}`} 
              onClick={() => setActiveTab('dashboard')}
            >
              📊 Dashboard
            </button>
            <button 
              className={`tab-button ${activeTab === 'appointments' ? 'active' : ''}`} 
              onClick={() => setActiveTab('appointments')}
            >
              📅 Agendamentos
            </button>
            <button 
              className={`tab-button ${activeTab === 'settings' ? 'active' : ''}`} 
              onClick={() => setActiveTab('settings')}
            >
              ⚙️ Configurações
            </button>
          </div>
          
          <div className="card">
            {activeTab === 'dashboard' && (
              <div>
                <h2 style={{ marginTop: 0, color: '#2d3748' }}>Dashboard - Visão Geral</h2>
                
                <div style={{ marginBottom: '25px' }}>
                  <label className="form-label">Filtrar por data:</label>
                  <input
                    type="date"
                    value={dashboardDate}
                    onChange={(e) => {
                      console.log('📅 Nova data selecionada:', e.target.value);
                      setDashboardDate(e.target.value);
                    }}
                    className="form-input" 
                    style={{ maxWidth: '220px' }}
                  />
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '35px' }}>
                  <div style={{ background: '#f8f9fc', padding: '25px', borderRadius: '12px', textAlign: 'center', border: '2px solid #e2e8f0' }}>
                    <h3 style={{ color: '#5a67d8', fontSize: '2.5rem', margin: '0' }}>{dashboardTotal}</h3>
                    <p style={{ color: '#718096', marginTop: '8px', fontSize: '0.9rem' }}>Agendamentos na Data</p>
                  </div>
                  <div style={{ background: '#e8f5e9', padding: '25px', borderRadius: '12px', textAlign: 'center', border: '2px solid #9ae6b4' }}>
                    <h3 style={{ color: '#38a169', fontSize: '2.5rem', margin: '0' }}>{dashboardConfirmed}</h3>
                    <p style={{ color: '#2f855a', marginTop: '8px', fontSize: '0.9rem' }}>Confirmados na Data</p>
                  </div>
                  <div style={{ background: '#fff3e0', padding: '25px', borderRadius: '12px', textAlign: 'center', border: '2px solid #fbbf24' }}>
                    <h3 style={{ color: '#dd6b20', fontSize: '2.5rem', margin: '0' }}>{dashboardScheduled}</h3>
                    <p style={{ color: '#c05621', marginTop: '8px', fontSize: '0.9rem' }}>Aguardando Confirmação</p>
                  </div>
                  <div style={{ background: '#e3f2fd', padding: '25px', borderRadius: '12px', textAlign: 'center', border: '2px solid #93c5fd' }}>
                    <h3 style={{ color: '#3182ce', fontSize: '2.5rem', margin: '0' }}>{dashboardCompleted}</h3>
                    <p style={{ color: '#2c5282', marginTop: '8px', fontSize: '0.9rem' }}>Concluídos na Data</p>
                  </div>
                </div>
                
                <div>
                  <h3 style={{ color: '#2d3748', borderBottom: '2px solid #e2e8f0', paddingBottom: '10px' }}>
                    Agendamentos do dia {new Date(dashboardDate + 'T12:00:00').toLocaleDateString('pt-BR')}
                  </h3>
                  
                  <p style={{ fontSize: '0.9rem', color: '#718096', marginBottom: '20px' }}>
                    Total de {dashboardTotal} agendamento{dashboardTotal !== 1 ? 's' : ''} encontrado{dashboardTotal !== 1 ? 's' : ''}
                  </p>
                  
                  {dashboardAppointments.length === 0 ? (
                    <div style={{ padding: '50px', textAlign: 'center', background: '#f8f9fc', borderRadius: '12px', border: '2px dashed #cbd5e0' }}>
                      <p style={{ color: '#718096', fontSize: '1.1rem', margin: 0 }}>
                        📭 Nenhum agendamento encontrado para esta data
                      </p>
                    </div>
                  ) : (
                    <div>
                      {dashboardAppointments.map(apt => renderAppointmentCard(apt))}
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {activeTab === 'appointments' && (
              <div>
                <h2 style={{ marginTop: 0, color: '#2d3748' }}>Gerenciar Agendamentos</h2>
                
                <div style={{ display: 'flex', gap: '15px', marginBottom: '25px', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1', minWidth: '200px' }}>
                    <label className="form-label">Data:</label>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => {
                        console.log('📅 Nova data (appointments):', e.target.value);
                        setSelectedDate(e.target.value);
                      }}
                      className="form-input"
                    />
                  </div>
                  
                  <div style={{ flex: '1', minWidth: '200px' }}>
                    <label className="form-label">Status:</label>
                    <select
                      value={statusFilter}
                      onChange={(e) => {
                        console.log('🔍 Novo filtro de status:', e.target.value);
                        setStatusFilter(e.target.value);
                      }}
                      className="form-select"
                    >
                      <option value="all">Todos</option>
                      <option value="scheduled">Agendados</option>
                      <option value="confirmed">Confirmados</option>
                      <option value="completed">Concluídos</option>
                      <option value="cancelled">Cancelados</option>
                    </select>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <button 
                      onClick={() => {
                        console.log('🔄 Botão buscar clicado');
                        fetchAppointments();
                      }}
                      className="btn btn-primary"
                    >
                      🔄 Buscar
                    </button>
                  </div>
                </div>
                
                {loading ? (
                  <div className="loading">⏳ Carregando agendamentos...</div>
                ) : appointments.length === 0 ? (
                  <div style={{ padding: '50px', textAlign: 'center', background: '#f8f9fc', borderRadius: '12px', border: '2px dashed #cbd5e0' }}>
                    <p style={{ color: '#718096', fontSize: '1.1rem', margin: 0 }}>
                      📭 Nenhum agendamento encontrado para os filtros selecionados
                    </p>
                  </div>
                ) : (
                  <div>
                    <p style={{ fontSize: '0.9rem', color: '#718096', marginBottom: '20px' }}>
                      Total de {appointments.length} agendamento{appointments.length !== 1 ? 's' : ''} encontrado{appointments.length !== 1 ? 's' : ''}
                    </p>
                    {appointments.map(apt => renderAppointmentCard(apt))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="settings-section">
                <h2 style={{ marginTop: 0, color: '#2d3748' }}>Configurações do Sistema</h2>
                
                <div className="settings-group">
                  <h3>🏢 Informações da Empresa</h3>
                  <div className="form-group">
                    <label className="form-label">Nome da Empresa:</label>
                    <input
                      type="text"
                      value={settings.companyName}
                      onChange={(e) => setSettings(prev => ({ ...prev, companyName: e.target.value }))}
                      className="form-input"
                      placeholder="Digite o nome da sua empresa"
                    />
                  </div>
                </div>

                <div className="settings-group">
                  <h3>🖼️ Logo da Empresa</h3>
                  <div className="form-group">
                    <label className="form-label">Upload da Logo:</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="form-input"
                    />
                    {settings.logo && (
                      <img src={settings.logo} alt="Logo" className="logo-preview" />
                    )}
                  </div>
                </div>

                <div className="settings-group">
                  <h3>🎨 Paleta de Cores</h3>
                  <p style={{ color: '#718096', marginBottom: '15px' }}>
                    Escolha a paleta de cores que combina com a identidade da sua marca:
                  </p>
                  <div className="color-palette-options">
                    {Object.entries(COLOR_PALETTES).map(([key, palette]) => (
                      <div
                        key={key}
                        className={`color-option ${settings.colorPalette === key ? 'selected' : ''}`}
                        style={{ background: palette.gradient }}
                        onClick={() => setSettings(prev => ({ ...prev, colorPalette: key }))}
                      >
                        <div className="color-name" style={{ color: 'white' }}>
                          {palette.name}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="settings-group">
                  <h3>📝 Conteúdo dos Cards da Página Inicial</h3>
                  <p style={{ color: '#718096', marginBottom: '20px' }}>
                    Personalize os cards que aparecem na página inicial para promover sua marca:
                  </p>
                  <div className="cards-editor">
                    {settings.homePageCards.map((card, index) => (
                      <div key={card.id} className="card-editor">
                        <h4>Card {index + 1}</h4>
                        <div className="form-group">
                          <label className="form-label">Título:</label>
                          <input
                            type="text"
                            value={card.title}
                            onChange={(e) => handleCardUpdate(card.id, 'title', e.target.value)}
                            className="form-input"
                            placeholder="Título do card"
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Descrição:</label>
                          <textarea
                            value={card.description}
                            onChange={(e) => handleCardUpdate(card.id, 'description', e.target.value)}
                            className="form-textarea"
                            placeholder="Descrição do card"
                            rows="3"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ marginTop: '30px', textAlign: 'right' }}>
                  <button 
                    onClick={handleSaveSettings}
                    className="btn btn-primary"
                    style={{ padding: '15px 40px', fontSize: '1.1rem' }}
                  >
                    💾 Salvar Configurações
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;