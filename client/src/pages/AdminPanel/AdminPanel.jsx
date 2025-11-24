// src/pages/AdminPanel/AdminPanel.jsx
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import { useToast } from '../../utils/useToast';
import './AdminPanel.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

const COLOR_PALETTES = {
  purple: { name: 'Roxo Profissional', primary: '#5a67d8', secondary: '#4a4fb8', gradient: 'linear-gradient(135deg, #5a67d8 0%, #4a4fb8 100%)' },
  green: { name: 'Verde Natureza', primary: '#48bb78', secondary: '#38a169', gradient: 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)' },
  blue: { name: 'Azul Confiança', primary: '#4299e1', secondary: '#3182ce', gradient: 'linear-gradient(135deg, #4299e1 0%, #3182ce 100%)' },
  orange: { name: 'Laranja Energia', primary: '#ed8936', secondary: '#dd6b20', gradient: 'linear-gradient(135deg, #ed8936 0%, #dd6b20 100%)' },
  pink: { name: 'Rosa Criativo', primary: '#d53f8c', secondary: '#b83280', gradient: 'linear-gradient(135deg, #d53f8c 0%, #b83280 100%)' },
  teal: { name: 'Turquesa Moderno', primary: '#38b2ac', secondary: '#319795', gradient: 'linear-gradient(135deg, #38b2ac 0%, #319795 100%)' }
};

