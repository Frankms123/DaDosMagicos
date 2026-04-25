const { v4: uuidv4 } = require('uuid');
const {
  createRoom,
  getRoomById,
  getRoomByCode,
  removeRoom,
  getRoomSafeState,
  getRoomStateForSpectator,
} = require('../rooms/roommanager');
const {
  TOTAL_ROUNDS,
  createPlayerState,
  applyRollToPlayer,
  prepareNextRound,
  applyDiceSelection,
  autoSelectBestDice,
  allPlayersReady,
  allPlayersRolled,
  allPlayersSelectedDice,
  resolveRound,
  getWinner,
} = require('../game/gameEngine');
const { persistGameResult } = require('../db/repository');

// Mapa: ws → { playerId, roomId }
const clients = new Map();

// ─── Helpers de emisión ───────────────────────────────────────────────────────

function send(ws, type, payload) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify({ type, payload }));
  }
}

function sendError(ws, message) {
  send(ws, 'error', { message });
}

function broadcastToRoom(room, type, payloadFn) {
  // Enviar a jugadores (con su estado personalizado)
  for (const [pid] of room.players.entries()) {
    const ws = getWsForPlayer(pid);
    if (ws) send(ws, type, payloadFn(pid));
  }
  // Enviar a espectadores (sin datos privados)
  for (const [sid] of room.spectators.entries()) {
    const ws = getWsForSpectator(sid);
    if (ws) send(ws, type, payloadFn(null)); // null = sin dados ocultos
  }
}

function getWsForPlayer(playerId) {
  for (const [ws, meta] of clients.entries()) {
    if (meta.playerId === playerId && meta.role !== 'spectator') return ws;
  }
  return null;
}

function getWsForSpectator(spectatorId) {
  for (const [ws, meta] of clients.entries()) {
    if (meta.playerId === spectatorId && meta.role === 'spectator') return ws;
  }
  return null;
}

// ─── Handlers de eventos ──────────────────────────────────────────────────────

function handleCreateRoom(ws, { playerName, maxPlayers }) {
  const playerId = uuidv4();
  const room = createRoom(maxPlayers || 4);
  const player = createPlayerState(playerId, playerName);

  room.players.set(playerId, player);
  clients.set(ws, { playerId, roomId: room.id });

  send(ws, 'room_created', {
    roomId: room.id,
    roomCode: room.code,
    playerId,
    state: getRoomSafeState(room, playerId),
  });
}

function handleJoinRoom(ws, { roomCode, playerName, role }) {
  const room = getRoomByCode(roomCode);
  if (!room) return sendError(ws, 'Sala no encontrada');

  // ── Espectador ────────────────────────────────────────────────────────────
  if (role === 'spectator') {
    // Los espectadores pueden unirse en cualquier momento — antes, durante o después
    if (room.status === 'finished') return sendError(ws, 'La partida ya terminó');

    const spectatorId = uuidv4();
    const spectator = {
      id: spectatorId,
      name: playerName || `Espectador`,
      isConnected: true,
    };

    room.spectators.set(spectatorId, spectator);
    clients.set(ws, { playerId: spectatorId, roomId: room.id, role: 'spectator' });

    send(ws, 'spectator_joined', {
      spectatorId,
      spectatorName: spectator.name,
      state: getRoomStateForSpectator(room),
    });

    // Notificar a todos (jugadores y otros espectadores)
    broadcastToRoom(room, 'spectator_entered', (pid) => ({
      spectator: { id: spectatorId, name: spectator.name },
      state: pid ? getRoomSafeState(room, pid) : getRoomStateForSpectator(room),
    }));

    console.log(`👁️  ${spectator.name} se unió como espectador a sala ${room.code}`);
    return;
  }

  // ── Jugador ───────────────────────────────────────────────────────────────
  if (room.status !== 'waiting') return sendError(ws, 'La partida ya comenzó');
  if (room.players.size >= room.maxPlayers) return sendError(ws, 'Sala llena');

  const playerId = uuidv4();
  const player = createPlayerState(playerId, playerName);
  room.players.set(playerId, player);
  clients.set(ws, { playerId, roomId: room.id, role: 'player' });

  send(ws, 'room_joined', {
    roomId: room.id,
    roomCode: room.code,
    playerId,
    state: getRoomSafeState(room, playerId),
  });

  broadcastToRoom(room, 'player_joined', (pid) => ({
    state: pid ? getRoomSafeState(room, pid) : getRoomStateForSpectator(room),
    newPlayer: { id: playerId, name: playerName },
  }));
}

