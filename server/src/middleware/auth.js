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
      const secret = process.env.JWT_SECRET || 'seu-segredo-jwt-temporario';
      const decoded = jwt.verify(token, secret);

      // Anexar o usuário à requisição (sem a senha)
      req.user = await User.findById(decoded.id).select('-password');
      
      if (!req.user) {
         return res.status(401).json({ success: false, message: 'Usuário não encontrado.' });
      }

      next();
    } catch (error) {
      console.error('Erro de autenticação:', error.message);
      return res.status(401).json({ success: false, message: 'Não autorizado, token inválido.' });
    }
  }

  if (!token) {
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
      const secret = process.env.JWT_SECRET || 'seu-segredo-jwt-temporario';
      const decoded = jwt.verify(token, secret);
      req.user = await User.findById(decoded.id).select('-password');
    } catch (error) {
      // Se o token for inválido ou expirado, apenas não anexa o usuário
      req.user = null;
    }
  }
  
  next();
};