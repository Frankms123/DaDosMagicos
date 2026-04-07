const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Routes
// app.use('/api/auth', authRoutes);

app.get('/', (req, res) => {
  res.send('Dado Triple API is running');
});

module.exports = app;