function handlePlayerReady(ws, _payload) {
  const meta = clients.get(ws);
  if (!meta) return sendError(ws, 'No estás en ninguna sala');

  const room = getRoomById(meta.roomId);
  if (!room) return sendError(ws, 'Sala no encontrada');

  const player = room.players.get(meta.playerId);
  player.isReady = true;

  broadcastToRoom(room, 'player_ready', (pid) => ({
    state: getRoomSafeState(room, pid),
    readyPlayerId: meta.playerId,
  }));

  // Iniciar automáticamente si la sala está llena
  const salaLlena = room.players.size >= room.maxPlayers;
  if (salaLlena && allPlayersReady(room)) {
    startRound(room);
  }
}

function handleStartGame(ws, _payload) {
  const meta = clients.get(ws);
  if (!meta) return sendError(ws, 'No estás en ninguna sala');

  const room = getRoomById(meta.roomId);
  if (!room) return sendError(ws, 'Sala no encontrada');
  if (room.status !== 'waiting') return sendError(ws, 'La partida ya comenzó');
  if (room.players.size < 2) return sendError(ws, 'Se necesitan al menos 2 jugadores');

  // Solo el host (primer jugador) puede forzar el inicio
  const [hostId] = room.players.keys();
  if (meta.playerId !== hostId) return sendError(ws, 'Solo el host puede iniciar la partida');

  broadcastToRoom(room, 'game_starting', (pid) => ({
    state: getRoomSafeState(room, pid),
    startedBy: room.players.get(meta.playerId).name,
  }));

  startRound(room);
}

function handleRollDice(ws, _payload) {
  const meta = clients.get(ws);
  if (!meta) return sendError(ws, 'No estás en ninguna sala');

  const room = getRoomById(meta.roomId);
  if (!room || room.status !== 'playing') return sendError(ws, 'Partida no activa');

  // Solo se tiran dados en la ronda 1 — en rondas 2 y 3 se usan los mismos dados
  if (room.currentRound !== 1) {
    return sendError(ws, 'Los dados solo se tiran en la primera ronda');
  }
  if (room.roundPhase !== 'rolling') return sendError(ws, 'No es momento de tirar');

  const player = room.players.get(meta.playerId);
  if (player.hasRolled) return sendError(ws, 'Ya tiraste los dados');

  const updatedPlayer = applyRollToPlayer(player);
  room.players.set(meta.playerId, updatedPlayer);

  broadcastToRoom(room, 'dice_rolled', (pid) => ({
    state: getRoomSafeState(room, pid),
    rolledPlayerId: meta.playerId,
    diceCount: updatedPlayer.allDice.length,
  }));

  // Si todos tiraron, pasar a selección
  if (allPlayersRolled(room)) {
    room.roundPhase = 'selecting';
    broadcastToRoom(room, 'phase_changed', (pid) => ({
      phase: 'selecting',
      state: getRoomSafeState(room, pid),
    }));
  }
}

function handleSelectDice(ws, { diceIndices }) {
  const meta = clients.get(ws);
  if (!meta) return sendError(ws, 'No estás en ninguna sala');

  const room = getRoomById(meta.roomId);
  if (!room || room.status !== 'playing') return sendError(ws, 'Partida no activa');
  if (room.roundPhase !== 'selecting') return sendError(ws, 'No es momento de seleccionar');

  const player = room.players.get(meta.playerId);
  if (player.presentedDice.length > 0) return sendError(ws, 'Ya presentaste tus dados');

  try {
    const updatedPlayer = applyDiceSelection(player, diceIndices);
    room.players.set(meta.playerId, updatedPlayer);
  } catch (e) {
    return sendError(ws, e.message);
  }

  broadcastToRoom(room, 'dice_selected', (pid) => ({
    state: getRoomSafeState(room, pid),
    selectedPlayerId: meta.playerId,
    // Solo se revela la mano al terminar la ronda, no antes
    handName: room.players.get(meta.playerId).hand.name,
  }));

  // Si todos presentaron sus dados, resolver la ronda
  if (allPlayersSelectedDice(room)) {
    endRound(room);
  }
}

// ─── Flujo de ronda ───────────────────────────────────────────────────────────

