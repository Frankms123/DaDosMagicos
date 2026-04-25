/**
 * test-player.js
 * Simula UN jugador en una partida de Dado Triple.
 * Ejecutar en 4 terminales distintas.
 *
 * Uso:
 *   Terminal 1 (crea la sala):   node test-player.js Alice
 *   Terminal 2:                  node test-player.js Bob    <CÓDIGO>
 *   Terminal 3:                  node test-player.js Carol  <CÓDIGO>
 *   Terminal 4:                  node test-player.js Dave   <CÓDIGO>
 *
 * El código de sala lo imprime la Terminal 1 al arrancar.
 */

const WebSocket = require('ws');

const SERVER_URL = 'ws://localhost:3000';

// Token de reconexión — persiste entre desconexiones
let MY_PLAYER_ID = null;
let MY_ROOM_CODE = null;

// ─── Args ─────────────────────────────────────────────────────────────────────

const playerName = process.argv[2];
const roomCode   = process.argv[3];

if (!playerName) {
  console.error('\n  Uso: node test-player.js <nombre> [código-sala] [spectator]\n');
  process.exit(1);
}

const role   = process.argv[4] || 'player';  // 'player' o 'spectator'
const isHost = !roomCode && role !== 'spectator';

// ─── Colores por jugador ──────────────────────────────────────────────────────

const COLORS = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  dim:     '\x1b[2m',
  red:     '\x1b[31m',
  green:   '\x1b[32m',
  yellow:  '\x1b[33m',
  blue:    '\x1b[34m',
  magenta: '\x1b[35m',
  cyan:    '\x1b[36m',
  white:   '\x1b[37m',
};

// Cada jugador gets un color distinto basado en su nombre
function playerColor(name) {
  const palette = [COLORS.cyan, COLORS.yellow, COLORS.magenta, COLORS.green];
  let hash = 0;
  for (const c of name) hash += c.charCodeAt(0);
  return palette[hash % palette.length];
}

const MY_COLOR = playerColor(playerName);

function log(msg, color = MY_COLOR) {
  const time = new Date().toLocaleTimeString('es-CR', { hour12: false });
  console.log(`${COLORS.dim}[${time}]${COLORS.reset} ${color}${msg}${COLORS.reset}`);
}

function logSection(msg) {
  console.log(`\n${MY_COLOR}${'─'.repeat(55)}${COLORS.reset}`);
  console.log(`${MY_COLOR}${COLORS.bold}  ${msg}${COLORS.reset}`);
  console.log(`${MY_COLOR}${'─'.repeat(55)}${COLORS.reset}`);
}

function logDice(label, dice) {
  const faces = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
  const visual = dice.map(d => faces[d] || `[${d}]`).join(' ');
  log(`  ${label}: ${visual}  (${dice.join('-')})`);
}

function logScoreboard(players) {
  console.log(`\n${COLORS.dim}  ┌─ Marcador ──────────────────────────┐${COLORS.reset}`);
  const sorted = [...players].sort((a, b) => b.totalPoints - a.totalPoints);
  sorted.forEach((p, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
    const isMe = p.name === playerName ? COLORS.bold + MY_COLOR : COLORS.dim;
    const pts = String(p.totalPoints).padStart(4);
    const name = p.name ?? '???';
    console.log(`${COLORS.dim}  │${COLORS.reset} ${medal} ${isMe}${name.padEnd(12)}${COLORS.reset} ${COLORS.yellow}${pts} pts${COLORS.reset}`);
  });
  console.log(`${COLORS.dim}  └──────────────────────────────────────┘${COLORS.reset}\n`);
}

// ─── WebSocket helpers ────────────────────────────────────────────────────────

function createClient() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(SERVER_URL);
    ws._queue = {};

    ws.on('open', () => resolve(ws));
    ws.on('error', (err) => {
      console.error(`\n❌ No se pudo conectar al servidor: ${err.message}`);
      console.error(`   ¿Está corriendo "npm run dev"?\n`);
      reject(err);
    });

    ws.on('message', (raw) => {
      const msg = JSON.parse(raw);

      // Log de todos los eventos entrantes en modo verbose
      if (process.env.VERBOSE) {
        console.log(`${COLORS.dim}  ← ${msg.type}${COLORS.reset}`);
      }

      const q = ws._queue[msg.type];
      if (q && q.length > 0) q.shift()(msg.payload);
    });

    ws.on('close', () => {
      log('Conexión cerrada — intentando reconectar...', COLORS.dim);
      if (MY_PLAYER_ID && MY_ROOM_CODE) {
        setTimeout(() => attemptReconnect(), 2000);
      }
    });
  });
}