const AdminPanel = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [appointments, setAppointments] = useState([]);
  const [dashboardAppointments, setDashboardAppointments] = useState([]); 
  const [selectedAppointments, setSelectedAppointments] = useState([]); 
  
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [dashboardDate, setDashboardDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [socket, setSocket] = useState(null);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  
  const [bulkMode, setBulkMode] = useState(null); 
  
  // Estado para adicionar bloqueios manuais
  const [newBlock, setNewBlock] = useState({ date: '', time: '' });

  const [undoData, setUndoData] = useState(null); 
  const undoTimerRef = useRef(null);

  const { showToast } = useToast(); 
  
  const [settings, setSettings] = useState({
    companyName: 'Agenda Inteligente',
    logo: null,
    colorPalette: 'purple',
    homePageCards: [],
    services: [],
    workingHours: { start: '08:00', end: '18:00' },
    blockedSlots: [],
    slotDuration: 60
  });

  // --- EFEITOS ---
  useEffect(() => {
    if (settings.colorPalette && COLOR_PALETTES[settings.colorPalette]) {
      const palette = COLOR_PALETTES[settings.colorPalette];
      document.documentElement.style.setProperty('--primary-color', palette.primary);
      document.documentElement.style.setProperty('--secondary-color', palette.secondary);
    }
  }, [settings.colorPalette]);

  useEffect(() => {
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);
    newSocket.on('appointment-update', () => {
      if (!bulkMode && !undoData) { 
          if (activeTab === 'appointments') fetchAppointments();
          fetchDashboardAppointments(dashboardDate);
          fetchStats();
      }
    });
    loadInitialData();
    return () => newSocket.close();
  }, [bulkMode, undoData, activeTab, dashboardDate]);

  useEffect(() => {
    if (activeTab === 'dashboard') fetchDashboardAppointments(dashboardDate);
  }, [dashboardDate, activeTab]);

  useEffect(() => {
    if (activeTab === 'appointments') fetchAppointments();
  }, [selectedDate, statusFilter, activeTab]);

  useEffect(() => {
    if (undoData && undoData.timeLeft > 0) {
        undoTimerRef.current = setTimeout(() => {
            setUndoData(prev => prev ? ({ ...prev, timeLeft: prev.timeLeft - 1 }) : null);
        }, 1000);
    } else if (undoData && undoData.timeLeft === 0) {
        handleConfirmDelete();
    }
    return () => clearTimeout(undoTimerRef.current);
  }, [undoData]);
  
  const loadInitialData = async () => {
    await Promise.all([fetchSettings(), fetchStats(), fetchDashboardAppointments(dashboardDate)]);
  };
  
  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API_URL}/stats`);
      setStats(response.data);
    } catch (error) { console.error('Erro stats:', error); }
  };
  
  const fetchAppointments = async () => {
    setLoading(true);
    try {
      const params = { date: selectedDate };
      // --- CORREÇÃO AQUI ---
      // Se o filtro for 'all', mandamos explicitamente para o backend trazer tudo (inclusive cancelados)
      if (statusFilter === 'all') {
          params.status = 'all';
      } else {
          params.status = statusFilter;
      }
      
      const response = await axios.get(`${API_URL}/appointments`, { params });
      setAppointments(response.data.appointments || []);
    } catch (error) { 
      setAppointments([]); 
      showToast('Erro ao buscar agendamentos', 'error');
    } finally { 
      setLoading(false); 
    }
  };
  
  const fetchDashboardAppointments = async (date) => {
    try {
      const response = await axios.get(`${API_URL}/appointments`, { params: { date: date, status: 'all' } });
      setDashboardAppointments(response.data.appointments || []);
    } catch (error) { setDashboardAppointments([]); }
  };
  
  const fetchSettings = async () => {
    try {
      const response = await axios.get(`${API_URL}/settings`);
      setSettings(prev => ({ 
          ...prev, 
          ...response.data,
          homePageCards: response.data.homePageCards || [],
          workingHours: response.data.workingHours || { start: '08:00', end: '18:00' },
          blockedSlots: response.data.blockedSlots || []
      }));
    } catch (error) { console.error('Erro settings:', error); }
  };
  
  const updateAppointmentStatus = async (appointmentId, newStatus) => {
    try {
      const token = localStorage.getItem('adminToken') || localStorage.getItem('token');
      const response = await axios.patch(`${API_URL}/appointments/${appointmentId}/status`, { status: newStatus }, { headers: { 'Authorization': `Bearer ${token}` } });
      if (response.data.success) {
        const updateList = (list) => list.map(apt => apt._id === appointmentId ? { ...apt, status: newStatus } : apt);
        setAppointments(prev => updateList(prev));
        setDashboardAppointments(prev => updateList(prev));
        fetchStats();
      }
    } catch (error) { showToast('Erro ao atualizar status', 'error'); }
  };

  const cancelIndividualAppointment = async (appointmentId) => {
    try {
      const token = localStorage.getItem('adminToken') || localStorage.getItem('token');
      await axios.patch(`${API_URL}/appointments/${appointmentId}/pending-cancel`, {}, { headers: { 'Authorization': `Bearer ${token}` } });
      const setPending = (list) => list.map(apt => apt._id === appointmentId ? { ...apt, status: 'pending_cancellation' } : apt);
      setAppointments(prev => setPending(prev));
      setDashboardAppointments(prev => setPending(prev));
      setUndoData({ type: 'single', id: appointmentId, timeLeft: 5 });
    } catch (error) { showToast('Erro ao cancelar.', 'error'); }
  };

  const executeBulkAction = async () => {
    if (selectedAppointments.length === 0) return;
    const token = localStorage.getItem('adminToken') || localStorage.getItem('token');
    const headers = { 'Authorization': `Bearer ${token}` };
    const action = bulkMode;
    setBulkMode(null);

    if (action === 'complete') {
        try {
            await Promise.all(selectedAppointments.map(id => axios.patch(`${API_URL}/appointments/${id}/status`, { status: 'completed' }, { headers })));
            showToast(`${selectedAppointments.length} concluídos!`, 'success');
            const setCompleted = (list) => list.map(apt => selectedAppointments.includes(apt._id) ? { ...apt, status: 'completed' } : apt);
            setAppointments(prev => setCompleted(prev));
            setDashboardAppointments(prev => setCompleted(prev));
            setSelectedAppointments([]);
            fetchStats();
        } catch (e) { showToast('Erro na conclusão', 'error'); }
    } else if (action === 'cancel') {
        try {
            await Promise.all(selectedAppointments.map(id => axios.patch(`${API_URL}/appointments/${id}/pending-cancel`, {}, { headers })));
            const idsToProcess = [...selectedAppointments];
            const setPending = (list) => list.map(apt => idsToProcess.includes(apt._id) ? { ...apt, status: 'pending_cancellation' } : apt);
            setAppointments(prev => setPending(prev));
            setDashboardAppointments(prev => setPending(prev));
            setSelectedAppointments([]); 
            setUndoData({ type: 'bulk', ids: idsToProcess, timeLeft: 5 });
        } catch (e) { showToast('Erro', 'error'); }
    }
  };

  const handleUndoAction = async () => {
      if (!undoData) return;
      const token = localStorage.getItem('adminToken') || localStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}` };
      clearTimeout(undoTimerRef.current);
      try {
          if (undoData.type === 'single') {
              await axios.patch(`${API_URL}/appointments/${undoData.id}/undo-cancel`, {}, { headers });
              const setScheduled = (list) => list.map(apt => apt._id === undoData.id ? { ...apt, status: 'scheduled' } : apt);
              setAppointments(prev => setScheduled(prev));
              setDashboardAppointments(prev => setScheduled(prev));
          } else if (undoData.type === 'bulk') {
              await Promise.all(undoData.ids.map(id => axios.patch(`${API_URL}/appointments/${id}/undo-cancel`, {}, { headers })));
              const setScheduled = (list) => list.map(apt => undoData.ids.includes(apt._id) ? { ...apt, status: 'scheduled' } : apt);
              setAppointments(prev => setScheduled(prev));
              setDashboardAppointments(prev => setScheduled(prev));
          }
          showToast('Restaurado com sucesso!', 'success');
      } catch (error) { showToast('Erro ao restaurar.', 'error'); } finally { setUndoData(null); fetchStats(); }
  };

  const handleConfirmDelete = async () => {
      if (!undoData) return;
      const token = localStorage.getItem('adminToken') || localStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}` };
      try {
          if (undoData.type === 'single') {
              await axios.delete(`${API_URL}/appointments/${undoData.id}/confirm-cancel`, { headers });
              const remove = (list) => list.filter(apt => apt._id !== undoData.id);
              setAppointments(prev => remove(prev));
              setDashboardAppointments(prev => remove(prev));
          } else if (undoData.type === 'bulk') {
              await Promise.all(undoData.ids.map(id => axios.delete(`${API_URL}/appointments/${id}/confirm-cancel`, { headers })));
              const remove = (list) => list.filter(apt => !undoData.ids.includes(apt._id));
              setAppointments(prev => remove(prev));
              setDashboardAppointments(prev => remove(prev));
          }
      } catch (error) { } finally { setUndoData(null); fetchStats(); }
  };

  const startBulkMode = (mode) => { setBulkMode(mode); setSelectedAppointments([]); };
  const cancelBulkMode = () => { setBulkMode(null); setSelectedAppointments([]); };
  const toggleSelection = (id) => setSelectedAppointments(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleSelectAll = () => selectedAppointments.length === appointments.length ? setSelectedAppointments([]) : setSelectedAppointments(appointments.map(a => a._id));
  
  const handleLogoUpload = (event) => { const file = event.target.files[0]; if (file) { const reader = new FileReader(); reader.onloadend = () => setSettings(prev => ({ ...prev, logo: reader.result })); reader.readAsDataURL(file); } };
  const handleCardUpdate = (cardId, field, value) => { setSettings(prev => ({ ...prev, homePageCards: prev.homePageCards.map(card => card.id === cardId ? { ...card, [field]: value } : card) })); };
  
  const handleSaveSettings = async () => {
    try {
      const token = localStorage.getItem('adminToken') || localStorage.getItem('token');
      if (!token) { showToast('Erro: Token não encontrado', 'error'); return; }
      await axios.put(`${API_URL}/settings`, settings, { headers: { 'Authorization': `Bearer ${token}` } });
      const palette = COLOR_PALETTES[settings.colorPalette];
      if(palette) {
          document.documentElement.style.setProperty('--primary-color', palette.primary);
          document.documentElement.style.setProperty('--secondary-color', palette.secondary);
      }
      showToast('Configurações salvas!', 'success');
    } catch (error) { showToast('Erro ao salvar', 'error'); }
  };
  
  const handleLogout = () => { localStorage.clear(); window.location.href = '/'; };

  const addBlockedSlot = () => {
      if (!newBlock.date || !newBlock.time) { showToast('Selecione data e hora', 'warning'); return; }
      setSettings(prev => {
          const existingBlockIndex = prev.blockedSlots.findIndex(b => b.date === newBlock.date);
          let newBlockedSlots = [...prev.blockedSlots];
          if (existingBlockIndex >= 0) {
              if (!newBlockedSlots[existingBlockIndex].times.includes(newBlock.time)) {
                  newBlockedSlots[existingBlockIndex] = { ...newBlockedSlots[existingBlockIndex], times: [...newBlockedSlots[existingBlockIndex].times, newBlock.time].sort() };
              }
          } else { newBlockedSlots.push({ date: newBlock.date, times: [newBlock.time] }); }
          return { ...prev, blockedSlots: newBlockedSlots };
      });
      setNewBlock({ ...newBlock, time: '' });
  };

  const removeBlockedSlot = (date, time) => {
      setSettings(prev => {
          const newBlockedSlots = prev.blockedSlots.map(b => {
              if (b.date === date) { return { ...b, times: b.times.filter(t => t !== time) }; }
              return b;
          }).filter(b => b.times.length > 0);
          return { ...prev, blockedSlots: newBlockedSlots };
      });
  };
  
  const renderAppointmentCard = (appointment) => {
    return (
      <div key={appointment._id} style={{ 
        border: selectedAppointments.includes(appointment._id) ? '2px solid #5a67d8' : '2px solid #e2e8f0', 
        borderRadius: '12px', padding: '20px', marginBottom: '15px',
        background: selectedAppointments.includes(appointment._id) ? '#ebf8ff' : 'white',
        transition: 'all 0.3s ease',
        opacity: appointment.status === 'cancelled' || appointment.status === 'pending_cancellation' ? 0.6 : 1,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            {activeTab === 'appointments' && bulkMode && (
              <input type="checkbox" checked={selectedAppointments.includes(appointment._id)} onChange={() => toggleSelection(appointment._id)} style={{ width: '20px', height: '20px', cursor: 'pointer', accentColor: '#5a67d8' }} />
            )}
            <h3 style={{ margin: 0, color: '#2d3748', fontSize: '1.2rem' }}>{appointment.client?.name || 'Cliente sem nome'}</h3>
          </div>
          <span style={{
            padding: '6px 14px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '700',
            background: appointment.status === 'confirmed' ? '#d4edda' : appointment.status === 'scheduled' ? '#fff3cd' : appointment.status === 'completed' ? '#d1ecf1' : appointment.status === 'pending_cancellation' ? '#fff3e0' : '#f8d7da',
            color: appointment.status === 'confirmed' ? '#155724' : appointment.status === 'scheduled' ? '#856404' : appointment.status === 'completed' ? '#0c5460' : appointment.status === 'pending_cancellation' ? '#f57c00' : '#721c24'
          }}>
            {appointment.status === 'scheduled' ? '⏳ AGENDADO' : appointment.status === 'confirmed' ? '✅ CONFIRMADO' : appointment.status === 'completed' ? '✔️ CONCLUÍDO' : appointment.status === 'pending_cancellation' ? '⏳ CANCELANDO...' : '❌ CANCELADO'}
          </span>
        </div>
        <div style={{ color: '#718096', fontSize: '0.95rem', marginBottom: '15px', lineHeight: '1.6' }}>
          <p style={{ margin: '8px 0' }}><strong>📧 Email:</strong> {appointment.client?.email || 'N/A'}</p>
          <p style={{ margin: '8px 0' }}><strong>📱 Telefone:</strong> {appointment.client?.phone || 'N/A'}</p>
          <p style={{ margin: '8px 0' }}><strong>🕐 Horário:</strong> {appointment.startTime} - {appointment.endTime}</p>
          <p style={{ margin: '8px 0' }}><strong>💼 Serviço:</strong> {appointment.service}</p>
          <p style={{ margin: '8px 0' }}><strong>📅 Data:</strong> {new Date(appointment.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</p>
          {appointment.notes && <p style={{ margin: '8px 0' }}><strong>📝 Obs:</strong> {appointment.notes}</p>}
        </div>
        {!bulkMode && (
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {appointment.status === 'scheduled' && <button onClick={() => updateAppointmentStatus(appointment._id, 'confirmed')} className="btn-small" style={{ background: '#48bb78', color: 'white' }}>✓ Confirmar</button>}
            {appointment.status === 'confirmed' && <button onClick={() => updateAppointmentStatus(appointment._id, 'completed')} className="btn-small" style={{ background: '#4299e1', color: 'white' }}>✓ Concluir</button>}
            {!['cancelled','completed','pending_cancellation'].includes(appointment.status) && <button onClick={() => cancelIndividualAppointment(appointment._id)} className="btn-small" style={{ background: '#f56565', color: 'white' }}>✕ Cancelar</button>}
            </div>
        )}
      </div>
    );
  };

  const dashboardTotal = dashboardAppointments.length;
  const dashboardConfirmed = dashboardAppointments.filter(apt => apt.status === 'confirmed').length;
  const dashboardScheduled = dashboardAppointments.filter(apt => apt.status === 'scheduled').length;
  const dashboardCompleted = dashboardAppointments.filter(apt => apt.status === 'completed').length;

  return (
    <div className="admin-panel">
      {undoData && (<div className="admin-modal-overlay"><div className="admin-modal-content"><span className="admin-modal-icon">🗑️</span><h2 className="admin-modal-title">Agendamento(s) Cancelado(s)</h2><div className="admin-modal-details-box"><p className="admin-modal-text">Exclusão permanente em:</p><span className="admin-modal-timer">{undoData.timeLeft}</span><p className="admin-modal-text">segundos</p></div><button onClick={handleUndoAction} className="admin-btn-undo-action">Desfazer Cancelamento</button></div></div>)}

      <div className="page-container">
        <div className="container">
          <div className="main-header">
            <h1>{settings.companyName || 'Agenda Inteligente'}</h1>
            <div>{stats && (<><span className="badge" style={{ background: '#e3f2fd', color: '#1976d2' }}>📅 AGENDADOS (DIA): {activeTab === 'dashboard' ? dashboardTotal : stats.today?.total || 0}</span><span className="badge" style={{ background: '#e8f5e9', color: '#388e3c' }}>✅ CONFIRMADOS (DIA): {activeTab === 'dashboard' ? dashboardConfirmed : stats.today?.confirmed || 0}</span><span className="badge" style={{ background: '#fff3e0', color: '#f57c00' }}>⏳ PENDENTES (TOTAL): {stats.summary?.pendingConfirmation || 0}</span></>)}<button onClick={handleLogout} className="btn btn-secondary">🚪 Sair</button></div>
          </div>
          
          <div className="tabs-container">
            <button className={`tab-button ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>📊 Dashboard</button>
            <button className={`tab-button ${activeTab === 'appointments' ? 'active' : ''}`} onClick={() => setActiveTab('appointments')}>📅 Agendamentos</button>
            <button className={`tab-button ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>⚙️ Configurações</button>
          </div>
          
          <div className="card">
            {activeTab === 'dashboard' && (
              <div>
                <h2 style={{ marginTop: 0, color: '#2d3748' }}>Dashboard - Visão Geral</h2>
                <div style={{ marginBottom: '25px' }}><label className="form-label">Filtrar por data:</label><input type="date" value={dashboardDate} onChange={(e) => setDashboardDate(e.target.value)} className="form-input" style={{ maxWidth: '220px' }} /></div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '35px' }}>
                   <div style={{ background: '#f8f9fc', padding: '25px', borderRadius: '12px', textAlign: 'center', border: '2px solid #e2e8f0' }}><h3 style={{ color: '#5a67d8', fontSize: '2.5rem', margin: '0' }}>{dashboardTotal}</h3><p>Agendamentos na Data</p></div>
                   <div style={{ background: '#e8f5e9', padding: '25px', borderRadius: '12px', textAlign: 'center', border: '2px solid #9ae6b4' }}><h3 style={{ color: '#38a169', fontSize: '2.5rem', margin: '0' }}>{dashboardConfirmed}</h3><p>Confirmados na Data</p></div>
                   <div style={{ background: '#fff3e0', padding: '25px', borderRadius: '12px', textAlign: 'center', border: '2px solid #fbbf24' }}><h3 style={{ color: '#dd6b20', fontSize: '2.5rem', margin: '0' }}>{dashboardScheduled}</h3><p>Aguardando Confirmação</p></div>
                   <div style={{ background: '#e3f2fd', padding: '25px', borderRadius: '12px', textAlign: 'center', border: '2px solid #93c5fd' }}><h3 style={{ color: '#3182ce', fontSize: '2.5rem', margin: '0' }}>{dashboardCompleted}</h3><p>Concluídos na Data</p></div>
                </div>
                <div>{dashboardAppointments.map(apt => renderAppointmentCard(apt))}</div>
              </div>
            )}
            {activeTab === 'appointments' && (
              <div>
                <h2 style={{ marginTop: 0, color: '#2d3748' }}>Agendamentos do dia {new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR')}</h2>
                {bulkMode && selectedAppointments.length > 0 && (<div className="bulk-confirm-bar"><span className="bulk-confirm-text"><span className="bulk-badge">{selectedAppointments.length}</span> selecionados</span><div style={{display:'flex', gap:'10px'}}><button onClick={executeBulkAction} className="btn btn-primary" style={{background: bulkMode === 'cancel' ? '#f56565' : '#48bb78', border: 'none'}}>{bulkMode === 'cancel' ? 'Confirmar Cancelamento' : 'Confirmar Conclusão'}</button></div></div>)}
                <div style={{ display: 'flex', gap: '15px', marginBottom: '25px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div style={{ flex: '1', minWidth: '200px' }}><label className="form-label">Filtrar por data:</label><input type="date" value={selectedDate} onChange={(e) => { setSelectedDate(e.target.value); setSelectedAppointments([]); }} className="form-input" /></div>
                  <div style={{ flex: '1', minWidth: '200px' }}><label className="form-label">Status:</label><select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setSelectedAppointments([]); }} className="form-select"><option value="all">Todos</option><option value="scheduled">Agendados</option><option value="confirmed">Confirmados</option><option value="completed">Concluídos</option><option value="cancelled">Cancelados</option></select></div>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>{!bulkMode ? (<><button onClick={() => startBulkMode('complete')} className="btn btn-small" style={{background: '#48bb78', color: 'white', height: '42px'}}>✅ Concluir Vários</button><button onClick={() => startBulkMode('cancel')} className="btn btn-small" style={{background: '#f56565', color: 'white', height: '42px'}}>❌ Cancelar Vários</button></>) : (<button onClick={cancelBulkMode} className="btn btn-secondary" style={{height: '42px'}}>Cancelar Seleção</button>)}<button onClick={fetchAppointments} className="btn btn-primary" style={{height: '42px'}}>🔄</button></div>
                </div>
                {appointments.map(apt => renderAppointmentCard(apt))}
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="settings-section">
                <h2 style={{ marginTop: 0, color: '#2d3748' }}>Configurações</h2>
                <div className="form-group"><label className="form-label">Nome da Empresa:</label><input type="text" value={settings.companyName} onChange={(e) => setSettings({...settings, companyName: e.target.value})} className="form-input" /></div>
                <div className="form-group"><label className="form-label">Logo:</label><input type="file" accept="image/*" onChange={handleLogoUpload} className="form-input" />{settings.logo && <img src={settings.logo} alt="Logo" className="logo-preview" />}</div>
                
                {/* Gestão de Horários */}
                <div className="settings-group">
                    <h3>⏰ Gestão de Horários</h3>
                    <div className="schedule-row">
                        <div className="schedule-col">
                            <label className="form-label">Início Expediente:</label>
                            <input type="time" value={settings.workingHours.start} onChange={(e) => setSettings(prev => ({...prev, workingHours: {...prev.workingHours, start: e.target.value}}))} className="form-input" />
                        </div>
                        <div className="schedule-col">
                            <label className="form-label">Fim Expediente:</label>
                            <input type="time" value={settings.workingHours.end} onChange={(e) => setSettings(prev => ({...prev, workingHours: {...prev.workingHours, end: e.target.value}}))} className="form-input" />
                        </div>
                    </div>

                    <h4 style={{marginTop:'20px', color:'#2d3748'}}>🚫 Bloquear Horários (Imprevistos/Feriados)</h4>
                    
                    <div className="schedule-actions">
                        <div style={{flex: 1}}>
                            <label className="form-label">Data:</label>
                            <input type="date" value={newBlock.date} onChange={(e) => setNewBlock(prev => ({...prev, date: e.target.value}))} className="form-input" />
                        </div>
                        <div style={{width: '150px'}}>
                            <label className="form-label">Hora:</label>
                            <input type="time" value={newBlock.time} onChange={(e) => setNewBlock(prev => ({...prev, time: e.target.value}))} className="form-input" />
                        </div>
                        <button onClick={addBlockedSlot} className="btn btn-secondary" style={{height: '42px'}}>Adicionar</button>
                    </div>

                    <div className="blocked-list">
                        {settings.blockedSlots && settings.blockedSlots.length > 0 ? (
                            settings.blockedSlots.map((block, idx) => (
                                <div key={idx} className="blocked-item">
                                    <strong style={{color: '#2d3748', fontSize:'0.9rem'}}>{new Date(block.date).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</strong>
                                    <div className="blocked-times">
                                        {block.times.map(time => (
                                            <span key={time} className="time-tag">
                                                {time}
                                                <button onClick={() => removeBlockedSlot(block.date, time)} className="btn-remove-time">×</button>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ))
                        ) : <p style={{color:'#718096', fontStyle:'italic'}}>Nenhum bloqueio ativo.</p>}
                    </div>
                </div>

                {/* Paleta de Cores com correção */}
                <h3>Paleta de Cores</h3>
                <div className="color-palette-options">
                  {Object.entries(COLOR_PALETTES).map(([key, palette]) => (
                    <div 
                      key={key} 
                      className={`color-option ${settings.colorPalette === key ? 'selected' : ''}`} 
                      style={{ background: `linear-gradient(135deg, ${palette.primary} 0%, ${palette.secondary} 100%)` }} 
                      onClick={() => setSettings(prev => ({ ...prev, colorPalette: key }))}
                    >
                      <div className="color-name" style={{ color: 'white' }}>{palette.name}</div>
                    </div>
                  ))}
                </div>
                
                <div className="settings-group" style={{marginTop:'20px'}}><h3>📝 Conteúdo dos Cards</h3><div className="cards-editor">{settings.homePageCards.map((card, index) => (<div key={card.id} className="card-editor"><h4>Card {index + 1}</h4><div className="form-group"><label className="form-label">Título:</label><input type="text" value={card.title} onChange={(e) => handleCardUpdate(card.id, 'title', e.target.value)} className="form-input" /></div><div className="form-group"><label className="form-label">Descrição:</label><textarea value={card.description} onChange={(e) => handleCardUpdate(card.id, 'description', e.target.value)} className="form-textarea" rows="3" /></div></div>))}</div></div>
                
                <div style={{ marginTop: '30px', textAlign: 'right' }}><button onClick={handleSaveSettings} className="btn btn-primary">💾 Salvar</button></div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;