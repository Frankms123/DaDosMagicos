require('dotenv').config();
const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const { handleConnection } = require('./websocket/handler');
 
const app = express();
app.use(express.json());
 
// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', game: 'Dado Triple' });
});
 
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
 
wss.on('connection', (ws, req) => {
  handleConnection(ws, req, wss);
});
 
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🎲 Dado Triple server corriendo en puerto ${PORT}`);
});