async function attemptReconnect() {
  log(`🔄 Reconectando a sala ${MY_ROOM_CODE}...`, COLORS.yellow);
  try {
    const ws = await createClient(true); // skipReconnectSetup=true evita loop
    send(ws, 'reconnect', { playerId: MY_PLAYER_ID, roomCode: MY_ROOM_CODE });

    const result = await waitFor(ws, 'reconnected', 10000);
    log(`✅ Reconectado — ronda ${result.currentRound}, fase: ${result.roundPhase}`, COLORS.green);

    // Re-registrar listener de desconexión para intentar de nuevo si vuelve a caer
    ws.on('close', () => {
      log('Conexión cerrada — intentando reconectar...', COLORS.dim);
      setTimeout(() => attemptReconnect(), 2000);
    });

    // El cliente deberá manejar el estado recibido para continuar
    // (en una app real se retomaría el flujo del juego desde aquí)
    return ws;
  } catch (err) {
    log(`❌ No se pudo reconectar: ${err.message}`, COLORS.red);
  }
}

function send(ws, type, payload = {}) {
  if (process.env.VERBOSE) {
    console.log(`${COLORS.dim}  → ${type}${COLORS.reset}`);
  }
  ws.send(JSON.stringify({ type, payload }));
}

function waitFor(ws, eventType, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    ws._queue[eventType] = ws._queue[eventType] || [];

    let fulfilled = false;

    const timer = setTimeout(() => {
      if (!fulfilled) {
        fulfilled = true;
        ws._queue[eventType] = (ws._queue[eventType] || []).filter(r => r !== wrapped);
        reject(new Error(`Timeout esperando "${eventType}" — ¿todos los jugadores están listos?`));
      }
    }, timeoutMs);

    const wrapped = (payload) => {
      if (!fulfilled) {
        fulfilled = true;
        clearTimeout(timer);
        resolve(payload);
      }
    };

    ws._queue[eventType].push(wrapped);
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ─── Lógica del jugador ───────────────────────────────────────────────────────

function elegirMejoresDados(allDice) {
  // Prueba todas las combinaciones de 3 dados y elige la mejor mano
  const HAND_RANK = { 'Trío': 3, 'Escalera': 2, 'Par': 1, 'Nada': 0 };

  function evalHand(dice) {
    const s = [...dice].sort((a, b) => a - b);
    const counts = {};
    for (const d of s) counts[d] = (counts[d] || 0) + 1;
    const vals = Object.values(counts).sort((a, b) => b - a);
    const faces = Object.keys(counts).map(Number);
    if (vals[0] === 3) return { type: 'Trío', tie: s[2] };
    if (s[1] === s[0]+1 && s[2] === s[1]+1) return { type: 'Escalera', tie: s[2] };
    if (vals[0] === 2) return { type: 'Par', tie: faces.find(f => counts[f] === 2) };
    return { type: 'Nada', tie: s[2] };
  }

  let bestIndices = [0, 1, 2];
  let bestHand = evalHand([allDice[0], allDice[1], allDice[2]]);

  for (let i = 0; i < allDice.length - 2; i++) {
    for (let j = i + 1; j < allDice.length - 1; j++) {
      for (let k = j + 1; k < allDice.length; k++) {
        const hand = evalHand([allDice[i], allDice[j], allDice[k]]);
        const rankA = HAND_RANK[hand.type] ?? 0;
        const rankB = HAND_RANK[bestHand.type] ?? 0;
        if (rankA > rankB || (rankA === rankB && hand.tie > bestHand.tie)) {
          bestHand = hand;
          bestIndices = [i, j, k];
        }
      }
    }
  }

  return { indices: bestIndices, hand: bestHand };
}

// Estado persistente de mis dados entre rondas
let myAllDice = null;
let myUsedIndices = [];

async function jugarRonda(ws, numRonda, totalRondas) {
  logSection(`RONDA ${numRonda} / ${totalRondas}`);

  // ── Ronda 1: tirar dados ──────────────────────────────────────────────────
  if (numRonda === 1) {
    await sleep(Math.random() * 800 + 200);
    log(`🎲 Tirando los 11 dados...`);

    // Capturar allDice de cualquier dice_rolled que llegue con nuestro estado
    const diceRolledHandler = (raw) => {
      const msg = JSON.parse(raw);
      if (msg.type === 'dice_rolled') {
        const me = msg.payload.state.players.find(p => p.name === playerName);
        if (me && me.allDice) myAllDice = me.allDice;
      }
    };
    ws.on('message', diceRolledHandler);

    send(ws, 'roll_dice');

    // Esperar phase_changed (todos tiraron)
    const phase = await waitFor(ws, 'phase_changed', 30000);
    ws.removeListener('message', diceRolledHandler);

    log(`✅ Todos tiraron`);

    if (!myAllDice) {
      // Extraer del propio estado si llegó en phase_changed
      const me = phase.state.players.find(p => p.name === playerName);
      if (me?.allDice) myAllDice = me.allDice;
    }

  // ── Rondas 2 y 3: sin tirada, esperar phase_changed automático ────────────
  } else {
    // El servidor emite phase_changed inmediatamente al iniciar rondas 2 y 3
    const phase = await waitFor(ws, 'phase_changed', 15000);
    log(`✅ Fase: selección de dados`);

    // Actualizar allDice si llegó en el estado (por si acaso)
    const me = phase.state.players.find(p => p.name === playerName);
    if (me?.allDice) myAllDice = me.allDice;
  }

  // ── Seleccionar 3 dados de los disponibles ────────────────────────────────

  const dadosDisponibles = myAllDice
    ? myAllDice.map((val, idx) => ({ val, idx })).filter(d => !myUsedIndices.includes(d.idx))
    : [];

  log(`\n  Mis dados disponibles (${dadosDisponibles.length}): ${dadosDisponibles.map(d => `[${d.idx}]${d.val}`).join(' ')}`);

  const { indices, hand } = elegirMejoresDados(dadosDisponibles.map(d => d.val));

  // Convertir índices locales (sobre dadosDisponibles) a índices globales (sobre allDice)
  const globalIndices = indices.map(i => dadosDisponibles[i].idx);
  const dadosElegidos = globalIndices.map(i => myAllDice[i]);

  myUsedIndices = [...myUsedIndices, ...globalIndices];

  await sleep(Math.random() * 600 + 200);
  log(`\n🃏 Presentando [${dadosElegidos.join(', ')}] → ${COLORS.bold}${hand.type}${COLORS.reset}`);
  send(ws, 'select_dice', { diceIndices: globalIndices });

  // ── Resultado de la ronda ─────────────────────────────────────────────────

  const roundEnd = await waitFor(ws, 'round_ended', 30000);
  const myResult = roundEnd.snapshot.players.find(p => p.name === playerName);

  if (myResult) {
    log(`\n  📊 Resultado:`);
    log(`     Mi mano:           ${myResult.hand?.name}`);
    log(`     Puntos esta ronda: ${COLORS.yellow}+${myResult.roundPoints}${COLORS.reset}`);
    log(`     Total acumulado:   ${COLORS.yellow}${myResult.totalPoints} pts${COLORS.reset}`);
    log(`\n  Manos de todos:`);
    roundEnd.snapshot.players.forEach(p => {
      const marker = p.name === playerName ? ` ${COLORS.bold}← tú${COLORS.reset}` : '';
      log(`    ${p.name.padEnd(12)} ${(p.hand?.name || '?').padEnd(22)} +${p.roundPoints} pts${marker}`);
    });
  }

  logScoreboard(roundEnd.snapshot.players);

  if (numRonda < totalRondas) {
    return waitFor(ws, 'round_started', 15000);
  }
  return null;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.clear();
  console.log(`\n${MY_COLOR}${COLORS.bold}`);
  console.log(`  ╔═══════════════════════════════════════╗`);
  console.log(`  ║      🎲  D A D O   T R I P L E  🎲   ║`);
  console.log(`  ║         El Plan del Diablo — T2       ║`);
  console.log(`  ╚═══════════════════════════════════════╝`);
  console.log(`${COLORS.reset}`);
  log(`Jugador: ${COLORS.bold}${playerName}${COLORS.reset}`);

  const ws = await createClient();
  log(`Conectado al servidor ✓`);

  let roomInfo;

  if (isHost) {
    // ── Crear sala ──
    send(ws, 'create_room', { playerName, maxPlayers: 4 });
    roomInfo = await waitFor(ws, 'room_created');
    MY_PLAYER_ID = roomInfo.playerId;
    MY_ROOM_CODE = roomInfo.roomCode;

    console.log(`\n${COLORS.green}${COLORS.bold}`);
    console.log(`  ┌─────────────────────────────────┐`);
    console.log(`  │   Sala creada exitosamente 🎉    │`);
    console.log(`  │                                  │`);
    console.log(`  │   Código: ${roomInfo.roomCode}   │`);
    console.log(`  │                                  │`);
    console.log(`  │   Comparte este código con los   │`);
    console.log(`  │   otros jugadores:               │`);
    console.log(`  │                                  │`);
    console.log(`  │   node test-player.js <nombre> ${roomInfo.roomCode} │`);
    console.log(`  └─────────────────────────────────┘`);
    console.log(`${COLORS.reset}\n`);

    log(`Esperando jugadores... (mínimo 2 para iniciar)`);

  } else {
    // ── Unirse a sala ──
    log(`Uniéndose a sala ${COLORS.bold}${roomCode}${COLORS.reset}...`);
    if (role === 'spectator') {
      send(ws, 'join_room', { roomCode, playerName, role: 'spectator' });
      roomInfo = await waitFor(ws, 'spectator_joined');
      MY_PLAYER_ID = roomInfo.spectatorId;
      MY_ROOM_CODE = roomCode;
      log(`👁️  Unido como espectador a sala ${roomCode}`);

      // Espectadores solo observan — escuchar todos los eventos y mostrar en pantalla
      ws.on('message', (raw) => {
        const msg = JSON.parse(raw);
        const eventsToShow = ['round_started','dice_rolled','phase_changed','dice_selected','round_ended','game_over','player_disconnected','player_reconnected','spectator_entered','spectator_left','auto_selected'];
        if (eventsToShow.includes(msg.type)) {
          const players = msg.payload?.state?.players || msg.payload?.snapshot?.players || [];
          switch (msg.type) {
            case 'round_started':
              logSection(`RONDA ${msg.payload.round} / ${msg.payload.totalRounds} — iniciada`);
              break;
            case 'phase_changed':
              log(`📢 Fase: ${msg.payload.phase}`);
              break;
            case 'dice_selected':
              log(`🃏 ${msg.payload.handName} — jugador seleccionó dados`);
              break;
            case 'round_ended':
              log(`\n  📊 Resultado ronda ${msg.payload.round}:`);
              (msg.payload.snapshot?.players || []).forEach(p => {
                log(`    ${p.name.padEnd(12)} ${(p.hand?.name||'?').padEnd(22)} +${p.roundPoints} pts`);
              });
              logScoreboard(msg.payload.snapshot?.players || []);
              break;
            case 'game_over':
              log(`🏆 Ganador: ${COLORS.bold}${msg.payload.winner.name}${COLORS.reset} con ${msg.payload.winner.totalPoints} pts`);
              logScoreboard(msg.payload.state?.players || []);
              ws.close();
              process.exit(0);
              break;
            case 'auto_selected':
              log(`🤖 Auto-selección para ${msg.payload.playerName}: ${msg.payload.hand}`, COLORS.yellow);
              break;
            case 'player_disconnected':
              log(`⚠️  ${msg.payload.disconnectedPlayerName} se desconectó`, COLORS.red);
              break;
            case 'player_reconnected':
              log(`🔄 ${msg.payload.reconnectedPlayerName} reconectado`, COLORS.green);
              break;
            case 'spectator_entered':
              log(`👁️  ${msg.payload.spectator.name} entró como espectador`, COLORS.dim);
              break;
          }
        }
      });
      log(`Observando la partida... (los eventos aparecerán en tiempo real)`);
      return; // espectador no juega, solo escucha
    }

    send(ws, 'join_room', { roomCode, playerName });
    roomInfo = await waitFor(ws, 'room_joined');
    MY_PLAYER_ID = roomInfo.playerId;
    MY_ROOM_CODE = roomInfo.roomCode;
    log(`✅ Unido a la sala ${roomInfo.roomCode}`);

    const jugadores = roomInfo.state.players.map(p => p.name).join(', ');
    log(`Jugadores en sala: ${jugadores}`);
  }

  // Escuchar cuando otros jugadores se unen
  ws.on('message', (raw) => {
    const msg = JSON.parse(raw);
    if (msg.type === 'player_joined') {
      const nombre = msg.payload.newPlayer.name;
      const total  = msg.payload.state.players.length;
      log(`👋 ${nombre} se unió — jugadores en sala: ${total}/4`);
    }
    if (msg.type === 'player_disconnected') {
      log(`⚠️  Un jugador se desconectó`, COLORS.red);
    }
  });

  await sleep(500);
  log(`\n✋ Marcando como listo...`);

  // Escuchar notificaciones de sala ANTES de enviar player_ready
  ws.on('message', (raw) => {
    const msg = JSON.parse(raw);
    if (msg.type === 'game_starting') {
      log(`\n🚀 ${msg.payload.startedBy} inició la partida!`);
    }
  });

  // Pre-registrar round_started ANTES de enviar player_ready
  // (el servidor puede emitirlo casi inmediatamente si la sala ya está llena)
  const primeraRondaPromise = waitFor(ws, 'round_started', 120000);

  send(ws, 'player_ready');

  if (isHost) {
    log(`\n${COLORS.bold}Presiona ENTER para iniciar ya${COLORS.reset}`);
    log(`(o espera — inicia solo cuando lleguen los 4 jugadores)`, COLORS.dim);

    // Race: Enter del host vs inicio automático del servidor
    // El stdin NO bloquea el flujo del juego — solo dispara start_game
    let gameAlreadyStarted = false;
    primeraRondaPromise.then(() => { gameAlreadyStarted = true; });

    process.stdin.setEncoding('utf8');
    process.stdin.resume();
    process.stdin.once('data', () => {
      process.stdin.pause();
      if (!gameAlreadyStarted) {
        log(`\n🚀 Iniciando partida...`);
        send(ws, 'start_game');
      }
      // Si ya inició automáticamente, simplemente ignoramos el Enter
    });
  } else {
    log(`Esperando que el host inicie la partida...`);
  }

  const ronda1 = await primeraRondaPromise;
  // Asegurarse de que stdin quede cerrado si aún estaba escuchando
  try { process.stdin.pause(); } catch (_) {}

  log(`\n🚀 ¡Partida iniciada! ${ronda1.totalRounds} rondas`);

  // ── Jugar las 3 rondas ──
  let proxRondaPromise = null;

  proxRondaPromise = await jugarRonda(ws, 1, ronda1.totalRounds);
  if (proxRondaPromise) await proxRondaPromise;

  proxRondaPromise = await jugarRonda(ws, 2, ronda1.totalRounds);
  if (proxRondaPromise) await proxRondaPromise;

  await jugarRonda(ws, 3, ronda1.totalRounds);

  // ── Fin del juego ──
  const gameOver = await waitFor(ws, 'game_over', 15000);

  console.log(`\n${MY_COLOR}${COLORS.bold}`);
  console.log(`  ╔═══════════════════════════════════════╗`);
  console.log(`  ║           🏆  FIN DEL JUEGO           ║`);
  console.log(`  ╚═══════════════════════════════════════╝`);
  console.log(`${COLORS.reset}`);

  const winner = gameOver.winner;
  const soyGanador = winner.name === playerName;

  if (soyGanador) {
    log(`${COLORS.bold}${COLORS.yellow}🏆 ¡GANASTE! ${winner.totalPoints} puntos${COLORS.reset}`);
  } else {
    log(`🏆 Ganador: ${COLORS.bold}${winner.name}${COLORS.reset} con ${winner.totalPoints} pts`);
  }

  logScoreboard(gameOver.state.players);
  log(`💾 Partida guardada — gameId: ${roomInfo.roomId}`, COLORS.dim);

  ws.close();
  process.exit(0);
}

main().catch(err => {
  console.error(`\n${COLORS.red}❌ Error: ${err.message}${COLORS.reset}\n`);
  process.exit(1);
});