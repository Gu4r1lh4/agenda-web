// server/src/utils/seed.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
require('dotenv').config({ path: '../../.env' }); // Carrega .env da raiz

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/agenda-web';

const seedUsers = [
  {
    name: 'Cliente A Teste',
    email: 'clienteA@teste.com',
    password: '123456',
    role: 'client'
  },
  {
    name: 'Cliente B Teste',
    email: 'clienteB@teste.com',
    password: '123456',
    role: 'client'
  },
  {
    name: 'Admin Teste',
    email: 'admin@teste.com',
    password: 'admin123', // Senha para o login de admin existente
    role: 'admin'
  }
];

const seedDB = async () => {
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('Conectado ao MongoDB para seeding...');

    // Limpar usuários existentes (cuidado em produção!)
    // await User.deleteMany({ email: { $in: seedUsers.map(u => u.email) } });
    // console.log('Usuários antigos de teste removidos.');

    for (const userData of seedUsers) {
        const existingUser = await User.findOne({ email: userData.email });
        if (existingUser) {
            console.log(`Usuário ${userData.email} já existe. Pulando.`);
            // Opcional: atualizar senha se necessário
            // existingUser.password = userData.password;
            // await existingUser.save();
            // console.log(`Senha do usuário ${userData.email} atualizada.`);
        } else {
            // Usuário não existe, vamos criar
            // O hash da senha será feito pelo hook 'pre-save' no Model
            const user = new User(userData);
            await user.save();
            console.log(`Usuário ${userData.email} criado com sucesso.`);
        }
    }

    console.log('Seeding concluído!');
  } catch (error) {
    console.error('Erro durante o seeding:', error);
  } finally {
    mongoose.connection.close();
  }
};

seedDB();