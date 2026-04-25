/**
 * test-full-game.js
 * Simula una partida completa de 2 jugadores × 3 rondas
 * para verificar que el resultado queda guardado en MongoDB.
 *
 * Uso:
 *   1. npm run dev  (servidor corriendo)
 *   2. node test-full-game.js
 */

const WebSocket = require('ws');

const SERVER_URL = 'ws://169.254.83.107:3000';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createClient(name) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(SERVER_URL);
    ws._name = name;
    // Cola FIFO por tipo de evento: los resolve se acumulan en orden
    ws._queue = {};

    ws.on('open', () => resolve(ws));
    ws.on('error', reject);

    ws.on('message', (raw) => {
      const msg = JSON.parse(raw);
      const q = ws._queue[msg.type];
      if (q && q.length > 0) {
        // Entregar al primero que esté esperando
        q.shift()(msg.payload);
      }
      // Si nadie espera, el evento se descarta (no importa aquí)
    });
  });
}

function send(ws, type, payload = {}) {
  ws.send(JSON.stringify({ type, payload }));
}

/**
 * Encola una promesa para el próximo evento del tipo dado.
 * SIEMPRE llamar ANTES de enviar el mensaje que dispara el evento.
 */
function waitFor(ws, eventType, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    ws._queue[eventType] = ws._queue[eventType] || [];

    let fulfilled = false;

    const timer = setTimeout(() => {
      if (!fulfilled) {
        fulfilled = true;
        // Sacar de la cola
        ws._queue[eventType] = (ws._queue[eventType] || []).filter(r => r !== wrappedResolve);
        reject(new Error(`[${ws._name}] Timeout esperando "${eventType}"`));
      }
    }, timeoutMs);

    const wrappedResolve = (payload) => {
      if (!fulfilled) {
        fulfilled = true;
        clearTimeout(timer);
        resolve(payload);
      }
    };

    ws._queue[eventType].push(wrappedResolve);
  });
}

function log(symbol, msg) {
  console.log(`  ${symbol} ${msg}`);
}

// ─── Lógica de una ronda ──────────────────────────────────────────────────────

async function jugarRonda(wsAlice, wsBob, numRonda) {
  log('🎲', `--- Ronda ${numRonda} ---`);

  // Registrar round_started de la SIGUIENTE ronda antes de que termine esta
  // (el servidor la emite ~3s después de round_ended, no podemos perderla)
  let proxRondaPromise;
  if (numRonda < 3) {
    proxRondaPromise = Promise.all([
      waitFor(wsAlice, 'round_started', 10000),
      waitFor(wsBob,   'round_started', 10000),
    ]);
  }

  // Registrar phase_changed ANTES de tirar
  const phaseChangedPromise = Promise.all([
    waitFor(wsAlice, 'phase_changed'),
    waitFor(wsBob,   'phase_changed'),
  ]);

  send(wsAlice, 'roll_dice');
  send(wsBob,   'roll_dice');

  const [phaseAlice] = await phaseChangedPromise;
  log('🎯', `Todos tiraron — fase: ${phaseAlice.phase}`);

  // Registrar round_ended ANTES de seleccionar combo
  const roundEndedPromise = Promise.all([
    waitFor(wsAlice, 'round_ended', 10000),
    waitFor(wsBob,   'round_ended', 10000),
  ]);

  send(wsAlice, 'select_combo', { comboName: 'Suma' });
  send(wsBob,   'select_combo', { comboName: 'Suma' });

  const [roundEndAlice] = await roundEndedPromise;
  roundEndAlice.snapshot.players.forEach(p => {
    log('📊', `${p.name}: +${p.roundPoints} pts (total: ${p.totalPoints})`);
  });

  // Si hay siguiente ronda, esperar que arranque antes de retornar
  if (proxRondaPromise) {
    await proxRondaPromise;
  }
}

// ─── Runner ───────────────────────────────────────────────────────────────────

async function runFullGame() {
  console.log('\n🎲 DADO TRIPLE — Test de partida completa\n');
  console.log(`   Servidor: ${SERVER_URL}`);
  console.log(`   Objetivo: completar 3 rondas y verificar registro en MongoDB\n`);

  const wsAlice = await createClient('Alice');
  const wsBob   = await createClient('Bob');

  // 1. Crear sala
  send(wsAlice, 'create_room', { playerName: 'Alice', maxPlayers: 2 });
  const sala = await waitFor(wsAlice, 'room_created');
  log('🏠', `Sala creada: ${sala.roomCode}  (gameId: ${sala.roomId})`);

  // 2. Bob se une
  send(wsBob, 'join_room', { roomCode: sala.roomCode, playerName: 'Bob' });
  await Promise.all([
    waitFor(wsBob,   'room_joined'),
    waitFor(wsAlice, 'player_joined'),
  ]);
  log('👥', 'Bob se unió a la sala');

  // 3. Registrar round_started ANTES de enviar player_ready
  const primeraRondaPromise = Promise.all([
    waitFor(wsAlice, 'round_started'),
    waitFor(wsBob,   'round_started'),
  ]);

  send(wsAlice, 'player_ready');
  send(wsBob,   'player_ready');
  log('✋', 'Ambos listos — esperando inicio...');

  await primeraRondaPromise;

  // 4. Jugar las 3 rondas (round_started de ronda 1 ya fue consumido)
  await jugarRonda(wsAlice, wsBob, 1);
  await jugarRonda(wsAlice, wsBob, 2);
  await jugarRonda(wsAlice, wsBob, 3);

  // 5. Esperar game_over
  const gameOverPromise = Promise.all([
    waitFor(wsAlice, 'game_over', 15000),
    waitFor(wsBob,   'game_over', 15000),
  ]);
  const [gameOver] = await gameOverPromise;

  console.log('\n' + '═'.repeat(50));
  log('🏆', `Ganador: ${gameOver.winner.name} con ${gameOver.winner.totalPoints} puntos`);
  log('💾', `Guardado en MongoDB — gameId: ${sala.roomId}`);
  console.log('═'.repeat(50));
  console.log('\n  Verificar en MongoDB Compass o mongosh:');
  console.log(`  db.games.findOne({ gameId: "${sala.roomId}" })\n`);

  wsAlice.close();
  wsBob.close();
  process.exit(0);
}

runFullGame().catch(err => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});