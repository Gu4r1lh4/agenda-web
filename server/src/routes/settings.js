// routes/settings.js
const express = require('express');
const router = express.Router();

router.get('/', async (req, res) => {
  // Retorna configurações
  res.json({
    companyName: 'Agenda Inteligente',
    primaryColor: '#4CAF50',
    services: ['Consulta', 'Retorno']
  });
});

module.exports = router;