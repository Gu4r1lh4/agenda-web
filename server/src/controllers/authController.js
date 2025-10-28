// server/src/controllers/authController.js
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Função de Login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Validar entrada
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'E-mail e senha são obrigatórios.' });
    }

    // 2. Encontrar usuário
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Credenciais inválidas.' });
    }

    // 3. Comparar senha
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Credenciais inválidas.' });
    }

    // 4. Gerar JWT
    const payload = {
      id: user._id,
      role: user.role
    };

    // Use uma variável de ambiente para seu segredo JWT em produção!
    const secret = process.env.JWT_SECRET || 'seu-segredo-jwt-temporario';
    
    const token = jwt.sign(payload, secret, {
      expiresIn: '7d' // Token expira em 7 dias
    });

    // 5. Enviar resposta
    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
  }
};