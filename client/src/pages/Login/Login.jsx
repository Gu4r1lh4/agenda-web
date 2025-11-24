// client/src/pages/Login/Login.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Login.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// MAPA DE CORES (Para traduzir a configuração do banco para Hexadecimal)
const COLOR_PALETTES = {
  purple: { name: 'Roxo Profissional', primary: '#5a67d8', secondary: '#4a4fb8' },
  green: { name: 'Verde Natureza', primary: '#48bb78', secondary: '#38a169' },
  blue: { name: 'Azul Confiança', primary: '#4299e1', secondary: '#3182ce' },
  orange: { name: 'Laranja Energia', primary: '#ed8936', secondary: '#dd6b20' },
  pink: { name: 'Rosa Criativo', primary: '#d53f8c', secondary: '#b83280' },
  teal: { name: 'Turquesa Moderno', primary: '#38b2ac', secondary: '#319795' }
};

const Login = () => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // --- NOVO: Busca as configurações para aplicar a cor correta ---
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await axios.get(`${API_URL}/settings`);
        const settings = response.data;
        
        if (settings.colorPalette) {
          const palette = COLOR_PALETTES[settings.colorPalette];
          if (palette) {
            document.documentElement.style.setProperty('--primary-color', palette.primary);
            document.documentElement.style.setProperty('--secondary-color', palette.secondary);
          }
        }
      } catch (err) {
        console.error('Erro ao carregar tema:', err);
        // Se falhar, mantém o padrão (Roxo) definido no CSS :root
      }
    };

    fetchSettings();
  }, []);
  // --------------------------------------------------------------

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await axios.post(`${API_URL}/auth/login`, {
        email: 'admin',
        password: password
      });

      if (response.data.token) {
        localStorage.setItem('adminToken', response.data.token);
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('isAdmin', 'true');
        
        console.log('✅ Token salvo com sucesso');
        
        navigate('/admin');
      } else {
        setError('Erro ao fazer login');
      }
    } catch (err) {
      console.error('Erro no login:', err);
      setError(err.response?.data?.error || 'Senha incorreta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h2>Área Administrativa</h2>
        
        {error && <div className="error-message">{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            className="login-input"
            placeholder="Digite a senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            required
          />
          
          <button 
            type="submit" 
            className="login-button"
            disabled={loading}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
        
        <div className="hint">
          <strong>Dica:</strong> admin123
        </div>
      </div>
    </div>
  );
};

export default Login;