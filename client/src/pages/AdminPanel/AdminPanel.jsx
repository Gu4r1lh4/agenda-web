// src/pages/AdminPanel/AdminPanel-Fixed.jsx
// AdminPanel com todas as correções e proteções

import React, { useState, useEffect } from 'react';
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
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [stats, setStats] = useState(null);
  const [message, setMessage] = useState(null);
  
  // CORREÇÃO 3: Estado inicial com valores padrão para evitar undefined
  const [settings, setSettings] = useState({
    companyName: 'Carregando...',
    logo: null,
    primaryColor: '#4CAF50',
    services: [],
    workingHours: {
      start: '08:00',
      end: '18:00'
    },
    slotDuration: 60
  });
  
  const [newService, setNewService] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [updatingStatus, setUpdatingStatus] = useState({}); // Track which appointments are updating

  useEffect(() => {
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);
    
    newSocket.on('appointment-update', (update) => {
      console.log('Atualização em tempo real recebida:', update);
      // Recarrega dados quando houver mudanças
      fetchAppointments();
      fetchStats();
    });
    
    // Carrega dados iniciais
    loadInitialData();
    
    return () => {
      newSocket.close();
    };
  }, []);
  
  // Função para carregar todos os dados iniciais
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
  
  // CORREÇÃO 2: Busca estatísticas com tratamento de erro
  const fetchStats = async () => {
    try {
      console.log('Buscando estatísticas...');
      const response = await axios.get(`${API_URL}/stats`);
      console.log('Estatísticas recebidas:', response.data);
      setStats(response.data);
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
      // Define estatísticas vazias em caso de erro
      setStats({
        today: { total: 0, confirmed: 0 },
        month: { total: 0, completed: 0, cancelled: 0 },
        services: [],
        summary: { totalAppointments: 0, pendingConfirmation: 0 }
      });
    }
  };
  
  const fetchAppointments = async () => {
    setLoading(true);
    try {
      const params = { date: selectedDate };
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      
      console.log('Buscando agendamentos com params:', params);
      const response = await axios.get(`${API_URL}/appointments`, { params });
      
      const appointmentsList = response.data.appointments || response.data;
      console.log(`${appointmentsList.length} agendamentos encontrados`);
      setAppointments(appointmentsList);
    } catch (error) {
      console.error('Erro ao buscar agendamentos:', error);
      showMessage('Erro ao buscar agendamentos', 'error');
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  };
  
  // CORREÇÃO 3: Busca configurações com proteção contra undefined
  const fetchSettings = async () => {
    setLoadingSettings(true);
    try {
      console.log('Buscando configurações...');
      const response = await axios.get(`${API_URL}/settings`);
      console.log('Configurações recebidas:', response.data);
      
      // Garante que workingHours sempre existe
      const settingsData = {
        ...response.data,
        workingHours: response.data.workingHours || {
          start: '08:00',
          end: '18:00'
        },
        services: response.data.services || []
      };
      
      setSettings(settingsData);
      
      // Aplica cor customizada
      if (settingsData.primaryColor) {
        document.documentElement.style.setProperty('--primary-color', settingsData.primaryColor);
      }
    } catch (error) {
      console.error('Erro ao buscar configurações:', error);
      showMessage('Usando configurações padrão', 'warning');
      // Mantém valores padrão em caso de erro
    } finally {
      setLoadingSettings(false);
    }
  };
  
  // CORREÇÃO 1: Função de atualização de status corrigida
  const updateAppointmentStatus = async (appointmentId, newStatus) => {
    // Previne múltiplos cliques
    if (updatingStatus[appointmentId]) {
      return;
    }
    
    setUpdatingStatus(prev => ({ ...prev, [appointmentId]: true }));
    
    try {
      console.log(`Atualizando status do agendamento ${appointmentId} para ${newStatus}`);
      
      // Usa PATCH para atualizar status
      const response = await axios.patch(
        `${API_URL}/appointments/${appointmentId}/status`,
        { status: newStatus },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('Resposta da atualização:', response.data);
      
      // Atualiza localmente apenas se sucesso
      if (response.data.success || response.data.appointment) {
        setAppointments(prev => 
          prev.map(apt => 
            apt._id === appointmentId 
              ? { ...apt, status: newStatus } 
              : apt
          )
        );
        
        // Notifica via WebSocket
        if (socket) {
          socket.emit('appointment-updated', { appointmentId, status: newStatus });
        }
        
        showMessage(`Status atualizado para ${newStatus} com sucesso!`, 'success');
        
        // Atualiza estatísticas
        fetchStats();
      }
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      const errorMsg = error.response?.data?.error || 'Erro ao atualizar status';
      showMessage(errorMsg, 'error');
    } finally {
      setUpdatingStatus(prev => ({ ...prev, [appointmentId]: false }));
    }
  };
  
  const cancelAppointment = async (appointmentId) => {
    if (!window.confirm('Tem certeza que deseja cancelar este agendamento?')) {
      return;
    }
    
    try {
      const response = await axios.delete(`${API_URL}/appointments/${appointmentId}`);
      
      if (response.data.success) {
        setAppointments(prev => prev.filter(apt => apt._id !== appointmentId));
        
        if (socket) {
          socket.emit('appointment-cancelled', appointmentId);
        }
        
        showMessage('Agendamento cancelado com sucesso', 'success');
        fetchStats();
      }
    } catch (error) {
      console.error('Erro ao cancelar:', error);
      showMessage('Erro ao cancelar agendamento', 'error');
    }
  };
  
  const saveSettings = async () => {
    try {
      console.log('Salvando configurações:', settings);
      const response = await axios.put(`${API_URL}/settings`, settings);
      
      if (response.data.success) {
        showMessage('Configurações salvas com sucesso!', 'success');
        document.documentElement.style.setProperty('--primary-color', settings.primaryColor);
      }
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      showMessage('Erro ao salvar configurações', 'error');
    }
  };
  
  const addService = () => {
    if (newService.trim()) {
      setSettings(prev => ({
        ...prev,
        services: [...(prev.services || []), newService.trim()]
      }));
      setNewService('');
    }
  };
  
  const removeService = (index) => {
    setSettings(prev => ({
      ...prev,
      services: prev.services.filter((_, i) => i !== index)
    }));
  };
  
  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        showMessage('Arquivo muito grande. Máximo 5MB', 'error');
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setSettings(prev => ({
          ...prev,
          logo: reader.result
        }));
      };
      reader.onerror = () => {
        showMessage('Erro ao carregar imagem', 'error');
      };
      reader.readAsDataURL(file);
    }
  };
  
  const handleLogout = () => {
    localStorage.removeItem('isAdmin');
    window.location.href = '/';
  };

  // CORREÇÃO 3: Renderização com proteção contra undefined
  if (loadingSettings) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div>
          <div className="spinner"></div>
          <p>Carregando configurações...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container" style={{ background: '#f5f5f5', minHeight: '100vh' }}>
      <div className="container">
        {/* Header com informações em tempo real */}
        <div className="main-header" style={{ background: 'white', padding: '20px', borderRadius: '8px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <h1>{settings.companyName || 'Painel Administrativo'}</h1>
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
            {stats && (
              <>
                <span style={{ padding: '5px 10px', background: '#e3f2fd', color: '#1976d2', borderRadius: '20px', fontSize: '14px' }}>
                  📅 Hoje: {stats.today?.total || 0}
                </span>
                <span style={{ padding: '5px 10px', background: '#e8f5e9', color: '#388e3c', borderRadius: '20px', fontSize: '14px' }}>
                  ✅ Confirmados: {stats.today?.confirmed || 0}
                </span>
                <span style={{ padding: '5px 10px', background: '#fff3e0', color: '#f57c00', borderRadius: '20px', fontSize: '14px' }}>
                  ⏳ Pendentes: {stats.summary?.pendingConfirmation || 0}
                </span>
              </>
            )}
            <button onClick={handleLogout} className="btn btn-secondary">
              Sair
            </button>
          </div>
        </div>
        
        {/* Mensagens de feedback */}
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
          <button 
            style={{
              padding: '12px 24px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: activeTab === 'settings' ? 'bold' : 'normal',
              color: activeTab === 'settings' ? settings.primaryColor : '#666',
              borderBottom: activeTab === 'settings' ? `3px solid ${settings.primaryColor}` : 'none',
              marginBottom: '-2px'
            }}
            onClick={() => setActiveTab('settings')}
          >
            Configurações
          </button>
        </div>
        
        {/* Conteúdo */}
        <div style={{ background: 'white', borderRadius: '8px', padding: '30px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          {/* DASHBOARD TAB - Com dados reais */}
          {activeTab === 'dashboard' && (
            <div>
              <h2>Dashboard - Visão Geral</h2>
              
              {!stats ? (
                <div>Carregando estatísticas...</div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginTop: '20px' }}>
                    <div style={{ background: '#f5f5f5', padding: '20px', borderRadius: '8px', textAlign: 'center' }}>
                      <h3 style={{ color: settings.primaryColor, fontSize: '32px', margin: '0' }}>
                        {stats.today?.total || 0}
                      </h3>
                      <p style={{ color: '#666', marginTop: '5px' }}>Agendamentos Hoje</p>
                    </div>
                    
                    <div style={{ background: '#e8f5e9', padding: '20px', borderRadius: '8px', textAlign: 'center' }}>
                      <h3 style={{ color: '#388e3c', fontSize: '32px', margin: '0' }}>
                        {stats.today?.confirmed || 0}
                      </h3>
                      <p style={{ color: '#666', marginTop: '5px' }}>Confirmados Hoje</p>
                    </div>
                    
                    <div style={{ background: '#e3f2fd', padding: '20px', borderRadius: '8px', textAlign: 'center' }}>
                      <h3 style={{ color: '#1976d2', fontSize: '32px', margin: '0' }}>
                        {stats.month?.total || 0}
                      </h3>
                      <p style={{ color: '#666', marginTop: '5px' }}>Total Este Mês</p>
                    </div>
                    
                    <div style={{ background: '#ffebee', padding: '20px', borderRadius: '8px', textAlign: 'center' }}>
                      <h3 style={{ color: '#c62828', fontSize: '32px', margin: '0' }}>
                        {stats.month?.cancelled || 0}
                      </h3>
                      <p style={{ color: '#666', marginTop: '5px' }}>Cancelados no Mês</p>
                    </div>
                  </div>
                  
                  {/* Serviços mais procurados */}
                  {stats.services && stats.services.length > 0 && (
                    <div style={{ marginTop: '30px' }}>
                      <h3>Serviços Mais Procurados</h3>
                      <div style={{ background: '#f5f5f5', padding: '20px', borderRadius: '8px' }}>
                        {stats.services.map((service, index) => (
                          <div key={index} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: index < stats.services.length - 1 ? '1px solid #ddd' : 'none' }}>
                            <span>{service._id || 'Sem nome'}</span>
                            <span style={{ background: settings.primaryColor, color: 'white', padding: '2px 10px', borderRadius: '20px', fontSize: '14px' }}>
                              {service.count}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Próximos agendamentos */}
                  {stats.upcoming && stats.upcoming.length > 0 && (
                    <div style={{ marginTop: '30px' }}>
                      <h3>Próximos Agendamentos</h3>
                      <div style={{ background: '#f5f5f5', padding: '20px', borderRadius: '8px' }}>
                        {stats.upcoming.map((apt, index) => (
                          <div key={index} style={{ padding: '10px 0', borderBottom: index < stats.upcoming.length - 1 ? '1px solid #ddd' : 'none' }}>
                            <strong>{apt.client?.name}</strong>
                            <div style={{ fontSize: '14px', color: '#666', marginTop: '5px' }}>
                              {new Date(apt.date).toLocaleDateString('pt-BR')} às {apt.startTime} - {apt.service}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
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
                  <p>Nenhum agendamento encontrado para esta data.</p>
                </div>
              ) : (
                <div>
                  {appointments.map(appointment => (
                    <div key={appointment._id} style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '15px', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <h3 style={{ margin: 0 }}>{appointment.client?.name}</h3>
                        <span style={{
                          padding: '4px 12px',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: 'bold',
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
                        {appointment.notes && <p>📝 {appointment.notes}</p>}
                      </div>
                      
                      <div style={{ display: 'flex', gap: '10px' }}>
                        {appointment.status === 'scheduled' && (
                          <button
                            onClick={() => updateAppointmentStatus(appointment._id, 'confirmed')}
                            disabled={updatingStatus[appointment._id]}
                            style={{ 
                              padding: '6px 12px', 
                              background: updatingStatus[appointment._id] ? '#ccc' : '#4CAF50', 
                              color: 'white', 
                              border: 'none', 
                              borderRadius: '4px', 
                              cursor: updatingStatus[appointment._id] ? 'not-allowed' : 'pointer' 
                            }}
                          >
                            {updatingStatus[appointment._id] ? 'Confirmando...' : 'Confirmar'}
                          </button>
                        )}
                        {appointment.status === 'confirmed' && (
                          <button
                            onClick={() => updateAppointmentStatus(appointment._id, 'completed')}
                            disabled={updatingStatus[appointment._id]}
                            style={{ 
                              padding: '6px 12px', 
                              background: updatingStatus[appointment._id] ? '#ccc' : '#2196F3', 
                              color: 'white', 
                              border: 'none', 
                              borderRadius: '4px', 
                              cursor: updatingStatus[appointment._id] ? 'not-allowed' : 'pointer' 
                            }}
                          >
                            {updatingStatus[appointment._id] ? 'Concluindo...' : 'Concluir'}
                          </button>
                        )}
                        {appointment.status !== 'cancelled' && (
                          <button
                            onClick={() => cancelAppointment(appointment._id)}
                            style={{ padding: '6px 12px', background: '#f44336', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                          >
                            Cancelar
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {/* SETTINGS TAB - Com proteção contra undefined */}
          {activeTab === 'settings' && (
            <div>
              <h2>Configurações da Empresa</h2>
              
              <div style={{ marginTop: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Nome da Empresa</label>
                <input
                  type="text"
                  value={settings.companyName || ''}
                  onChange={(e) => setSettings(prev => ({ ...prev, companyName: e.target.value }))}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              </div>
              
              <div style={{ marginTop: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Cor Principal</label>
                <input
                  type="color"
                  value={settings.primaryColor || '#4CAF50'}
                  onChange={(e) => setSettings(prev => ({ ...prev, primaryColor: e.target.value }))}
                  style={{ width: '60px', height: '40px', cursor: 'pointer' }}
                />
              </div>
              
              <div style={{ marginTop: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Horário de Funcionamento</label>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <input
                    type="time"
                    value={settings.workingHours?.start || '08:00'}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      workingHours: { ...prev.workingHours, start: e.target.value }
                    }))}
                    style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                  <span>até</span>
                  <input
                    type="time"
                    value={settings.workingHours?.end || '18:00'}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      workingHours: { ...prev.workingHours, end: e.target.value }
                    }))}
                    style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                </div>
              </div>
              
              <div style={{ marginTop: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Serviços Oferecidos</label>
                {(settings.services || []).map((service, index) => (
                  <div key={index} style={{ display: 'flex', gap: '10px', marginBottom: '5px' }}>
                    <input
                      type="text"
                      value={service}
                      readOnly
                      style={{ flex: 1, padding: '8px', border: '1px solid #ddd', borderRadius: '4px', background: '#f5f5f5' }}
                    />
                    <button
                      onClick={() => removeService(index)}
                      style={{ padding: '8px 12px', background: '#f44336', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      Remover
                    </button>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    type="text"
                    value={newService}
                    onChange={(e) => setNewService(e.target.value)}
                    placeholder="Novo serviço"
                    onKeyPress={(e) => e.key === 'Enter' && addService()}
                    style={{ flex: 1, padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                  <button
                    onClick={addService}
                    style={{ padding: '8px 16px', background: settings.primaryColor, color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    Adicionar
                  </button>
                </div>
              </div>
              
              <button
                onClick={saveSettings}
                style={{ marginTop: '30px', padding: '12px 24px', background: settings.primaryColor, color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '16px' }}
              >
                Salvar Configurações
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;