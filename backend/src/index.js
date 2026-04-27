require('dotenv').config();
const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const { handleConnection } = require('./websocket/handler');
const { setupPlayerCollection } = require('./db/playerRepository');
const authRoutes  = require('./routes/authRoutes');
const statsRoutes = require('./routes/statsRoutes');

const app = express();
const cors = require('cors');
app.set('trust proxy', 1); // Confía en el proxy de Render para el rate-limit
app.use(cors());
app.use(express.json());

app.use('/api/auth',  authRoutes);
app.use('/api/stats', statsRoutes);

// Initialize DB
setupPlayerCollection().catch(err => console.error('Error Mongo:', err.message));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', game: 'Dado Triple' });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  handleConnection(ws, req, wss);
});

const os = require('os');

function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push({ name, address: iface.address });
      }
    }
  }
  return ips;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  const ips = getLocalIPs();
  console.log('\n🎲 ─────────────────────────────────────────');
  console.log('   Dado Triple — El Plan del Diablo T2');
  console.log('─────────────────────────────────────────');
  console.log(`   Puerto:    ${PORT}`);
  console.log(`   Local:     ws://localhost:${PORT}`);

  if (ips.length > 0) {
    console.log('\n   Desde otros dispositivos (misma red WiFi):');
    ips.forEach(({ name, address }) => {
      console.log(`   ${name.padEnd(18)} ws://${address}:${PORT}`);
    });
    console.log('\n   📱 Copia esta línea en socketService.js:');
    console.log(`   const WS_URL = 'ws://${ips[0].address}:${PORT}';`);
  } else {
    console.log('   ⚠  No se detectaron interfaces de red locales');
  }
  console.log('─────────────────────────────────────────\n');
});