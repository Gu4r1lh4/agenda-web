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
      
      console.log('🔑 Token recebido:', token.substring(0, 20) + '...');

      // Verificar token
      const secret = process.env.JWT_SECRET || 'secret';
      const decoded = jwt.verify(token, secret);
      
      console.log('✅ Token válido. User ID:', decoded.userId || decoded.id);

      // Anexar o usuário à requisição (sem a senha)
      req.user = await User.findById(decoded.userId || decoded.id).select('-password');
      
      // Se for o admin hardcoded, cria um objeto de usuário fictício
      if (!req.user && (decoded.userId === 'admin' || decoded.id === 'admin')) {
        req.user = {
          _id: 'admin',
          role: 'admin',
          name: 'Administrador'
        };
        console.log('✅ Admin hardcoded autenticado');
      }
      
      if (!req.user) {
         console.log('❌ Usuário não encontrado no banco');
         return res.status(401).json({ success: false, message: 'Usuário não encontrado.' });
      }

      next();
    } catch (error) {
      console.error('❌ Erro de autenticação:', error.message);
      return res.status(401).json({ success: false, message: 'Não autorizado, token inválido.' });
    }
  }

  if (!token) {
    console.log('❌ Nenhum token fornecido');
    return res.status(401).json({ success: false, message: 'Não autorizado, sem token.' });
  }
};

// Middleware para anexar usuário (não exige autenticação)
// Usado para rotas que se comportam de forma diferente se o usuário estiver logado
exports.attachUser = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const secret = process.env.JWT_SECRET || 'secret';
      const decoded = jwt.verify(token, secret);
      req.user = await User.findById(decoded.userId || decoded.id).select('-password');
      
      // Admin hardcoded
      if (!req.user && (decoded.userId === 'admin' || decoded.id === 'admin')) {
        req.user = {
          _id: 'admin',
          role: 'admin',
          name: 'Administrador'
        };
      }
    } catch (error) {
      // Se o token for inválido ou expirado, apenas não anexa o usuário
      req.user = null;
    }
  }
  
  next();
};