// server/src/utils/seed.js
const mongoose = require('mongoose');
const User = require('../models/User'); 
require('dotenv').config({ path: '../../.env' }); 

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
    password: 'admin123',
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

    // ADICIONADO: Apaga os usuários de teste antigos
    const emailsToReset = seedUsers.map(u => u.email);
    await User.deleteMany({ email: { $in: emailsToReset } });
    console.log('Usuários de teste antigos removidos.');


    for (const userData of seedUsers) {
        // O hash da senha será feito pelo hook 'pre-save' no Model
        const user = new User(userData);
        await user.save();
        console.log(`Usuário ${userData.email} criado com sucesso (com hash).`);
    }

    console.log('Seeding concluído!');
  } catch (error) {
    console.error('Erro durante o seeding:', error);
  } finally {
    mongoose.connection.close();
  }
};

seedDB();