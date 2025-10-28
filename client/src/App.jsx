// src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage/HomePage';
import ClientView from './pages/ClientView/ClientView';
import AdminPanel from './pages/AdminPanel/AdminPanel';
import Login from './pages/Login/Login'; // (Admin Login)
// import ClientLogin from './pages/ClientLogin/ClientLogin'; // REMOVIDO
import './styles/global.css'; // Importa os estilos unificados

// Componente para proteger rotas administrativas
const ProtectedRoute = ({ children }) => {
  const isAdmin = localStorage.getItem('isAdmin') === 'true';
  return isAdmin ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <Router>
      <Routes>
        {/* Página inicial com duas opções */}
        <Route path="/" element={<HomePage />} />
        
        {/* Área do cliente */}
        <Route path="/client" element={<ClientView />} />
        
        {/* Login do Cliente - ROTA REMOVIDA */}
        {/* <Route path="/client-login" element={<ClientLogin />} /> */}

        {/* Login administrativo (agora separado) */}
        <Route path="/login" element={<Login />} />
        
        {/* Painel administrativo (protegido) */}
        <Route 
          path="/admin" 
          element={
            <ProtectedRoute>
              <AdminPanel />
            </ProtectedRoute>
          } 
        />
        
        {/* Redireciona qualquer rota não encontrada para home */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;