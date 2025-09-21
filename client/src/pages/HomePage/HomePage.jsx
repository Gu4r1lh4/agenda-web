// src/pages/HomePage/HomePage.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './HomePage.css';

const HomePage = () => {
  const navigate = useNavigate();
  const [companyName, setCompanyName] = useState('Agenda Inteligente');
  const [primaryColor, setPrimaryColor] = useState('#4CAF50');
  
  useEffect(() => {
    // Busca as configurações da empresa
    fetch('http://localhost:5000/api/settings')
      .then(res => res.json())
      .then(data => {
        setCompanyName(data.companyName);
        setPrimaryColor(data.primaryColor);
        // Aplica a cor customizada
        document.documentElement.style.setProperty('--primary-color', data.primaryColor);
      })
      .catch(err => console.log('Usando configurações padrão'));
  }, []);

  return (
    <div className="home-page">
      <div className="home-container">
        <div className="welcome-section">
          <h1 className="welcome-title">
            Bem-vindo ao {companyName}
          </h1>
          <p className="welcome-subtitle">
            Sistema inteligente de agendamentos online com atualizações em tempo real
          </p>
        </div>

        <div className="access-cards">
          <div className="access-card client-card">
            <div className="card-icon">
              <svg width="80" height="80" viewBox="0 0 24 24" fill="none">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" fill={primaryColor}/>
              </svg>
            </div>
            <h2>Área do Cliente</h2>
            <p className="card-description">
              Faça seu agendamento de forma rápida e simples. 
              Escolha o melhor horário para você!
            </p>
            <button 
              className="btn btn-primary btn-large"
              onClick={() => navigate('/client')}
            >
              Fazer Agendamento
            </button>
          </div>

          <div className="access-card admin-card">
            <div className="card-icon">
              <svg width="80" height="80" viewBox="0 0 24 24" fill="none">
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" fill="#764ba2"/>
              </svg>
            </div>
            <h2>Área Administrativa</h2>
            <p className="card-description">
              Gerencie agendamentos, configure horários e 
              personalize o sistema da sua empresa.
            </p>
            <button 
              className="btn btn-secondary btn-large"
              onClick={() => navigate('/login')}
            >
              Acesso Administrativo
            </button>
          </div>
        </div>

        <div className="features-section">
          <h3>Por que escolher nosso sistema?</h3>
          <div className="features-grid">
            <div className="feature">
              <span className="feature-icon">⚡</span>
              <h4>Tempo Real</h4>
              <p>Atualizações instantâneas para todos os usuários</p>
            </div>
            <div className="feature">
              <span className="feature-icon">🎨</span>
              <h4>Customizável</h4>
              <p>Personalize cores, logo e serviços</p>
            </div>
            <div className="feature">
              <span className="feature-icon">📱</span>
              <h4>Responsivo</h4>
              <p>Funciona em qualquer dispositivo</p>
            </div>
            <div className="feature">
              <span className="feature-icon">🔒</span>
              <h4>Seguro</h4>
              <p>Seus dados protegidos e criptografados</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;