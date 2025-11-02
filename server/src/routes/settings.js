// server/src/routes/settings.js
const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { protect } = require('../middleware/auth');

// GET - Buscar configurações (pública)
router.get('/', settingsController.getSettings);

// PUT - Atualizar configurações (protegida - apenas admin)
router.put('/', protect, settingsController.updateSettings);

module.exports = router;