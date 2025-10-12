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

  const recalculateStats = useCallback((appointmentsList) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const todayAppointments = appointmentsList.filter(apt => {
      const aptDate = new Date(apt.date);
      return aptDate >= today && aptDate < tomorrow;
    });
    
    const todayConfirmed = todayAppointments.filter(apt => apt.status === 'confirmed').length;
    
    const pendingConfirmation = appointmentsList.filter(apt => apt.status === 'scheduled').length;
    
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
      if (activeTab === 'appointments') fetchAppointments();
      if (activeTab === 'dashboard') fetchDashboardAppointments(dashboardDate);
      fetchStats();
    });
    
    loadInitialData();
    
    return () => {
      newSocket.close();
    };
  }, [dashboardDate, activeTab]);
  
  const loadInitialData = async () => {
    await Promise.all([
      fetchAppointments(),
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
      
    } catch (error) {
      console.error('Erro ao buscar agendamentos:', error);
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  };
  
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
  
  const updateAppointmentStatus = async (appointmentId, newStatus) => {
    try {
      const response = await axios.patch(
        `${API_URL}/appointments/${appointmentId}/status`,
        { status: newStatus }
      );
      
      if (response.data.success || response.data.appointment) {
        const updatedAppointment = response.data.appointment;
        
        const updateList = (list) => list.map(apt => 
          apt._id === appointmentId 
            ? { ...apt, ...updatedAppointment, status: newStatus }
            : apt
        );

        setAppointments(prev => updateList(prev));
        setDashboardAppointments(prev => updateList(prev));
        
        // REQUISITO 2: Atualização do contador "Confirmados Hoje"
        if (newStatus === 'confirmed') {
            const confirmedDate = new Date(updatedAppointment.date).toISOString().split('T')[0];
            if (confirmedDate === dashboardDate) {
                // Incrementa o contador de confirmados para a data selecionada
                const confirmedOnDate = dashboardAppointments.filter(apt => apt.status === 'confirmed' || apt._id === appointmentId).length;
                setStats(prev => ({
                    ...prev,
                    today: {
                        ...prev.today,
                        confirmed: confirmedOnDate
                    }
                }));
            }
        }
        
        showMessage(`Status atualizado para ${newStatus} com sucesso!`, 'success');
        
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
        const removeFromList = (list) => list.filter(apt => apt._id !== appointmentId);
        setAppointments(prev => removeFromList(prev));
        setDashboardAppointments(prev => removeFromList(prev));
        
        showMessage('Agendamento cancelado com sucesso', 'success');
        setTimeout(fetchStats, 500);
      }
    } catch (error) {
      console.error('Erro ao cancelar:', error);
      showMessage(error.response?.data?.error || 'Erro ao cancelar agendamento', 'error');
    }
  };
  
  const handleLogout = () => {
    localStorage.removeItem('isAdmin');
    window.location.href = '/';
  };
  
  const renderAppointmentCard = (appointment) => (
    <div key={appointment._id} style={{ 
      border: '1px solid #ddd', 
      borderRadius: '8px', 
      padding: '15px', 
      marginBottom: '10px',
      transition: 'all 0.3s ease',
      opacity: appointment.status === 'cancelled' ? 0.6 : 1
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
            className="btn-small" style={{ background: '#4CAF50', color: 'white' }}
          >
            Confirmar
          </button>
        )}
        {appointment.status === 'confirmed' && (
          <button
            onClick={() => updateAppointmentStatus(appointment._id, 'completed')}
            className="btn-small" style={{ background: '#2196F3', color: 'white' }}
          >
            Concluir
          </button>
        )}
        {/* REQUISITO 3: Bloquear cancelamento de agendamentos concluídos */}
        {appointment.status !== 'cancelled' && (
          <button
            onClick={() => cancelAppointment(appointment._id)}
            disabled={appointment.status === 'completed'}
            className="btn-small" 
            style={{ 
              background: appointment.status === 'completed' ? '#ccc' : '#f44336', 
              color: 'white',
              cursor: appointment.status === 'completed' ? 'not-allowed' : 'pointer'
            }}
          >
            Cancelar
          </button>
        )}
      </div>
    </div>
  );

  // REQUISITO 1: Calcula contadores para a data do dashboard
  const dashboardTotal = dashboardAppointments.length;
  const dashboardConfirmed = dashboardAppointments.filter(apt => apt.status === 'confirmed').length;

  return (
    <div className="page-container" style={{ background: '#f5f5f5', minHeight: '100vh' }}>
      <div className="container">
        <div className="main-header" style={{ background: 'white', padding: '20px', borderRadius: '8px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <h1>{settings.companyName || 'Painel Administrativo'}</h1>
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
            {stats && (
              <>
                <span className="badge" style={{ background: '#e3f2fd', color: '#1976d2' }}>
                  📅 Agendados (dia selecionado): {activeTab === 'dashboard' ? dashboardTotal : stats.today?.total || 0}
                </span>
                <span className="badge" style={{ background: '#e8f5e9', color: '#388e3c' }}>
                  ✅ Confirmados (dia selecionado): {activeTab === 'dashboard' ? dashboardConfirmed : stats.today?.confirmed || 0}
                </span>
                <span className="badge" style={{ background: '#fff3e0', color: '#f57c00' }}>
                  ⏳ Pendentes (total): {stats.summary?.pendingConfirmation || 0}
                </span>
              </>
            )}
            <button onClick={handleLogout} className="btn btn-secondary">
              Sair
            </button>
          </div>
        </div>
        
        {message && (
          <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-error'}`}>
            {message.text}
          </div>
        )}
        
        <div className="tabs-container">
          <button className={`tab-button ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
            Dashboard
          </button>
          <button className={`tab-button ${activeTab === 'appointments' ? 'active' : ''}`} onClick={() => setActiveTab('appointments')}>
            Agendamentos
          </button>
        </div>
        
        <div style={{ background: 'white', borderRadius: '8px', padding: '30px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          {activeTab === 'dashboard' && (
            <div>
              <h2>Dashboard - Visão Geral</h2>
              
              <div style={{ marginBottom: '20px' }}>
                <label className="form-label" style={{ marginRight: '10px' }}>
                  Filtrar por data:
                </label>
                <input
                  type="date"
                  value={dashboardDate}
                  onChange={(e) => setDashboardDate(e.target.value)}
                  className="form-input" style={{ maxWidth: '200px' }}
                />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '30px' }}>
                 <div className="card" style={{ background: '#f5f5f5', textAlign: 'center' }}>
                    <h3 style={{ color: settings.primaryColor, fontSize: '32px', margin: '0' }}>{dashboardTotal}</h3>
                    <p style={{ color: '#666', marginTop: '5px' }}>Agendamentos na Data</p>
                </div>
                <div className="card" style={{ background: '#e8f5e9', textAlign: 'center' }}>
                    <h3 style={{ color: '#388e3c', fontSize: '32px', margin: '0' }}>{dashboardConfirmed}</h3>
                    <p style={{ color: '#666', marginTop: '5px' }}>Confirmados na Data</p>
                </div>
                <div className="card" style={{ background: '#fff3e0', textAlign: 'center' }}>
                    <h3 style={{ color: '#f57c00', fontSize: '32px', margin: '0' }}>{stats?.summary?.pendingConfirmation || 0}</h3>
                    <p style={{ color: '#666', marginTop: '5px' }}>Aguardando Confirmação</p>
                </div>
                <div className="card" style={{ background: '#e3f2fd', textAlign: 'center' }}>
                    <h3 style={{ color: '#1976d2', fontSize: '32px', margin: '0' }}>{stats?.month?.total || 0}</h3>
                    <p style={{ color: '#666', marginTop: '5px' }}>Total Este Mês</p>
                </div>
              </div>
              
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
          
          {activeTab === 'appointments' && (
            <div>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="form-input"
                />
                
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="form-select"
                >
                  <option value="all">Todos</option>
                  <option value="scheduled">Agendados</option>
                  <option value="confirmed">Confirmados</option>
                  <option value="completed">Concluídos</option>
                  <option value="cancelled">Cancelados</option>
                </select>
                
                <button 
                  onClick={fetchAppointments}
                  className="btn btn-primary"
                >
                  🔄 Buscar
                </button>
              </div>
              
              {loading ? (
                <div className="loading">Carregando agendamentos...</div>
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