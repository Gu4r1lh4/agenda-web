// client/src/pages/HomePage/HomePage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './HomePage.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// MAPA DE CORES
const COLOR_PALETTES = {
  purple: { name: 'Roxo Profissional', primary: '#5a67d8', secondary: '#4a4fb8' },
  green: { name: 'Verde Natureza', primary: '#48bb78', secondary: '#38a169' },
  blue: { name: 'Azul Confiança', primary: '#4299e1', secondary: '#3182ce' },
  orange: { name: 'Laranja Energia', primary: '#ed8936', secondary: '#dd6b20' },
  pink: { name: 'Rosa Criativo', primary: '#d53f8c', secondary: '#b83280' },
  teal: { name: 'Turquesa Moderno', primary: '#38b2ac', secondary: '#319795' }
};

const HomePage = () => {
  const navigate = useNavigate();
  
  const [settings, setSettings] = useState({
    companyName: 'Agenda Inteligente',
    logo: null,
    homePageCards: [], 
    colorPalette: 'purple'
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await axios.get(`${API_URL}/settings`);
        const data = response.data;
        
        setSettings(prev => ({
          ...prev,
          ...data,
          homePageCards: data.homePageCards || [] 
        }));

        const colorKey = data.colorPalette || 'purple';
        const palette = COLOR_PALETTES[colorKey];
        
        if (palette) {
          document.documentElement.style.setProperty('--primary-color', palette.primary);
          document.documentElement.style.setProperty('--secondary-color', palette.secondary);
        }

      } catch (error) {
        console.error('Erro ao carregar configurações da Home:', error);
      }
    };

    fetchSettings();
  }, []);

  return (
    <div className="homepage-container">
      <section className="hero-section">
        <div className="content">
          
          {/* Logo da Empresa */}
          {settings.logo && (
            <img 
              src={settings.logo} 
              alt="Logo da Empresa" 
              className="company-logo" 
            />
          )}
          
          <h1>Bem-vindo à {settings.companyName}</h1>
          <p>A maneira mais simples e eficiente de gerenciar seus agendamentos.</p>
          
          <div className="button-group">
            {/* --- CORREÇÃO AQUI: Mudei de '/agendar' para '/client' --- */}
            <button className="btn btn-primary" onClick={() => navigate('/client')}>
              📅 Agendar Horário
            </button>
            
            <button className="btn btn-secondary" onClick={() => navigate('/login')}>
              🔐 Área Administrativa
            </button>
          </div>
        </div>
      </section>

      <section className="features-section">
        <h2>Por que nos escolher?</h2>
        <div className="features-grid">
          {settings.homePageCards.length > 0 ? (
            settings.homePageCards.map((card) => (
              <div key={card.id} className="feature-card">
                <h3>{card.title}</h3>
                <p>{card.description}</p>
              </div>
            ))
          ) : (
            <>
              <div className="feature-card">
                <h3>Fácil de Usar</h3>
                <p>Agende seu horário em segundos com nossa interface intuitiva.</p>
              </div>
              <div className="feature-card">
                <h3>Segurança</h3>
                <p>Seus dados estão protegidos com a mais alta tecnologia.</p>
              </div>
              <div className="feature-card">
                <h3>Notificações</h3>
                <p>Receba lembretes automáticos para não perder seu horário.</p>
              </div>
              <div className="feature-card">
                <h3>Flexibilidade</h3>
                <p>Gerencie ou cancele seus agendamentos de forma simples.</p>
              </div>
            </>
          )}
        </div>
      </section>

      <footer className="footer">
        <p>&copy; {new Date().getFullYear()} {settings.companyName}. Todos os direitos reservados.</p>
        <p>
          <a href="#">Termos de Uso</a> | <a href="#">Privacidade</a>
        </p>
      </footer>
    </div>
  );
};

export default HomePage;