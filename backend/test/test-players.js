/**
 * test-player.js
 * Simula UN jugador en una partida de Dado Triple.
 * Soporta 3 lanzamientos × 3 rondas = 9 rondas, con predicciones.
 *
 * Uso:
 *   Terminal 1 (host):  node test-player.js Alice
 *   Terminal 2:         node test-player.js Bob    <CÓDIGO>
 *   Terminal 3:         node test-player.js Carol  <CÓDIGO>
 *   Terminal 4:         node test-player.js Dave   <CÓDIGO>
 *   Espectador:         node test-player.js Obs    <CÓDIGO> spectator
 */

const WebSocket = require('ws');
const { TOTAL_ROUNDS, ROUNDS_PER_LAUNCH } = require('../src/game/gameEngine');

const SERVER_URL = 'ws://localhost:3000';

let MY_PLAYER_ID = null;
let MY_ROOM_CODE = null;

// ─── Args ─────────────────────────────────────────────────────────────────────
const playerName = process.argv[2];
const roomCode   = process.argv[3];
const role       = process.argv[4] || 'player';
const isHost     = !roomCode && role !== 'spectator';

if (!playerName) {
  console.error('\n  Uso: node test-player.js <nombre> [código] [spectator]\n');
  process.exit(1);
}

// ─── Colores ──────────────────────────────────────────────────────────────────
const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[34m', magenta: '\x1b[35m', cyan: '\x1b[36m',
};

function playerColor(name) {
  const palette = [C.cyan, C.yellow, C.magenta, C.green];
  let h = 0; for (const c of name) h += c.charCodeAt(0);
  return palette[h % palette.length];
}

const MY_COLOR = playerColor(playerName);

function log(msg, color = MY_COLOR) {
  const t = new Date().toLocaleTimeString('es-CR', { hour12: false });
  console.log(`${C.dim}[${t}]${C.reset} ${color}${msg}${C.reset}`);
}

function logSection(msg) {
  console.log(`\n${MY_COLOR}${'─'.repeat(60)}${C.reset}`);
  console.log(`${MY_COLOR}${C.bold}  ${msg}${C.reset}`);
  console.log(`${MY_COLOR}${'─'.repeat(60)}${C.reset}`);
}

function logDice(label, dice) {
  const f = ['','⚀','⚁','⚂','⚃','⚄','⚅'];
  log(`  ${label}: ${dice.map(d => f[d]||`[${d}]`).join(' ')}  (${dice.join('-')})`);
}

function logScoreboard(players) {
  console.log(`\n${C.dim}  ┌─ Marcador ────────────────────────────┐${C.reset}`);
  const sorted = [...players].sort((a, b) => b.totalPoints - a.totalPoints);
  sorted.forEach((p, i) => {
    const medal = ['🥇','🥈','🥉'][i] ?? '  ';
    const isMe  = p.name === playerName ? C.bold + MY_COLOR : C.dim;
    const name  = (p.name ?? '???').padEnd(12);
    const pts   = String(p.totalPoints ?? 0).padStart(4);
    console.log(`${C.dim}  │${C.reset} ${medal} ${isMe}${name}${C.reset} ${C.yellow}${pts} pts${C.reset}`);
  });
  console.log(`${C.dim}  └────────────────────────────────────────┘${C.reset}\n`);
}

// ─── WebSocket helpers ────────────────────────────────────────────────────────

function createClient() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(SERVER_URL);
    ws._eventQueue = {};
    ws._waiters    = {};

    function dispatch(type, payload) {
      const waiters = ws._waiters[type];
      if (waiters && waiters.length > 0) {
        waiters.shift()(payload);
        return;
      }
      ws._eventQueue[type] = ws._eventQueue[type] || [];
      ws._eventQueue[type].push(payload);
    }
    ws._dispatch = dispatch;

    ws.on('open',    () => resolve(ws));
    ws.on('error',   (err) => { console.error('\n❌ No se pudo conectar: ' + err.message + '\n'); reject(err); });
    ws.on('message', (raw) => {
      const msg = JSON.parse(raw);
      if (process.env.VERBOSE) console.log(`${C.dim}  <- ${msg.type}${C.reset}`);
      dispatch(msg.type, msg.payload);
    });
    ws.on('close', () => {
      log('Conexión cerrada', C.dim);
      if (MY_PLAYER_ID && MY_ROOM_CODE) setTimeout(() => attemptReconnect(), 2000);
    });
  });
}

