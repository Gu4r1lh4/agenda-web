// server/src/controllers/authController.js
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Função de Login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('🔐 Tentativa de login:', email);

    // 1. Validar entrada
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'E-mail e senha são obrigatórios.' });
    }

    // Login hardcoded para admin (compatibilidade)
    if (email === 'admin' && password === 'admin123') {
      const secret = process.env.JWT_SECRET || 'secret';
      const token = jwt.sign(
        { userId: 'admin', role: 'admin' },
        secret,
        { expiresIn: '7d' }
      );

      console.log('✅ Login admin hardcoded bem-sucedido');
      console.log('🔑 Token gerado:', token.substring(0, 20) + '...');

      return res.status(200).json({
        success: true,
        token,
        user: {
          id: 'admin',
          name: 'Administrador',
          email: 'admin@admin.com',
          role: 'admin'
        }
      });
    }

    // 2. Encontrar usuário no banco
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      console.log('❌ Usuário não encontrado:', email);
      return res.status(401).json({ success: false, message: 'Credenciais inválidas.' });
    }

    // 3. Comparar senha
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      console.log('❌ Senha incorreta para:', email);
      return res.status(401).json({ success: false, message: 'Credenciais inválidas.' });
    }

    // 4. Gerar JWT
    const payload = {
      userId: user._id,
      role: user.role
    };

    const secret = process.env.JWT_SECRET || 'secret';
    
    const token = jwt.sign(payload, secret, {
      expiresIn: '7d' // Token expira em 7 dias
    });

    console.log('✅ Login bem-sucedido:', email);
    console.log('🔑 Token gerado:', token.substring(0, 20) + '...');

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
    console.error('❌ Erro no login:', error);
    res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
  }
};

// --- FUNÇÃO DE REGISTRO ---

// Função de Registro
exports.register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    console.log('📝 Tentativa de registro:', email);

    // 1. Validar entrada
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Nome, e-mail e senha são obrigatórios.' });
    }

    // 2. Verificar se o usuário já existe
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      console.log('❌ Usuário já existe:', email);
      return res.status(400).json({ success: false, message: 'Este e-mail já está em uso.' });
    }

    // 3. Criar novo usuário (o hash da senha deve ser feito pelo Mongoose no Model)
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      role // 'user', 'admin', etc.
    });

    // 4. Gerar JWT (mesma lógica do login)
    const payload = {
      userId: user._id,
      role: user.role
    };
    
    const secret = process.env.JWT_SECRET || 'secret';
    const token = jwt.sign(payload, secret, {
      expiresIn: '7d'
    });

    console.log('✅ Registro bem-sucedido:', email);

    // 5. Enviar resposta
    res.status(201).json({ // 201 Created
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
    console.error('❌ Erro no registro:', error);
    // Verifica erros de validação do Mongoose
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({ success: false, message: messages.join('. ') });
    }
    res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
  }
};