// client/src/pages/HomePage/HomePage.jsx

import React from 'react';
import { Link } from 'react-router-dom';
import './HomePage.css';

const HomePage = () => {
  return (
    <div className="homepage-container">
      {/* Seção Principal */}
      <header className="hero-section">
        <div className="content">
          <h1>Bem-vindo ao Sistema de Agendamento</h1>
          <p>Agende e gerencie seus horários de forma rápida e fácil.</p>
          <div className="button-group">
            <Link to="/client" className="btn btn-primary"> {/* MODIFICADO */}
              Agendar ou Consultar Horário
            </Link>
            <Link to="/login" className="btn btn-secondary">
              Acesso Administrativo
            </Link>
          </div>
        </div>
      </header>

      {/* CORREÇÃO: Seção "Por que escolher" foi restaurada */}
      <section className="features-section">
        <h2>Por que escolher nosso sistema?</h2>
        <div className="features-grid">
          <div className="feature-card">
            <h3>Fácil de Usar</h3>
            <p>Interface intuitiva tanto para o cliente quanto para o administrador.</p>
          </div>
          <div className="feature-card">
            <h3>Notificações Automáticas</h3>
            <p>Envio de lembretes e confirmações por e-mail para reduzir faltas.</p>
          </div>
          <div className="feature-card">
            <h3>Painel Administrativo</h3>
            <p>Visão completa dos agendamentos, com estatísticas e gerenciamento fácil.</p>
          </div>
          <div className="feature-card">
            <h3>Flexível e Customizável</h3>
            <p>Adapte o sistema com suas cores, serviços e horários de atendimento.</p>
          </div>
        </div>
      </section>

      {/* Rodapé */}
      <footer className="footer">
        <p>&copy; 2024 Seu Nome ou Nome da Empresa. Todos os direitos reservados.</p>
        <p>
          <a href="#privacy">Política de Privacidade</a> | 
          <a href="#terms">Termos de Serviço</a>
        </p>
      </footer>
    </div>
  );
};

export default HomePage;