async function attemptReconnect() {
  log(`🔄 Reconectando a sala ${MY_ROOM_CODE}...`, C.yellow);
  try {
    const ws = await createClient();
    send(ws, 'reconnect', { playerId: MY_PLAYER_ID, roomCode: MY_ROOM_CODE });
    const result = await waitFor(ws, 'reconnected', 10000);
    log(`✅ Reconectado — ronda ${result.currentRound}, fase: ${result.roundPhase}`, C.green);
    ws.on('close', () => { log('Conexión cerrada', C.dim); setTimeout(() => attemptReconnect(), 2000); });
    return ws;
  } catch (err) {
    log(`❌ No se pudo reconectar: ${err.message}`, C.red);
  }
}

function send(ws, type, payload = {}) {
  if (process.env.VERBOSE) console.log(`${C.dim}  → ${type}${C.reset}`);
  ws.send(JSON.stringify({ type, payload }));
}

function waitFor(ws, eventType, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    // Si ya hay eventos encolados de este tipo, consumir el primero
    const queued = ws._eventQueue[eventType];
    if (queued && queued.length > 0) {
      resolve(queued.shift());
      return;
    }
    // Si no, registrar un waiter
    let done = false;
    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        ws._waiters[eventType] = (ws._waiters[eventType] || []).filter(r => r !== resolver);
        reject(new Error(`Timeout esperando "${eventType}" — ¿todos los jugadores están listos?`));
      }
    }, timeoutMs);
    const resolver = (payload) => {
      if (!done) { done = true; clearTimeout(timer); resolve(payload); }
    };
    ws._waiters[eventType] = ws._waiters[eventType] || [];
    ws._waiters[eventType].push(resolver);
  });
}

