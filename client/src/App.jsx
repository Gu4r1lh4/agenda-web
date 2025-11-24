// client/src/App.js - MODIFICAÇÃO NECESSÁRIA
import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { ToastProvider } from './utils/useToast'; // ADICIONAR ESTA LINHA
import HomePage from './pages/HomePage/HomePage';
import ClientView from './pages/ClientView/ClientView';
import Login from './pages/Login/Login';
import AdminPanel from './pages/AdminPanel/AdminPanel';
import './App.css';

function App() {
  return (
    <ToastProvider> {/* ENVOLVER TODO O APP COM ToastProvider */}
      <Router>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/client" element={<ClientView />} />
          <Route path="/login" element={<Login />} />
          <Route path="/admin" element={<AdminPanel />} />
        </Routes>
      </Router>
    </ToastProvider>
  );
}

export default App;