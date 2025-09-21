// client/src/hooks/useRealTimeUpdate.js
// Hook customizado para gerenciar atualizações em tempo real via WebSocket
// Este é o coração do sistema de tempo real

import { useEffect, useState, useCallback } from 'react';
import io from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

/**
 * Hook para conectar e gerenciar atualizações em tempo real
 * @param {Function} onUpdate - Callback chamado quando há uma atualização
 * @returns {Object} - Estado da conexão e funções para emitir eventos
 */
const useRealTimeUpdate = (onUpdate) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  
  // Conecta ao servidor WebSocket
  useEffect(() => {
    console.log('🔌 Conectando ao WebSocket...');
    
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    
    // Eventos de conexão
    newSocket.on('connect', () => {
      console.log('✅ Conectado ao servidor em tempo real');
      setConnected(true);
    });
    
    newSocket.on('disconnect', () => {
      console.log('❌ Desconectado do servidor');
      setConnected(false);
    });
    
    // Recebe atualizações de agendamento
    newSocket.on('appointment-update', (update) => {
      console.log('📨 Atualização recebida:', update);
      setLastUpdate(update);
      
      // Chama o callback se fornecido
      if (onUpdate) {
        onUpdate(update);
      }
      
      // Mostra notificação visual (opcional)
      showNotification(update);
    });
    
    // Erro de conexão
    newSocket.on('connect_error', (error) => {
      console.error('Erro de conexão:', error.message);
    });
    
    setSocket(newSocket);
    
    // Cleanup na desmontagem
    return () => {
      console.log('🔌 Desconectando WebSocket...');
      newSocket.close();
    };
  }, [onUpdate]);
  
  // Emite evento de criação de agendamento
  const emitAppointmentCreated = useCallback((appointment) => {
    if (socket && connected) {
      socket.emit('appointment-created', appointment);
      console.log('📤 Emitido: appointment-created');
    }
  }, [socket, connected]);
  
  // Emite evento de cancelamento
  const emitAppointmentCancelled = useCallback((appointmentId) => {
    if (socket && connected) {
      socket.emit('appointment-cancelled', appointmentId);
      console.log('📤 Emitido: appointment-cancelled');
    }
  }, [socket, connected]);
  
  // Emite evento de reagendamento
  const emitAppointmentRescheduled = useCallback((data) => {
    if (socket && connected) {
      socket.emit('appointment-rescheduled', data);
      console.log('📤 Emitido: appointment-rescheduled');
    }
  }, [socket, connected]);
  
  // Função auxiliar para mostrar notificação
  const showNotification = (update) => {
    // Verifica se o navegador suporta notificações
    if (!('Notification' in window)) {
      return;
    }
    
    // Verifica permissão
    if (Notification.permission === 'granted') {
      let title = '';
      let body = '';
      
      switch(update.type) {
        case 'created':
          title = '🆕 Novo Agendamento';
          body = `${update.appointment?.client?.name} agendou um horário`;
          break;
        case 'cancelled':
          title = '❌ Agendamento Cancelado';
          body = 'Um agendamento foi cancelado';
          break;
        case 'rescheduled':
          title = '📅 Agendamento Alterado';
          body = 'Um agendamento foi reagendado';
          break;
        default:
          return;
      }
      
      new Notification(title, {
        body,
        icon: '/favicon.ico',
        tag: 'appointment-update',
        requireInteraction: false
      });
    } else if (Notification.permission !== 'denied') {
      // Pede permissão se ainda não foi negada
      Notification.requestPermission();
    }
  };
  
  return {
    connected,
    lastUpdate,
    emitAppointmentCreated,
    emitAppointmentCancelled,
    emitAppointmentRescheduled,
    socket
  };
};

export default useRealTimeUpdate;

// Exemplo de uso:
/*
import useRealTimeUpdate from './hooks/useRealTimeUpdate';

function MyComponent() {
  const handleUpdate = (update) => {
    // Faz algo quando recebe uma atualização
    console.log('Recebi update:', update);
    // Atualiza estado local, recarrega dados, etc
  };
  
  const {
    connected,
    lastUpdate,
    emitAppointmentCreated,
    emitAppointmentCancelled
  } = useRealTimeUpdate(handleUpdate);
  
  return (
    <div>
      {connected ? '🟢 Online' : '🔴 Offline'}
      {lastUpdate && <p>Última atualização: {lastUpdate.type}</p>}
    </div>
  );
}
*/