// Espera un phase_changed con una fase específica
function waitForPhase(ws, phase, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    let done = false;
    const timer = setTimeout(() => {
      if (!done) { done = true; reject(new Error(`Timeout esperando phase_changed:${phase}`)); }
    }, timeoutMs);

    function tryConsume() {
      // Revisar si hay alguno encolado con la fase correcta
      const queued = ws._eventQueue['phase_changed'] || [];
      const idx = queued.findIndex(p => p.phase === phase);
      if (idx !== -1) {
        const payload = queued.splice(idx, 1)[0];
        if (!done) { done = true; clearTimeout(timer); resolve(payload); }
        return;
      }
      // Registrar waiter que filtra por fase
      const resolver = (payload) => {
        if (done) return;
        if (payload.phase === phase) {
          done = true; clearTimeout(timer); resolve(payload);
        } else {
          // No es la fase esperada — re-despachar al queue para otros waiters
          ws._eventQueue['phase_changed'] = ws._eventQueue['phase_changed'] || [];
          ws._eventQueue['phase_changed'].push(payload);
          // Volver a registrar waiter
          ws._waiters['phase_changed'] = ws._waiters['phase_changed'] || [];
          ws._waiters['phase_changed'].push(resolver);
        }
      };
      ws._waiters['phase_changed'] = ws._waiters['phase_changed'] || [];
      ws._waiters['phase_changed'].push(resolver);
    }
    tryConsume();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Lógica de juego ──────────────────────────────────────────────────────────

function elegirMejoresDados(dadosDisponibles) {
  const RANK = { 'Trío': 3, 'Escalera': 2, 'Par': 1, 'Nada': 0 };
  function evalHand(dice) {
    const s = [...dice].sort((a, b) => a - b);
    const counts = {};
    for (const d of s) counts[d] = (counts[d] || 0) + 1;
    const vals = Object.values(counts).sort((a, b) => b - a);
    if (vals[0] === 3) return { type: 'Trío',    tie: s[2] };
    if (s[1]===s[0]+1 && s[2]===s[1]+1) return { type: 'Escalera', tie: s[2] };
    if (vals[0] === 2) return { type: 'Par',     tie: Number(Object.keys(counts).find(k => counts[k]===2)) };
    return { type: 'Nada', tie: s[2] };
  }
  let bestIdx = [0,1,2], bestHand = evalHand([dadosDisponibles[0].val, dadosDisponibles[1].val, dadosDisponibles[2].val]);
  for (let i=0; i<dadosDisponibles.length-2; i++)
    for (let j=i+1; j<dadosDisponibles.length-1; j++)
      for (let k=j+1; k<dadosDisponibles.length; k++) {
        const h = evalHand([dadosDisponibles[i].val, dadosDisponibles[j].val, dadosDisponibles[k].val]);
        if (RANK[h.type]>RANK[bestHand.type] || (RANK[h.type]===RANK[bestHand.type] && h.tie>bestHand.tie)) {
          bestHand = h; bestIdx = [i,j,k];
        }
      }
  return { indices: bestIdx, hand: bestHand };
}

// Elegir predicción aleatoria pero con sesgo hacia 'mid'
function elegirPrediccion() {
  const opciones = ['high', 'mid', 'mid', 'low', 'zero'];
  return opciones[Math.floor(Math.random() * opciones.length)];
}

const PRED_LABELS = {
  high: 'Más de 10 pts 🔥',
  mid:  'Entre 7-10 pts ⚡',
  low:  'Entre 1-6 pts 🌊',
  zero: 'Exactamente 0 💀',
};

// ─── Estado persistente por lanzamiento ───────────────────────────────────────
let myAllDice    = null;
let myUsedIndices = [];

// ─── Jugar un lanzamiento completo (3 rondas) ─────────────────────────────────
async function jugarLanzamiento(ws, launchNum, totalLaunches) {
  logSection(`LANZAMIENTO ${launchNum} / ${totalLaunches}`);

  // Resetear dados al inicio de cada lanzamiento
  myAllDice     = null;
  myUsedIndices = [];

  // ── Paso 1: Tirar dados ──────────────────────────────────────────────────────
  await sleep(Math.random() * 600 + 200);
  log(`🎲 Tirando los 11 dados...`);

  // Capturar allDice de cualquier dice_rolled que llegue
  const diceRolledHandler = (raw) => {
    const msg = JSON.parse(raw);
    if (msg.type === 'dice_rolled') {
      const me = msg.payload.state.players.find(p => p.name === playerName);
      if (me?.allDice?.length) myAllDice = me.allDice;
    }
  };
  ws.on('message', diceRolledHandler);
  send(ws, 'roll_dice');

  // Esperar phase_changed:predicting (todos tiraron)
  const predPhase = await waitForPhase(ws, 'predicting', 60000);
  ws.removeListener('message', diceRolledHandler);

  // Rescatar allDice si aún no lo tenemos
  if (!myAllDice) {
    const me = predPhase.state.players.find(p => p.name === playerName);
    if (me?.allDice?.length) myAllDice = me.allDice;
  }

  if (myAllDice) {
    log(`✅ Todos tiraron`);
    logDice(`Mis datos disponibles (${myAllDice.length})`, myAllDice);
  }

  // ── Paso 2: Hacer predicción ─────────────────────────────────────────────────
  await sleep(Math.random() * 800 + 300);
  const pred = elegirPrediccion();
  log(`\n🔮 Predicción: ${C.bold}${PRED_LABELS[pred]}${C.reset}`);
  send(ws, 'make_prediction', { prediction: pred });

  // Esperar phase_changed:selecting (todos predijeron)
  const selPhase = await waitForPhase(ws, 'selecting', 60000);
  log(`✅ Todos predijeron — ¡a seleccionar dados!`);

  // Actualizar allDice si llegó actualizado
  const me2 = selPhase.state.players.find(p => p.name === playerName);
  if (me2?.allDice?.length) myAllDice = me2.allDice;

  // ── Paso 3: Jugar las 3 rondas del lanzamiento ───────────────────────────────
  for (let r = 1; r <= ROUNDS_PER_LAUNCH; r++) {
    const globalRound = (launchNum - 1) * ROUNDS_PER_LAUNCH + r;
    logSection(`  RONDA ${r}/3 del lanzamiento (ronda global ${globalRound}/${TOTAL_ROUNDS})`);

    // Rondas 2 y 3: esperar phase_changed:selecting del servidor
    if (r > 1) {
      const ph = await waitForPhase(ws, 'selecting', 30000);
      log(`✅ Fase: selección de dados`);
      const me = ph.state.players.find(p => p.name === playerName);
      if (me?.allDice?.length) myAllDice = me.allDice;
    }

    // ── Esperar turno secuencial ─────────────────────────────────────────────
    log(`⏳ Esperando turno...`);
    let esmiTurno = false;
    while (!esmiTurno) {
      const turn = await waitFor(ws, 'turn_started', 60000);
      if (turn.playerName === playerName) {
        esmiTurno = true;
        log(`🎯 ${C.bold}¡Es mi turno! (${turn.timeoutMs/1000}s)${C.reset}`, C.green);
      } else {
        log(`  Turno de ${turn.playerName}...`, C.dim);
      }
    }

    // Seleccionar 3 dados
    const dadosDisponibles = (myAllDice || [])
      .map((val, idx) => ({ val, idx }))
      .filter(d => !myUsedIndices.includes(d.idx));

    log(`  Dados disponibles (${dadosDisponibles.length}): ${dadosDisponibles.map(d => `[${d.idx}]${d.val}`).join(' ')}`);

    if (dadosDisponibles.length < 3) {
      log(`❌ No hay suficientes dados disponibles`, C.red);
      break;
    }

    const { indices, hand } = elegirMejoresDados(dadosDisponibles);
    const globalIndices  = indices.map(i => dadosDisponibles[i].idx);
    const dadosElegidos  = globalIndices.map(i => myAllDice[i]);

    myUsedIndices = [...myUsedIndices, ...globalIndices];

    await sleep(Math.random() * 800 + 300);
    log(`\n🃏 Presentando [${dadosElegidos.join(', ')}] → ${C.bold}${hand.type}${C.reset}`);
    send(ws, 'select_dice', { diceIndices: globalIndices });

    // Esperar round_ended
    const roundEnd = await waitFor(ws, 'round_ended', 60000);
    const myResult = roundEnd.snapshot.players.find(p => p.name === playerName);

    if (myResult) {
      log(`\n  📊 Resultado:`);
      log(`     Mi mano:           ${myResult.hand?.name}`);
      log(`     Puntos esta ronda: ${C.yellow}+${myResult.roundPoints}${C.reset}`);
      log(`     Puntos del lance:  ${C.yellow}${myResult.launchPoints ?? '—'} pts${C.reset}`);
      log(`     Total acumulado:   ${C.yellow}${myResult.totalPoints} pts${C.reset}`);

      // Mostrar resultado de predicción al final del lanzamiento
      if (roundEnd.snapshot.isLastRoundOfLaunch) {
        const hit     = myResult.predictionHit;
        const bonus   = myResult.bonusPoints ?? 0;
        const predKey = myResult.prediction;
        if (predKey) {
          if (hit) {
            log(`\n  🎯 ${C.green}${C.bold}¡Predicción ACERTADA!${C.reset} (${PRED_LABELS[predKey]})`);
            if (bonus > 0) log(`     Bonus aplicado: ${C.yellow}+${bonus} pts${C.reset}`);
          } else {
            log(`\n  ❌ Predicción fallida (predijo: ${PRED_LABELS[predKey]})`);
          }
        }
      }

      log(`\n  Manos de todos:`);
      roundEnd.snapshot.players.forEach(p => {
        const marker = p.name === playerName ? ` ${C.bold}← tú${C.reset}` : '';
        log(`    ${(p.name??'?').padEnd(12)} ${(p.hand?.name||'?').padEnd(22)} +${p.roundPoints} pts${marker}`);
      });
    }

    logScoreboard(roundEnd.snapshot.players);

    // Rondas 1 y 2 del lanzamiento: esperar round_started de la siguiente ronda
    if (r < ROUNDS_PER_LAUNCH) {
      await waitFor(ws, 'round_started', 15000);
    }
  }
  // Al terminar el lanzamiento NO esperamos aquí — main lo hace con pre-registro
}

// ─── Espectador ───────────────────────────────────────────────────────────────
function modoEspectador(ws) {
  ws.on('message', (raw) => {
    const msg = JSON.parse(raw);
    const evts = ['round_started','phase_changed','dice_selected','round_ended','game_over',
                  'player_disconnected','player_reconnected','auto_selected','prediction_made'];
    if (!evts.includes(msg.type)) return;
    switch (msg.type) {
      case 'round_started':
        logSection(`RONDA ${msg.payload.round}/${msg.payload.totalRounds} — Lanzamiento ${msg.payload.launch}`);
        break;
      case 'phase_changed':
        log(`📢 Fase: ${C.bold}${msg.payload.phase}${C.reset}`);
        break;
      case 'prediction_made':
        log(`🔮 ${msg.payload.playerName} hizo su predicción`);
        break;
      case 'turn_started':
        log(`🎯 Turno de ${msg.payload.playerName}`, C.dim);
        break;
      case 'dice_selected':
        log(`🃏 ${msg.payload.handName}`);
        break;
      case 'round_ended':
        log(`\n  📊 Resultado ronda ${msg.payload.round}:`);
        (msg.payload.snapshot?.players || []).forEach(p => {
          const bonus = p.bonusPoints > 0 ? ` [+${p.bonusPoints} bonus 🎯]` : '';
          log(`    ${(p.name??'?').padEnd(12)} ${(p.hand?.name||'?').padEnd(22)} +${p.roundPoints} pts${bonus}`);
        });
        logScoreboard(msg.payload.snapshot?.players || []);
        break;
      case 'game_over':
        log(`🏆 Ganador: ${C.bold}${msg.payload.winner.name}${C.reset} — ${msg.payload.winner.totalPoints} pts`);
        logScoreboard(msg.payload.state?.players || []);
        ws.close(); process.exit(0);
        break;
      case 'auto_selected':
        log(`🤖 Auto: ${msg.payload.playerName} → ${msg.payload.hand}`, C.yellow);
        break;
      case 'player_disconnected':
        log(`⚠️  ${msg.payload.disconnectedPlayerName} se desconectó`, C.red);
        break;
      case 'player_reconnected':
        log(`🔄 ${msg.payload.reconnectedPlayerName} reconectado`, C.green);
        break;
    }
  });
  log(`👁️  Observando... los eventos aparecerán en tiempo real`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.clear();
  console.log(`\n${MY_COLOR}${C.bold}`);
  console.log(`  ╔═══════════════════════════════════════════╗`);
  console.log(`  ║     🎲  D A D O   T R I P L E  🎲        ║`);
  console.log(`  ║     3 lanzamientos × 3 rondas = 9        ║`);
  console.log(`  ╚═══════════════════════════════════════════╝`);
  console.log(`${C.reset}`);
  log(`Jugador: ${C.bold}${playerName}${C.reset}`);

  const ws = await createClient();
  log(`Conectado al servidor ✓`);

  let roomInfo;

  if (isHost) {
    send(ws, 'create_room', { playerName, maxPlayers: 4 });
    roomInfo = await waitFor(ws, 'room_created');
    MY_PLAYER_ID = roomInfo.playerId;
    MY_ROOM_CODE = roomInfo.roomCode;
    console.log(`\n${C.green}${C.bold}`);
    console.log(`  ┌──────────────────────────────────────┐`);
    console.log(`  │   Sala creada: ${roomInfo.roomCode}            │`);
    console.log(`  │                                      │`);
    console.log(`  │   node test-player.js <nombre> ${roomInfo.roomCode}  │`);
    console.log(`  └──────────────────────────────────────┘`);
    console.log(`${C.reset}\n`);
    log(`Esperando jugadores... (mínimo 2 para iniciar)`);

  } else if (role === 'spectator') {
    send(ws, 'join_room', { roomCode, playerName, role: 'spectator' });
    roomInfo = await waitFor(ws, 'spectator_joined');
    MY_PLAYER_ID = roomInfo.spectatorId;
    MY_ROOM_CODE = roomCode;
    log(`👁️  Unido como espectador a sala ${roomCode}`);
    modoEspectador(ws);
    return;

  } else {
    log(`Uniéndose a sala ${C.bold}${roomCode}${C.reset}...`);
    send(ws, 'join_room', { roomCode, playerName });
    roomInfo = await waitFor(ws, 'room_joined');
    MY_PLAYER_ID = roomInfo.playerId;
    MY_ROOM_CODE = roomInfo.roomCode;
    log(`✅ Unido — jugadores: ${roomInfo.state.players.map(p => p.name).join(', ')}`);
  }

  // Escuchar eventos informativos
  ws.on('message', (raw) => {
    const msg = JSON.parse(raw);
    if (msg.type === 'player_joined')       log(`👋 ${msg.payload.newPlayer.name} se unió`);
    if (msg.type === 'player_disconnected') log(`⚠️  Un jugador se desconectó`, C.red);
    if (msg.type === 'game_starting')       log(`\n🚀 ${msg.payload.startedBy} inició la partida!`);
    if (msg.type === 'prediction_made' && msg.payload.playerId !== MY_PLAYER_ID) {
      log(`🔮 ${msg.payload.playerName} hizo su predicción`, C.dim);
    }
  });

  await sleep(300);
  log(`✋ Marcando como listo...`);

  const primeraRondaPromise = waitFor(ws, 'round_started', 120000);
  send(ws, 'player_ready');

  if (isHost) {
    log(`\n${C.bold}Presiona ENTER para iniciar ya${C.reset}`);
    log(`(o espera — inicia solo cuando lleguen los 4 jugadores)`, C.dim);
    let started = false;
    primeraRondaPromise.then(() => { started = true; });
    process.stdin.setEncoding('utf8');
    process.stdin.resume();
    process.stdin.once('data', () => {
      process.stdin.pause();
      if (!started) { log(`\n🚀 Iniciando partida...`); send(ws, 'start_game'); }
    });
  } else {
    log(`Esperando que el host inicie...`);
  }

  const ronda1 = await primeraRondaPromise;
  try { process.stdin.pause(); } catch (_) {}

  const totalLanzamientos = 3;
  log(`\n🚀 ¡Partida iniciada! ${ronda1.totalRounds} rondas — ${totalLanzamientos} lanzamientos`);

  // ── Jugar los 3 lanzamientos ──────────────────────────────────────────────
  // La cola persistente guarda round_started aunque llegue antes de waitFor
  await jugarLanzamiento(ws, 1, totalLanzamientos);

  log(`
⏭  Esperando lanzamiento 2...`, C.cyan);
  await waitFor(ws, 'round_started', 60000);
  await jugarLanzamiento(ws, 2, totalLanzamientos);

  log(`
⏭  Esperando lanzamiento 3...`, C.cyan);
  await waitFor(ws, 'round_started', 60000);
  await jugarLanzamiento(ws, 3, totalLanzamientos);

  // ── Fin del juego ─────────────────────────────────────────────────────────
  const gameOver = await waitFor(ws, 'game_over', 60000);

  console.log(`\n${MY_COLOR}${C.bold}`);
  console.log(`  ╔════════════════════════════════════╗`);
  console.log(`  ║        🏆  FIN DEL JUEGO           ║`);
  console.log(`  ╚════════════════════════════════════╝`);
  console.log(`${C.reset}`);

  const winner      = gameOver.winner;
  const soyGanador  = winner.name === playerName;
  if (soyGanador) log(`${C.bold}${C.yellow}🏆 ¡GANASTE! ${winner.totalPoints} puntos${C.reset}`);
  else            log(`🏆 Ganador: ${C.bold}${winner.name}${C.reset} — ${winner.totalPoints} pts`);

  logScoreboard(gameOver.state.players);
  log(`💾 Partida guardada — gameId: ${roomInfo.roomId}`, C.dim);

  ws.close();
  process.exit(0);
}

main().catch(err => {
  console.error(`\n${C.red}❌ Error: ${err.message}${C.reset}\n`);
  process.exit(1);
});