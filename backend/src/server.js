const http = require('http');
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']); // Forzar DNS de Google para resolver Atlas
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const app = require('./app');
const dotenv = require('dotenv');

dotenv.config();

const PORT = process.env.PORT || 3002;
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://DadosUser:Bolachile200@dadosmagicos.s78oqlm.mongodb.net/dadotriple?retryWrites=true&w=majority&appName=DaDosMagicos';

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

// Import WebSocket logic
const socketHandler = require('./gateway/socketHandler');
socketHandler(io);

// Connection to MongoDB
mongoose.connect(MONGO_URI, {
  serverSelectionTimeoutMS: 5000,
  family: 4
})
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Error connecting to MongoDB:', err));

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
