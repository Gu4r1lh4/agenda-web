// routes/auth.js
const express = require('express');
const router = express.Router();

router.post('/login', async (req, res) => {
  // Lógica de login aqui
  res.json({ token: 'jwt-token-aqui' });
});

module.exports = router;