function startRound(room) {
  room.status = 'playing';
  room.currentRound += 1;

  const isFirstRound = room.currentRound === 1;

  // Ronda 1: fase rolling (los jugadores tiran sus 11 dados)
  // Rondas 2-3: saltar directo a selecting (los dados persisten)
  room.roundPhase = isFirstRound ? 'rolling' : 'selecting';

  for (const [pid, player] of room.players.entries()) {
    const updatedPlayer = isFirstRound
      ? { ...player, hasRolled: false, allDice: [], usedDiceIndices: [], presentedDice: [], hand: null, roundPoints: 0 }
      : prepareNextRound(player);  // conserva allDice y usedDiceIndices
    room.players.set(pid, updatedPlayer);
  }

  broadcastToRoom(room, 'round_started', (pid) => ({
    round: room.currentRound,
    totalRounds: TOTAL_ROUNDS,
    isFirstRound,
    // Dados disponibles esta ronda (los no usados)
    state: getRoomSafeState(room, pid),
  }));

  // En rondas 2 y 3 ya no hay fase de tirada — notificar fase selecting inmediatamente
  if (!isFirstRound) {
    broadcastToRoom(room, 'phase_changed', (pid) => ({
      phase: 'selecting',
      state: getRoomSafeState(room, pid),
    }));
  }
}

async function endRound(room) {
  // Guard: evitar doble ejecución si ya está en scoring
  if (room.roundPhase === 'scoring') {
    console.log(`⚠️  endRound ignorado — sala ${room.code} ya está en scoring`);
    return;
  }
  room.roundPhase = 'scoring';

  // Calcular puntos y construir snapshot en un solo paso
  const snapshot = resolveRound(room);
  room.roundLogs.push(snapshot);

  broadcastToRoom(room, 'round_ended', (pid) => ({
    round: room.currentRound,
    snapshot,   // todos ven todas las manos y puntos al finalizar la ronda
    state: getRoomSafeState(room, pid),
  }));

  if (room.currentRound >= TOTAL_ROUNDS) {
    await endGame(room);
  } else {
    // Pausa breve y luego siguiente ronda
    setTimeout(() => startRound(room), 3000);
  }
}

async function endGame(room) {
  room.status = 'finished';
  const winner = getWinner(room);

  broadcastToRoom(room, 'game_over', (pid) => ({
    winner: { id: winner.id, name: winner.name, totalPoints: winner.totalPoints },
    roundLogs: room.roundLogs,
    state: getRoomSafeState(room, pid),
  }));

  // Persistir en BD
  try {
    await persistGameResult(room);
    console.log(`✅ Partida ${room.id} persistida correctamente`);
  } catch (err) {
    console.error(`❌ Error persistiendo partida ${room.id}:`, err.message);
  }
}

// ─── Reconexión ──────────────────────────────────────────────────────────────

const RECONNECT_WINDOW_MS   = 2 * 60 * 1000; // 2 minutos para reconectarse
const AUTO_SELECT_TIMEOUT_MS = 30 * 1000;     // 30s para auto-selección si estaba en turno

// roomId → timeoutId  (timer de eliminación de sala vacía)
const roomCleanupTimers = new Map();
// playerId → timeoutId (timer de auto-selección por jugador ausente)
const autoSelectTimers  = new Map();

function handleReconnect(ws, { playerId, roomCode }) {
  const room = getRoomByCode(roomCode);

  if (!room) return sendError(ws, 'Sala no encontrada o expirada');

  const player = room.players.get(playerId);
  if (!player) return sendError(ws, 'Jugador no encontrado en esta sala');
  if (player.isConnected) return sendError(ws, 'Este jugador ya está conectado');

  // Cancelar timer de auto-selección si estaba corriendo para este jugador
  if (autoSelectTimers.has(playerId)) {
    clearTimeout(autoSelectTimers.get(playerId));
    autoSelectTimers.delete(playerId);
    console.log(`⏱️  Auto-selección cancelada para ${player.name} (reconectó a tiempo)`);
  }

  // Cancelar timer de limpieza de sala si nadie quedaba
  if (roomCleanupTimers.has(room.id)) {
    clearTimeout(roomCleanupTimers.get(room.id));
    roomCleanupTimers.delete(room.id);
    console.log(`🏠 Timer de sala ${room.code} cancelado`);
  }

  // Restaurar conexión
  player.isConnected = true;
  clients.set(ws, { playerId, roomId: room.id });

  console.log(`🔄 ${player.name} reconectado a sala ${room.code}`);

  // Enviar estado completo actual para que el cliente se re-sincronice
  send(ws, 'reconnected', {
    playerId,
    state: getRoomSafeState(room, playerId),
    currentRound: room.currentRound,
    roundPhase: room.roundPhase,
    totalRounds: TOTAL_ROUNDS,
  });

  // Notificar a los demás
  broadcastToRoom(room, 'player_reconnected', (pid) => ({
    reconnectedPlayerId: playerId,
    reconnectedPlayerName: player.name,
    state: getRoomSafeState(room, pid),
  }));
}

