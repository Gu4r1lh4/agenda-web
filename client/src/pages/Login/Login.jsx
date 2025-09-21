import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Login.css';

const Login = () => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    // Senha simples para demo - em produção use JWT
    if (password === 'admin123') {
      localStorage.setItem('isAdmin', 'true');
      navigate('/admin');
    } else {
      setError('Senha incorreta');
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h2>Área Administrativa</h2>
        <form onSubmit={handleLogin}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Digite a senha"
            className="login-input"
          />
          {error && <p className="error-message">{error}</p>}
          <button type="submit" className="login-button">
            Entrar
          </button>
        </form>
        <p className="hint">Dica: admin123</p>
      </div>
    </div>
  );
};

export default Login;