const express = require('express');
const { registerPlayer, loginPlayer } = require('../controllers/authController');
const rateLimit = require('express-rate-limit');

const router = express.Router();

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 5, 
  message: { error: 'Demasiadas solicitudes de registro creadas desde esta IP, por favor inténtelo de nuevo después de 15 minutos' },
  standardHeaders: true,
  legacyHeaders: false,
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 10, 
  message: { error: 'Demasiados intentos de inicio de sesión desde esta IP, por favor inténtelo de nuevo después de 15 minutos' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/register', registerLimiter, registerPlayer);
router.post('/login', loginLimiter, loginPlayer);

module.exports = router;
