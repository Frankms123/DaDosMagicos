const { v4: uuidv4 } = require('uuid');
const {
  createRoom, getRoomById, getRoomByCode,
  removeRoom, getRoomSafeState, getRoomStateForSpectator,
  getCurrentTurnPlayerId, buildTurnOrder,
} = require('../rooms/roomManager');
const {
  TOTAL_ROUNDS, ROUNDS_PER_LAUNCH,
  getLaunchNumber, isFirstRoundOfLaunch, isLastRoundOfLaunch,
  createPlayerState, applyRollToPlayer,
  applyPrediction, applyDiceSelection, autoSelectBestDice, autoPredict,
  allPlayersReady, allPlayersRolled, allPlayersPredicted,
  resolveRound, getWinner,
} = require('../game/gameEngine');
const { persistGameResult } = require('../db/repository');
const { updatePlayerStats } = require('../db/playerRepository');

const TURN_TIMEOUT_MS        = 30 * 1000;
const RECONNECT_WINDOW_MS    = 2 * 60 * 1000;
const AUTO_PREDICT_TIMEOUT_MS = 15 * 1000;

const clients          = new Map();
const turnTimers       = new Map();   // roomId → timer
const autoPredictTimers = new Map();  // playerId → timer
const roomCleanupTimers = new Map();  // roomId → timer

// ─── Helpers ──────────────────────────────────────────────────────────────────

function send(ws, type, payload) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ type, payload }));
}

function sendError(ws, message) { send(ws, 'error', { message }); }

function broadcastToRoom(room, type, payloadFn) {
  for (const [pid] of room.players.entries()) {
    const ws = getWsForPlayer(pid);
    if (ws) send(ws, type, payloadFn(pid));
  }
  for (const [sid] of room.spectators.entries()) {
    const ws = getWsForSpectator(sid);
    if (ws) send(ws, type, payloadFn(null));
  }
}

function getWsForPlayer(playerId) {
  for (const [ws, meta] of clients.entries())
    if (meta.playerId === playerId && meta.role !== 'spectator') return ws;
  return null;
}

function getWsForSpectator(spectatorId) {
  for (const [ws, meta] of clients.entries())
    if (meta.playerId === spectatorId && meta.role === 'spectator') return ws;
  return null;
}

// ─── Turno ────────────────────────────────────────────────────────────────────

function startTurn(room) {
  clearTurnTimer(room);

  const playerId = getCurrentTurnPlayerId(room);
  if (!playerId) return;

  const player = room.players.get(playerId);
  if (!player) return;

  broadcastToRoom(room, 'turn_started', (pid) => ({
    playerId,
    playerName: player.name,
    timeoutMs: TURN_TIMEOUT_MS,
    state: getRoomSafeState(room, pid),
  }));

  // Si el jugador está desconectado, auto-seleccionar inmediatamente
  if (!player.isConnected) {
    console.log(`🤖 Jugador ${player.name} desconectado — auto-selección inmediata`);
    setTimeout(() => autoSelectCurrentPlayer(room, playerId), 1000);
    return;
  }

  // Timer de 30s
  const timer = setTimeout(() => {
    console.log(`⏰ Timeout de turno para ${player.name}`);
    autoSelectCurrentPlayer(room, playerId);
  }, TURN_TIMEOUT_MS);

  turnTimers.set(room.id, timer);
}

function clearTurnTimer(room) {
  if (turnTimers.has(room.id)) {
    clearTimeout(turnTimers.get(room.id));
    turnTimers.delete(room.id);
  }
}

function autoSelectCurrentPlayer(room, playerId) {
  const player = room.players.get(playerId);
  if (!player || player.presentedDice.length > 0) return; // ya presentó
  if (getCurrentTurnPlayerId(room) !== playerId) return;   // ya no es su turno

  try {
    const updated = autoSelectBestDice(player);
    room.players.set(playerId, updated);

    broadcastToRoom(room, 'auto_selected', (pid) => ({
      playerId,
      playerName: player.name,
      hand: updated.hand.name,
      state: getRoomSafeState(room, pid),
    }));

    advanceTurn(room);
  } catch (err) {
    console.error(`❌ Error en auto-select de ${player.name}:`, err.message);
  }
}

