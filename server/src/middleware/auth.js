// server/src/middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware para proteger rotas (exige autenticação)
exports.protect = async (req, res, next) => {
  let token;

  // Verificar se o token está no cabeçalho Authorization
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Obter token (Bearer <token>)
      token = req.headers.authorization.split(' ')[1];
      
      // Verificar token
      const secret = process.env.JWT_SECRET || 'secret';
      const decoded = jwt.verify(token, secret);
      
      // Unifica a forma de pegar o ID (pode vir como userId ou id)
      const id = decoded.userId || decoded.id;

      console.log('✅ Token recebido para ID:', id);

      // --- CORREÇÃO PRINCIPAL AQUI ---
      // 1. Primeiro verificamos se é o admin hardcoded.
      // Se for, montamos o objeto e damos next() IMEDIATAMENTE.
      // Isso evita que o código tente buscar "admin" no MongoDB (que causaria o erro de Cast)
      if (id === 'admin' || decoded.role === 'admin') {
        req.user = {
          _id: 'admin',
          role: 'admin',
          name: 'Administrador'
        };
        console.log('✅ Admin hardcoded autenticado (bypass DB)');
        return next(); // Importante: encerra a execução aqui
      }

      // 2. Se não for admin, aí sim buscamos no banco
      req.user = await User.findById(id).select('-password');
      
      if (!req.user) {
         console.log('❌ Usuário não encontrado no banco');
         return res.status(401).json({ success: false, message: 'Usuário não encontrado.' });
      }

      next();
    } catch (error) {
      console.error('❌ Erro de autenticação:', error.message);
      return res.status(401).json({ success: false, message: 'Não autorizado, token inválido.' });
    }
  } else {
    if (!token) {
      console.log('❌ Nenhum token fornecido');
      return res.status(401).json({ success: false, message: 'Não autorizado, sem token.' });
    }
  }
};

// Middleware para anexar usuário (não exige autenticação)
exports.attachUser = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const secret = process.env.JWT_SECRET || 'secret';
      const decoded = jwt.verify(token, secret);
      const id = decoded.userId || decoded.id;

      // --- MESMA CORREÇÃO AQUI ---
      if (id === 'admin' || decoded.role === 'admin') {
        req.user = {
          _id: 'admin',
          role: 'admin',
          name: 'Administrador'
        };
      } else {
        // Só busca no banco se for um ID de verdade
        req.user = await User.findById(id).select('-password');
      }
    } catch (error) {
      // Se o token for inválido ou expirado, apenas não anexa o usuário
      req.user = null;
    }
  }
  
  next();
};