// src/pages/AdminPanel/AdminPanel.jsx
// Dashboard com atualização em tempo real dos estados e contadores

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import io from 'socket.io-client';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

const AdminPanel = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [appointments, setAppointments] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [socket, setSocket] = useState(null);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [message, setMessage] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  
  // REQUISITO 2: Estado para filtro de data no dashboard
  const [dashboardDate, setDashboardDate] = useState(new Date().toISOString().split('T')[0]);
  const [dashboardAppointments, setDashboardAppointments] = useState([]);
  
  const [settings, setSettings] = useState({
    companyName: 'Agenda Inteligente',
    logo: null,
    primaryColor: '#4CAF50',
    services: [],
    workingHours: {
      start: '08:00',
      end: '18:00'
    },
    slotDuration: 60
  });

  // REQUISITO 1: Função para recalcular estatísticas localmente
  const recalculateStats = useCallback((appointmentsList) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Filtra agendamentos de hoje
    const todayAppointments = appointmentsList.filter(apt => {
      const aptDate = new Date(apt.date);
      return aptDate >= today && aptDate < tomorrow;
    });
    
    // Conta confirmados de hoje
    const todayConfirmed = todayAppointments.filter(apt => apt.status === 'confirmed').length;
    
    // Conta pendentes
    const pendingConfirmation = appointmentsList.filter(apt => apt.status === 'scheduled').length;
    
    // Atualiza stats
    setStats(prev => ({
      ...prev,
      today: {
        total: todayAppointments.length,
        confirmed: todayConfirmed,
        appointments: todayAppointments
      },
      summary: {
        ...prev?.summary,
        pendingConfirmation: pendingConfirmation,
        todayAppointments: todayAppointments.length
      }
    }));
  }, []);

  useEffect(() => {
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);
    
    newSocket.on('appointment-update', (update) => {
      console.log('Atualização em tempo real:', update);
      fetchAppointments();
      fetchStats();
    });
    
    loadInitialData();
    
    return () => {
      newSocket.close();
    };
  }, []);
  
  const loadInitialData = async () => {
    await Promise.all([
      fetchAppointments(),
      fetchSettings(),
      fetchStats()
    ]);
  };
  
  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };
  
  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API_URL}/stats`);
      setStats(response.data);
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
    }
  };
  
  const fetchAppointments = async () => {
    setLoading(true);
    try {
      const params = { date: selectedDate };
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      
      const response = await axios.get(`${API_URL}/appointments`, { params });
      const appointmentsList = response.data.appointments || response.data;
      setAppointments(appointmentsList);
      
      // REQUISITO 1: Recalcula estatísticas com os novos dados
      recalculateStats(appointmentsList);
    } catch (error) {
      console.error('Erro ao buscar agendamentos:', error);
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  };
  
  // REQUISITO 2: Função para buscar agendamentos por data específica no dashboard
  const fetchDashboardAppointments = async (date) => {
    try {
      const response = await axios.get(`${API_URL}/appointments`, {
        params: { date: date }
      });
      const appointmentsList = response.data.appointments || response.data;
      setDashboardAppointments(appointmentsList);
    } catch (error) {
      console.error('Erro ao buscar agendamentos do dashboard:', error);
      setDashboardAppointments([]);
    }
  };
  
  // REQUISITO 2: Effect para buscar agendamentos quando a data do dashboard mudar
  useEffect(() => {
    if (activeTab === 'dashboard' && dashboardDate) {
      fetchDashboardAppointments(dashboardDate);
    }
  }, [dashboardDate, activeTab]);
  
  const fetchSettings = async () => {
    try {
      const response = await axios.get(`${API_URL}/settings`);
      setSettings({
        ...response.data,
        workingHours: response.data.workingHours || { start: '08:00', end: '18:00' },
        services: response.data.services || []
      });
      
      if (response.data.primaryColor) {
        document.documentElement.style.setProperty('--primary-color', response.data.primaryColor);
      }
    } catch (error) {
      console.error('Erro ao buscar configurações:', error);
    }
  };
  
  // REQUISITO 1: Função atualizada para mudança de status com atualização local imediata
  const updateAppointmentStatus = async (appointmentId, newStatus) => {
    try {
      const response = await axios.patch(
        `${API_URL}/appointments/${appointmentId}/status`,
        { status: newStatus }
      );
      
      if (response.data.success || response.data.appointment) {
        const updatedAppointment = response.data.appointment;
        
        // REQUISITO 1: Atualiza a lista local imediatamente
        setAppointments(prev => {
          const newList = prev.map(apt => 
            apt._id === appointmentId 
              ? { ...apt, ...updatedAppointment, status: newStatus }
              : apt
          );
          // Recalcula estatísticas com a nova lista
          recalculateStats(newList);
          return newList;
        });
        
        // Atualiza também a lista do dashboard se estiver visível
        setDashboardAppointments(prev => 
          prev.map(apt => 
            apt._id === appointmentId 
              ? { ...apt, ...updatedAppointment, status: newStatus }
              : apt
          )
        );
        
        // Notifica via WebSocket
        if (socket) {
          socket.emit('appointment-updated', { appointmentId, status: newStatus });
        }
        
        showMessage(`Status atualizado para ${newStatus} com sucesso!`, 'success');
        
        // Busca estatísticas atualizadas do servidor
        setTimeout(fetchStats, 500);
      }
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      showMessage('Erro ao atualizar status', 'error');
    }
  };
  
  const cancelAppointment = async (appointmentId) => {
    if (!window.confirm('Tem certeza que deseja cancelar este agendamento?')) {
      return;
    }
    
    try {
      const response = await axios.delete(`${API_URL}/appointments/${appointmentId}`);
      
      if (response.data.success) {
        // REQUISITO 1: Remove da lista local e recalcula
        setAppointments(prev => {
          const newList = prev.filter(apt => apt._id !== appointmentId);
          recalculateStats(newList);
          return newList;
        });
        
        setDashboardAppointments(prev => prev.filter(apt => apt._id !== appointmentId));
        
        if (socket) {
          socket.emit('appointment-cancelled', appointmentId);
        }
        
        showMessage('Agendamento cancelado com sucesso', 'success');
        setTimeout(fetchStats, 500);
      }
    } catch (error) {
      console.error('Erro ao cancelar:', error);
      showMessage('Erro ao cancelar agendamento', 'error');
    }
  };
  
  const handleLogout = () => {
    localStorage.removeItem('isAdmin');
    window.location.href = '/';
  };
  
  // Função auxiliar para renderizar um card de agendamento
  const renderAppointmentCard = (appointment) => (
    <div key={appointment._id} style={{ 
      border: '1px solid #ddd', 
      borderRadius: '8px', 
      padding: '15px', 
      marginBottom: '10px',
      transition: 'all 0.3s ease'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h3 style={{ margin: 0 }}>{appointment.client?.name}</h3>
        <span style={{
          padding: '4px 12px',
          borderRadius: '20px',
          fontSize: '12px',
          fontWeight: 'bold',
          transition: 'all 0.3s ease',
          background: appointment.status === 'confirmed' ? '#e8f5e9' : 
                     appointment.status === 'scheduled' ? '#e3f2fd' :
                     appointment.status === 'completed' ? '#f3e5f5' :
                     appointment.status === 'cancelled' ? '#ffebee' : '#f5f5f5',
          color: appointment.status === 'confirmed' ? '#388e3c' :
                 appointment.status === 'scheduled' ? '#1976d2' :
                 appointment.status === 'completed' ? '#7b1fa2' :
                 appointment.status === 'cancelled' ? '#c62828' : '#666'
        }}>
          {appointment.status?.toUpperCase()}
        </span>
      </div>
      
      <div style={{ color: '#666', fontSize: '14px', marginBottom: '10px' }}>
        <p>📧 {appointment.client?.email}</p>
        <p>📱 {appointment.client?.phone}</p>
        <p>🕐 {appointment.startTime} - {appointment.endTime}</p>
        <p>💼 {appointment.service}</p>
        <p>📅 {new Date(appointment.date).toLocaleDateString('pt-BR')}</p>
        {appointment.notes && <p>📝 {appointment.notes}</p>}
      </div>
      
      <div style={{ display: 'flex', gap: '10px' }}>
        {appointment.status === 'scheduled' && (
          <button
            onClick={() => updateAppointmentStatus(appointment._id, 'confirmed')}
            style={{ 
              padding: '6px 12px', 
              background: '#4CAF50', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px', 
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }}
          >
            Confirmar
          </button>
        )}
        {appointment.status === 'confirmed' && (
          <button
            onClick={() => updateAppointmentStatus(appointment._id, 'completed')}
            style={{ 
              padding: '6px 12px', 
              background: '#2196F3', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px', 
              cursor: 'pointer'
            }}
          >
            Concluir
          </button>
        )}
        {appointment.status !== 'cancelled' && (
          <button
            onClick={() => cancelAppointment(appointment._id)}
            style={{ 
              padding: '6px 12px', 
              background: '#f44336', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px', 
              cursor: 'pointer'
            }}
          >
            Cancelar
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="page-container" style={{ background: '#f5f5f5', minHeight: '100vh' }}>
      <div className="container">
        {/* Header com contadores atualizados em tempo real */}
        <div className="main-header" style={{ background: 'white', padding: '20px', borderRadius: '8px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <h1>{settings.companyName || 'Painel Administrativo'}</h1>
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
            {stats && (
              <>
                <span style={{ 
                  padding: '5px 10px', 
                  background: '#e3f2fd', 
                  color: '#1976d2', 
                  borderRadius: '20px', 
                  fontSize: '14px',
                  transition: 'all 0.3s ease'
                }}>
                  📅 Hoje: {stats.today?.total || 0}
                </span>
                <span style={{ 
                  padding: '5px 10px', 
                  background: '#e8f5e9', 
                  color: '#388e3c', 
                  borderRadius: '20px', 
                  fontSize: '14px',
                  transition: 'all 0.3s ease'
                }}>
                  ✅ Confirmados: {stats.today?.confirmed || 0}
                </span>
                <span style={{ 
                  padding: '5px 10px', 
                  background: '#fff3e0', 
                  color: '#f57c00', 
                  borderRadius: '20px', 
                  fontSize: '14px',
                  transition: 'all 0.3s ease'
                }}>
                  ⏳ Pendentes: {stats.summary?.pendingConfirmation || 0}
                </span>
              </>
            )}
            <button onClick={handleLogout} className="btn btn-secondary">
              Sair
            </button>
          </div>
        </div>
        
        {/* Mensagens */}
        {message && (
          <div style={{
            padding: '15px',
            marginBottom: '20px',
            borderRadius: '5px',
            background: message.type === 'success' ? '#e8f5e9' : message.type === 'error' ? '#ffebee' : '#fff3e0',
            color: message.type === 'success' ? '#2e7d32' : message.type === 'error' ? '#c62828' : '#f57c00',
            borderLeft: `4px solid ${message.type === 'success' ? '#4CAF50' : message.type === 'error' ? '#f44336' : '#ff9800'}`
          }}>
            {message.text}
          </div>
        )}
        
        {/* Tabs */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '2px solid #f0f0f0' }}>
          <button 
            style={{
              padding: '12px 24px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: activeTab === 'dashboard' ? 'bold' : 'normal',
              color: activeTab === 'dashboard' ? settings.primaryColor : '#666',
              borderBottom: activeTab === 'dashboard' ? `3px solid ${settings.primaryColor}` : 'none',
              marginBottom: '-2px'
            }}
            onClick={() => setActiveTab('dashboard')}
          >
            Dashboard
          </button>
          <button 
            style={{
              padding: '12px 24px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: activeTab === 'appointments' ? 'bold' : 'normal',
              color: activeTab === 'appointments' ? settings.primaryColor : '#666',
              borderBottom: activeTab === 'appointments' ? `3px solid ${settings.primaryColor}` : 'none',
              marginBottom: '-2px'
            }}
            onClick={() => setActiveTab('appointments')}
          >
            Agendamentos
          </button>
        </div>
        
        {/* Conteúdo */}
        <div style={{ background: 'white', borderRadius: '8px', padding: '30px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          {/* DASHBOARD TAB com filtro de data */}
          {activeTab === 'dashboard' && (
            <div>
              <h2>Dashboard - Visão Geral</h2>
              
              {/* REQUISITO 2: Seletor de data para o dashboard */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ marginRight: '10px', fontWeight: 'bold' }}>
                  Filtrar por data:
                </label>
                <input
                  type="date"
                  value={dashboardDate}
                  onChange={(e) => setDashboardDate(e.target.value)}
                  style={{ 
                    padding: '8px', 
                    border: '1px solid #ddd', 
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                />
              </div>
              
              {/* Cards de estatísticas */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '30px' }}>
                <div style={{ background: '#f5f5f5', padding: '20px', borderRadius: '8px', textAlign: 'center' }}>
                  <h3 style={{ color: settings.primaryColor, fontSize: '32px', margin: '0' }}>
                    {stats?.today?.total || 0}
                  </h3>
                  <p style={{ color: '#666', marginTop: '5px' }}>Agendamentos Hoje</p>
                </div>
                
                <div style={{ background: '#e8f5e9', padding: '20px', borderRadius: '8px', textAlign: 'center' }}>
                  <h3 style={{ color: '#388e3c', fontSize: '32px', margin: '0' }}>
                    {stats?.today?.confirmed || 0}
                  </h3>
                  <p style={{ color: '#666', marginTop: '5px' }}>Confirmados Hoje</p>
                </div>
                
                <div style={{ background: '#fff3e0', padding: '20px', borderRadius: '8px', textAlign: 'center' }}>
                  <h3 style={{ color: '#f57c00', fontSize: '32px', margin: '0' }}>
                    {stats?.summary?.pendingConfirmation || 0}
                  </h3>
                  <p style={{ color: '#666', marginTop: '5px' }}>Aguardando Confirmação</p>
                </div>
                
                <div style={{ background: '#e3f2fd', padding: '20px', borderRadius: '8px', textAlign: 'center' }}>
                  <h3 style={{ color: '#1976d2', fontSize: '32px', margin: '0' }}>
                    {stats?.month?.total || 0}
                  </h3>
                  <p style={{ color: '#666', marginTop: '5px' }}>Total Este Mês</p>
                </div>
              </div>
              
              {/* REQUISITO 2: Lista de agendamentos filtrados por data */}
              <div>
                <h3>Agendamentos do dia {new Date(dashboardDate + 'T12:00:00').toLocaleDateString('pt-BR')}</h3>
                {dashboardAppointments.length === 0 ? (
                  <p style={{ padding: '20px', textAlign: 'center', background: '#f5f5f5', borderRadius: '8px' }}>
                    Nenhum agendamento encontrado para esta data.
                  </p>
                ) : (
                  <div>
                    {dashboardAppointments.map(renderAppointmentCard)}
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* APPOINTMENTS TAB */}
          {activeTab === 'appointments' && (
            <div>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    setTimeout(fetchAppointments, 100);
                  }}
                  style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
                
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setTimeout(fetchAppointments, 100);
                  }}
                  style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                >
                  <option value="all">Todos</option>
                  <option value="scheduled">Agendados</option>
                  <option value="confirmed">Confirmados</option>
                  <option value="completed">Concluídos</option>
                  <option value="cancelled">Cancelados</option>
                </select>
                
                <button 
                  onClick={fetchAppointments}
                  style={{ padding: '8px 16px', background: settings.primaryColor, color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  🔄 Atualizar
                </button>
              </div>
              
              {loading ? (
                <div>Carregando agendamentos...</div>
              ) : appointments.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', background: '#f5f5f5', borderRadius: '8px' }}>
                  <p>Nenhum agendamento encontrado.</p>
                </div>
              ) : (
                <div>
                  {appointments.map(renderAppointmentCard)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;