function advanceTurn(room) {
  clearTurnTimer(room);
  room.currentTurnIndex++;

  // Verificar si todos los jugadores conectados ya presentaron
  const allDone = [...room.players.values()]
    .filter(p => p.isConnected)
    .every(p => p.presentedDice.length > 0);

  // También los desconectados deben haber presentado (via auto-select)
  const allAbsoluteDone = [...room.players.values()]
    .every(p => p.presentedDice.length > 0);

  if (allAbsoluteDone) {
    endRound(room);
  } else if (room.currentTurnIndex < room.turnOrder.length) {
    // Saltar jugadores que ya presentaron (puede pasar con reconexiones)
    while (
      room.currentTurnIndex < room.turnOrder.length &&
      room.players.get(room.turnOrder[room.currentTurnIndex])?.presentedDice.length > 0
    ) {
      room.currentTurnIndex++;
    }
    if (room.currentTurnIndex < room.turnOrder.length) {
      startTurn(room);
    } else {
      endRound(room);
    }
  } else {
    endRound(room);
  }
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

function handleCreateRoom(ws, { playerName, maxPlayers }) {
  const playerId = uuidv4();
  const room     = createRoom(maxPlayers || 4);
  const player   = createPlayerState(playerId, playerName);
  room.players.set(playerId, player);
  clients.set(ws, { playerId, roomId: room.id, role: 'player' });
  send(ws, 'room_created', {
    roomId: room.id, roomCode: room.code, playerId,
    state: getRoomSafeState(room, playerId),
  });
}

function handleJoinRoom(ws, { roomCode, playerName, role }) {
  const room = getRoomByCode(roomCode);
  if (!room) return sendError(ws, 'Sala no encontrada');

  if (role === 'spectator') {
    if (room.status === 'finished') return sendError(ws, 'La partida ya terminó');
    const spectatorId = uuidv4();
    room.spectators.set(spectatorId, { id: spectatorId, name: playerName || 'Espectador', isConnected: true });
    clients.set(ws, { playerId: spectatorId, roomId: room.id, role: 'spectator' });
    send(ws, 'spectator_joined', { spectatorId, state: getRoomStateForSpectator(room) });
    broadcastToRoom(room, 'spectator_entered', (pid) => ({
      spectator: { id: spectatorId, name: playerName },
      state: pid ? getRoomSafeState(room, pid) : getRoomStateForSpectator(room),
    }));
    return;
  }

  if (room.status !== 'waiting') return sendError(ws, 'La partida ya comenzó');
  if (room.players.size >= room.maxPlayers) return sendError(ws, 'Sala llena');

  const playerId = uuidv4();
  const player   = createPlayerState(playerId, playerName);
  room.players.set(playerId, player);
  clients.set(ws, { playerId, roomId: room.id, role: 'player' });
  send(ws, 'room_joined', {
    roomId: room.id, roomCode: room.code, playerId,
    state: getRoomSafeState(room, playerId),
  });
  broadcastToRoom(room, 'player_joined', (pid) => ({
    state: pid ? getRoomSafeState(room, pid) : getRoomStateForSpectator(room),
    newPlayer: { id: playerId, name: playerName },
  }));
}

function handlePlayerReady(ws) {
  const meta = clients.get(ws);
  if (!meta) return sendError(ws, 'No estás en ninguna sala');
  const room   = getRoomById(meta.roomId);
  if (!room) return sendError(ws, 'Sala no encontrada');
  const player = room.players.get(meta.playerId);
  player.isReady = true;
  broadcastToRoom(room, 'player_ready', (pid) => ({
    state: getRoomSafeState(room, pid), readyPlayerId: meta.playerId,
  }));
  if (room.players.size >= room.maxPlayers && allPlayersReady(room)) startRound(room);
}

function handleStartGame(ws) {
  const meta = clients.get(ws);
  if (!meta) return sendError(ws, 'No estás en ninguna sala');
  const room = getRoomById(meta.roomId);
  if (!room) return sendError(ws, 'Sala no encontrada');
  if (room.status !== 'waiting') return sendError(ws, 'La partida ya comenzó');
  if (room.players.size < 2) return sendError(ws, 'Se necesitan al menos 2 jugadores');
  const [hostId] = room.players.keys();
  if (meta.playerId !== hostId) return sendError(ws, 'Solo el host puede iniciar');
  broadcastToRoom(room, 'game_starting', (pid) => ({
    state: getRoomSafeState(room, pid),
    startedBy: room.players.get(meta.playerId).name,
  }));
  startRound(room);
}

function handleRollDice(ws) {
  const meta = clients.get(ws);
  if (!meta) return sendError(ws, 'No estás en ninguna sala');
  const room = getRoomById(meta.roomId);
  if (!room || room.status !== 'playing') return sendError(ws, 'Partida no activa');
  if (!isFirstRoundOfLaunch(room.currentRound)) return sendError(ws, 'Solo se tira al inicio del lanzamiento');
  if (room.roundPhase !== 'rolling') return sendError(ws, 'No es momento de tirar');
  const player = room.players.get(meta.playerId);
  if (player.hasRolled) return sendError(ws, 'Ya tiraste los dados');

  room.players.set(meta.playerId, applyRollToPlayer(player));
  broadcastToRoom(room, 'dice_rolled', (pid) => ({
    state: getRoomSafeState(room, pid), rolledPlayerId: meta.playerId,
  }));

  if (allPlayersRolled(room)) {
    room.roundPhase = 'predicting';
    broadcastToRoom(room, 'phase_changed', (pid) => ({
      phase: 'predicting', state: getRoomSafeState(room, pid),
    }));
  }
}

function handleMakePrediction(ws, { prediction }) {
  const meta = clients.get(ws);
  if (!meta) return sendError(ws, 'No estás en ninguna sala');
  const room = getRoomById(meta.roomId);
  if (!room || room.status !== 'playing') return sendError(ws, 'Partida no activa');
  if (room.roundPhase !== 'predicting') return sendError(ws, 'No es momento de predecir');
  const player = room.players.get(meta.playerId);
  try {
    room.players.set(meta.playerId, applyPrediction(player, prediction));
  } catch (e) {
    return sendError(ws, e.message);
  }

  broadcastToRoom(room, 'prediction_made', (pid) => ({
    playerId: meta.playerId, playerName: player.name,
    prediction: pid === meta.playerId ? prediction : null,
    state: getRoomSafeState(room, pid),
  }));

  if (allPlayersPredicted(room)) {
    room.roundPhase = 'selecting';
    // Calcular orden de turnos antes de emitir
    room.turnOrder       = buildTurnOrder(room);
    room.currentTurnIndex = 0;

    broadcastToRoom(room, 'phase_changed', (pid) => ({
      phase: 'selecting',
      turnOrder: room.turnOrder,
      state: getRoomSafeState(room, pid),
    }));

    // Iniciar el primer turno
    setTimeout(() => startTurn(room), 500);
  }
}

function handleSelectDice(ws, { diceIndices }) {
  const meta = clients.get(ws);
  if (!meta) return sendError(ws, 'No estás en ninguna sala');
  const room = getRoomById(meta.roomId);
  if (!room || room.status !== 'playing') return sendError(ws, 'Partida no activa');
  if (room.roundPhase !== 'selecting') return sendError(ws, 'No es momento de seleccionar');

  // Validar que sea el turno del jugador
  const currentTurnId = getCurrentTurnPlayerId(room);
  if (meta.playerId !== currentTurnId) {
    return sendError(ws, 'No es tu turno');
  }

  const player = room.players.get(meta.playerId);
  if (player.presentedDice.length > 0) return sendError(ws, 'Ya presentaste tus dados');

  try {
    const updated = applyDiceSelection(player, diceIndices);
    room.players.set(meta.playerId, updated);
  } catch (e) {
    return sendError(ws, e.message);
  }

  clearTurnTimer(room);

  broadcastToRoom(room, 'dice_selected', (pid) => ({
    state: getRoomSafeState(room, pid),
    selectedPlayerId: meta.playerId,
    handName: room.players.get(meta.playerId).hand?.name,
  }));

  advanceTurn(room);
}

// ─── Flujo de ronda ───────────────────────────────────────────────────────────

function startRound(room) {
  room.status = 'playing';
  room.currentRound++;

  const firstOfLaunch = isFirstRoundOfLaunch(room.currentRound);
  const launchNumber  = getLaunchNumber(room.currentRound);

  if (firstOfLaunch) {
    room.roundPhase = 'rolling';
    for (const [pid, player] of room.players.entries()) {
      room.players.set(pid, {
        ...player,
        hasRolled: false, allDice: [], usedDiceIndices: [],
        presentedDice: [], hand: null, roundPoints: 0,
        prediction: null, hasPredicted: false, launchPoints: 0,
      });
    }
  } else {
    room.roundPhase = 'selecting';
    // Calcular orden de turnos para rondas 2-3 del lanzamiento
    room.turnOrder        = buildTurnOrder(room);
    room.currentTurnIndex = 0;
    for (const [pid, player] of room.players.entries()) {
      room.players.set(pid, { ...player, presentedDice: [], hand: null, roundPoints: 0 });
    }
  }

  broadcastToRoom(room, 'round_started', (pid) => ({
    round: room.currentRound, totalRounds: TOTAL_ROUNDS,
    launch: launchNumber, isFirstRoundOfLaunch: firstOfLaunch,
    state: getRoomSafeState(room, pid),
  }));

  if (!firstOfLaunch) {
    broadcastToRoom(room, 'phase_changed', (pid) => ({
      phase: 'selecting',
      turnOrder: room.turnOrder,
      state: getRoomSafeState(room, pid),
    }));
    setTimeout(() => startTurn(room), 500);
  }
}

async function endRound(room) {
  if (room.roundPhase === 'scoring') {
    console.log(`⚠️  endRound ignorado — sala ${room.code} ya en scoring`);
    return;
  }
  room.roundPhase = 'scoring';
  clearTurnTimer(room);

  const snapshot = resolveRound(room);
  room.roundLogs.push(snapshot);

  broadcastToRoom(room, 'round_ended', (pid) => ({
    round: room.currentRound, snapshot, state: getRoomSafeState(room, pid),
  }));

  if (room.currentRound >= TOTAL_ROUNDS) {
    await endGame(room);
  } else {
    setTimeout(() => startRound(room), 3000);
  }
}

async function endGame(room) {
  room.status = 'finished';

  // Ordenar jugadores por puntos totales para determinar podio
  const rankedPlayers = [...room.players.values()]
    .sort((a, b) => b.totalPoints - a.totalPoints);

  const winner = rankedPlayers[0];

  // Construir info del podio para enviar al cliente
  const podium = rankedPlayers.slice(0, 3).map((p, i) => ({
    id: p.id, name: p.name, totalPoints: p.totalPoints, position: i + 1,
  }));

  broadcastToRoom(room, 'game_over', (pid) => ({
    winner: { id: winner.id, name: winner.name, totalPoints: winner.totalPoints },
    podium,
    roundLogs: room.roundLogs,
    state: getRoomSafeState(room, pid),
  }));

  try {
    await persistGameResult(room);
    console.log(`✅ Partida ${room.id} persistida`);
  } catch (err) {
    console.error(`❌ Error persistiendo:`, err.message);
  }

  // Actualizar estadísticas globales solo para el podio (top 3)
  // Solo jugadores registrados (con cuenta) acumulan puntos globales
  try {
    for (let i = 0; i < Math.min(3, rankedPlayers.length); i++) {
      const p = rankedPlayers[i];
      await updatePlayerStats(p.name, p.totalPoints, i + 1);
    }
  } catch (err) {
    console.error(`❌ Error actualizando stats:`, err.message);
  }
}

// ─── Reconexión / Desconexión ─────────────────────────────────────────────────

function handleReconnect(ws, { playerId, roomCode }) {
  const room = getRoomByCode(roomCode);
  if (!room) return sendError(ws, 'Sala no encontrada');
  const player = room.players.get(playerId);
  if (!player) return sendError(ws, 'Jugador no encontrado');
  if (player.isConnected) return sendError(ws, 'Ya está conectado');

  if (autoPredictTimers.has(playerId)) {
    clearTimeout(autoPredictTimers.get(playerId));
    autoPredictTimers.delete(playerId);
  }
  if (roomCleanupTimers.has(room.id)) {
    clearTimeout(roomCleanupTimers.get(room.id));
    roomCleanupTimers.delete(room.id);
  }

  player.isConnected = true;
  clients.set(ws, { playerId, roomId: room.id, role: 'player' });

  send(ws, 'reconnected', {
    playerId, state: getRoomSafeState(room, playerId),
    currentRound: room.currentRound, roundPhase: room.roundPhase,
    totalRounds: TOTAL_ROUNDS,
    currentTurnPlayerId: getCurrentTurnPlayerId(room),
  });

  broadcastToRoom(room, 'player_reconnected', (pid) => ({
    reconnectedPlayerId: playerId, reconnectedPlayerName: player.name,
    state: getRoomSafeState(room, pid),
  }));
}

function handleDisconnect(ws) {
  const meta = clients.get(ws);
  if (!meta) return;
  const { playerId, roomId, role } = meta;
  const room = getRoomById(roomId);

  if (room) {
    if (role === 'spectator') {
      const s = room.spectators.get(playerId);
      if (s) {
        s.isConnected = false;
        room.spectators.delete(playerId);
        broadcastToRoom(room, 'spectator_left', (pid) => ({
          spectatorId: playerId,
          state: pid ? getRoomSafeState(room, pid) : getRoomStateForSpectator(room),
        }));
      }
      clients.delete(ws);
      return;
    }

    const player = room.players.get(playerId);
    if (player) {
      player.isConnected = false;
      console.log(`⚠️  ${player.name} desconectado de sala ${room.code}`);

      broadcastToRoom(room, 'player_disconnected', (pid) => ({
        disconnectedPlayerId: playerId, disconnectedPlayerName: player.name,
        reconnectWindowMs: RECONNECT_WINDOW_MS,
        state: getRoomSafeState(room, pid),
      }));

      // Auto-predicción si es su turno de predecir
      if (room.status === 'playing' && room.roundPhase === 'predicting' && !player.hasPredicted) {
        const timer = setTimeout(() => {
          const p = room.players.get(playerId);
          if (p && !p.isConnected && !p.hasPredicted) {
            const pred = autoPredict();
            room.players.set(playerId, applyPrediction(p, pred));
            broadcastToRoom(room, 'prediction_made', (pid) => ({
              playerId, playerName: player.name, prediction: null,
              state: getRoomSafeState(room, pid),
            }));
            if (room.roundPhase === 'predicting' && allPlayersPredicted(room)) {
              room.roundPhase = 'selecting';
              room.turnOrder        = buildTurnOrder(room);
              room.currentTurnIndex = 0;
              broadcastToRoom(room, 'phase_changed', (pid) => ({
                phase: 'selecting', turnOrder: room.turnOrder,
                state: getRoomSafeState(room, pid),
              }));
              setTimeout(() => startTurn(room), 500);
            }
          }
          autoPredictTimers.delete(playerId);
        }, AUTO_PREDICT_TIMEOUT_MS);
        autoPredictTimers.set(playerId, timer);
      }

      // Si es el turno del jugador desconectado → auto-select inmediato
      if (room.status === 'playing' && room.roundPhase === 'selecting') {
        const currentTurnId = getCurrentTurnPlayerId(room);
        if (currentTurnId === playerId && player.presentedDice.length === 0) {
          clearTurnTimer(room);
          setTimeout(() => autoSelectCurrentPlayer(room, playerId), 2000);
        }
      }

      // Cleanup si todos están desconectados
      const anyConnected = [...room.players.values()].some(p => p.isConnected);
      if (!anyConnected) {
        const t = setTimeout(() => {
          if ([...room.players.values()].every(p => !p.isConnected)) {
            console.log(`🗑️  Sala ${room.code} eliminada`);
            removeRoom(roomId);
          }
          roomCleanupTimers.delete(roomId);
        }, RECONNECT_WINDOW_MS);
        roomCleanupTimers.set(roomId, t);
      }
    }
  }
  clients.delete(ws);
}

// ─── Router ───────────────────────────────────────────────────────────────────

const EVENT_HANDLERS = {
  create_room:     handleCreateRoom,
  join_room:       handleJoinRoom,
  reconnect:       handleReconnect,
  player_ready:    (ws) => handlePlayerReady(ws),
  roll_dice:       (ws) => handleRollDice(ws),
  make_prediction: (ws, p) => handleMakePrediction(ws, p),
  select_dice:     (ws, p) => handleSelectDice(ws, p),
  start_game:      (ws) => handleStartGame(ws),
};

function handleConnection(ws) {
  console.log('🔌 Nueva conexión WebSocket');
  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return sendError(ws, 'Mensaje inválido'); }
    const handler = EVENT_HANDLERS[msg.type];
    if (handler) handler(ws, msg.payload || {});
    else sendError(ws, `Evento desconocido: ${msg.type}`);
  });
  ws.on('close', () => handleDisconnect(ws));
  ws.on('error', (err) => { console.error('WS error:', err.message); handleDisconnect(ws); });
}

module.exports = { handleConnection };