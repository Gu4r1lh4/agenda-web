// client/src/pages/Login/Login.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Login.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const Login = () => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

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
        // IMPORTANTE: Salva o token no localStorage
        localStorage.setItem('adminToken', response.data.token);
        localStorage.setItem('token', response.data.token); // Backup
        localStorage.setItem('isAdmin', 'true');
        
        console.log('✅ Token salvo com sucesso:', response.data.token.substring(0, 20) + '...');
        
        // Redireciona para o painel admin
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