function handleDisconnect(ws) {
  const meta = clients.get(ws);
  if (!meta) return;

  const { playerId, roomId, role } = meta;
  const room = getRoomById(roomId);

  if (room) {
    // ── Espectador se desconecta ──────────────────────────────────────────
    if (role === 'spectator') {
      const spectator = room.spectators.get(playerId);
      if (spectator) {
        spectator.isConnected = false;
        room.spectators.delete(playerId); // los espectadores no necesitan reconexión
        broadcastToRoom(room, 'spectator_left', (pid) => ({
          spectatorId: playerId,
          spectatorName: spectator.name,
          state: pid ? getRoomSafeState(room, pid) : getRoomStateForSpectator(room),
        }));
        console.log(`👁️  ${spectator.name} (espectador) salió de sala ${room.code}`);
      }
      clients.delete(ws);
      return;
    }

    // ── Jugador se desconecta ─────────────────────────────────────────────
    const player = room.players.get(playerId);
    if (player) {
      player.isConnected = false;
      console.log(`⚠️  ${player.name} se desconectó de sala ${room.code}`);

      broadcastToRoom(room, 'player_disconnected', (pid) => ({
        disconnectedPlayerId: playerId,
        disconnectedPlayerName: player.name,
        reconnectWindowMs: RECONNECT_WINDOW_MS,
        state: getRoomSafeState(room, pid),
      }));

      // Si la partida está activa y el jugador aún no eligió dados → iniciar timer de auto-selección
      if (room.status === 'playing' && room.roundPhase === 'selecting' && player.presentedDice.length === 0) {
        console.log(`⏱️  Auto-selección en ${AUTO_SELECT_TIMEOUT_MS / 1000}s para ${player.name}`);

        const timer = setTimeout(() => {
          const currentPlayer = room.players.get(playerId);
          // Solo actuar si sigue desconectado y aún no eligió
          if (currentPlayer && !currentPlayer.isConnected && currentPlayer.presentedDice.length === 0) {
            console.log(`🤖 Auto-seleccionando dados para ${player.name}`);
            const updated = autoSelectBestDice(currentPlayer);
            room.players.set(playerId, updated);

            broadcastToRoom(room, 'auto_selected', (pid) => ({
              playerId,
              playerName: player.name,
              hand: updated.hand.name,
              state: getRoomSafeState(room, pid),
            }));

            // Verificar fase antes de endRound para evitar doble ejecución
            if (room.roundPhase === 'selecting' && allPlayersSelectedDice(room)) {
              endRound(room);
            }
          }
          autoSelectTimers.delete(playerId);
        }, AUTO_SELECT_TIMEOUT_MS);

        autoSelectTimers.set(playerId, timer);
      }

      // Si no queda nadie conectado, iniciar timer de limpieza de sala
      const anyConnected = [...room.players.values()].some(p => p.isConnected);
      if (!anyConnected) {
        console.log(`🏠 Sala ${room.code} vacía — se eliminará en ${RECONNECT_WINDOW_MS / 1000}s`);

        const cleanupTimer = setTimeout(() => {
          const stillEmpty = [...room.players.values()].every(p => !p.isConnected);
          if (stillEmpty) {
            console.log(`🗑️  Sala ${room.code} eliminada por inactividad`);
            removeRoom(roomId);
          }
          roomCleanupTimers.delete(roomId);
        }, RECONNECT_WINDOW_MS);

        roomCleanupTimers.set(roomId, cleanupTimer);
      }
    }
  }

  clients.delete(ws);
}

// ─── Router principal ─────────────────────────────────────────────────────────

const EVENT_HANDLERS = {
  create_room:   handleCreateRoom,
  join_room:     handleJoinRoom,
  reconnect:     handleReconnect,
  player_ready:  handlePlayerReady,
  roll_dice:     handleRollDice,
  select_dice:   handleSelectDice,
  start_game:    handleStartGame,
};

function handleConnection(ws, req, wss) {
  console.log('🔌 Nueva conexión WebSocket');

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return sendError(ws, 'Mensaje inválido');
    }

    const handler = EVENT_HANDLERS[msg.type];
    if (handler) {
      handler(ws, msg.payload || {});
    } else {
      sendError(ws, `Evento desconocido: ${msg.type}`);
    }
  });

  ws.on('close', () => handleDisconnect(ws));
  ws.on('error', (err) => {
    console.error('WebSocket error:', err.message);
    handleDisconnect(ws);
  });
}

module.exports = { handleConnection };