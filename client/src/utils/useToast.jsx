// src/utils/useToast.jsx
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import './Toast.css'; // Importando o CSS que você forneceu

const ToastContext = createContext();

// --- Componente Visual Interno (Substitui o import './Toast') ---
const ToastComponent = ({ message, type, duration, onClose, action }) => {
  useEffect(() => {
    // Lógica para o toast sumir sozinho após a duração
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div className={`toast toast-${type}`}>
      <div className="toast-content">
        <span className="toast-message">{message}</span>
        {action && (
          <button 
            className="toast-action" 
            onClick={(e) => {
              e.stopPropagation();
              action.onClick();
            }}
          >
            {action.label}
          </button>
        )}
      </div>
      <button className="toast-close" onClick={onClose}>&times;</button>
    </div>
  );
};

// --- Provider ---
export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'info', options = {}) => {
    const id = Date.now();
    const newToast = {
      id,
      message,
      type,
      duration: options.duration || 5000,
      action: options.action
    };
    
    setToasts(prev => [...prev, newToast]);
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, removeToast }}>
      {children}
      <div className="toast-container">
        {toasts.map((toast, index) => (
          <div key={toast.id} style={{ marginBottom: index > 0 ? '10px' : '0' }}>
            <ToastComponent
              message={toast.message}
              type={toast.type}
              duration={toast.duration}
              action={toast.action}
              onClose={() => removeToast(toast.id)}
            />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

// --- Hook ---
export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};