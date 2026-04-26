const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');
const { createPlayer, getPlayerByEmail } = require('../db/playerRepository');

const transporter = nodemailer.createTransport({
  host: "smtp.ethereal.email",
  port: 587,
  secure: false,
  auth: {
    user: "test@ethereal.email",
    pass: "testpass"
  }
});

const registerPlayer = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Datos de entrada inválidos.' });
    }

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Formato de correo electrónico inválido.' });
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({ error: 'La contraseña no cumple los requisitos mínimos de seguridad.' });
    }

    const existingPlayer = await getPlayerByEmail(email);
    if (existingPlayer) {
      return res.status(409).json({ error: 'El correo electrónico ya está registrado.' });
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const playerId = uuidv4();
    await createPlayer({
      id: playerId,
      name,
      email,
      password: hashedPassword
    });

    try {
      await transporter.sendMail({
        from: '"Dado Triple" <noreply@dadotriple.com>',
        to: email,
        subject: "Confirmación de Registro - Dado Triple",
        text: `Hola ${name},\n\nGracias por registrarte en Dado Triple. Tu cuenta ha sido creada exitosamente.\n\nSaludos,\nEl equipo de Dado Triple`,
        html: `<p>Hola <b>${name}</b>,</p><p>Gracias por registrarte en Dado Triple. Tu cuenta ha sido creada exitosamente.</p><br><p>Saludos,<br>El equipo de Dado Triple</p>`
      });
      console.log(`Correo de confirmación enviado a: ${email}`);
    } catch (mailError) {
      console.error('Error al enviar correo, continuando de todos modos:', mailError.message);
    }

    res.status(201).json({ 
      message: 'Registro exitoso.',
      user: {
        id: playerId,
        name,
        email
      }
    });

  } catch (error) {
    console.error(' Error en registerPlayer:', error);
    res.status(500).json({ error: 'Error interno del servidor. Por favor, inténtelo de nuevo más tarde.' });
  }
};

const loginPlayer = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Datos de entrada inválidos.' });
    }

    if (!email || !password) {
      return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
    }

    const player = await getPlayerByEmail(email);
    if (!player) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    const isMatch = await bcrypt.compare(password, player.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    res.status(200).json({
      message: 'Login exitoso.',
      user: {
        id: player.id,
        name: player.name,
        email: player.email
      }
    });
  } catch (error) {
    console.error('Error en loginPlayer:', error);
    res.status(500).json({ error: 'Error interno del servidor. Por favor, inténtelo de nuevo más tarde.' });
  }
};

module.exports = { registerPlayer, loginPlayer };
