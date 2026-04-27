const { v4: uuidv4 } = require('uuid');

const rooms = new Map();

function createRoom(maxPlayers = 4) {
  const room = {
    id: uuidv4(),
    code: generateRoomCode(),
    status: 'waiting',
    maxPlayers,
    players: new Map(),
    spectators: new Map(),
    currentRound: 0,
    roundPhase: null,
    roundLogs: [],
    createdAt: new Date(),
    // ── Turno secuencial ──────────────────────────────────────────────────────
    turnOrder: [],         // [playerId, ...] orden de presentación de esta ronda
    currentTurnIndex: 0,  // índice del jugador activo en turnOrder
  };
  rooms.set(room.id, room);
  return room;
}

function getRoomById(id)   { return rooms.get(id) || null; }
function removeRoom(id)    { rooms.delete(id); }

function getRoomByCode(code) {
  for (const r of rooms.values())
    if (r.code === code.toUpperCase()) return r;
  return null;
}

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from({ length: 4 }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join('');
  } while (getRoomByCode(code));
  return code;
}

// ─── Turno ────────────────────────────────────────────────────────────────────

/**
 * Devuelve el playerId del jugador cuyo turno es activo.
 */
function getCurrentTurnPlayerId(room) {
  if (!room.turnOrder.length) return null;
  return room.turnOrder[room.currentTurnIndex % room.turnOrder.length];
}

/**
 * Calcula el orden de presentación para esta ronda.
 * Ronda 1: aleatorio. Rondas 2-9: empieza el de más puntos, sigue circular.
 */
function buildTurnOrder(room) {
  const connected = [...room.players.entries()]
    .filter(([, p]) => p.isConnected)
    .map(([id]) => id);

  if (room.currentRound === 1) {
    // Aleatorio — Fisher-Yates shuffle
    const arr = [...connected];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // Rondas 2-9: empieza el de más puntos acumulados
  const sorted = [...connected].sort((a, b) => {
    const pa = room.players.get(a)?.totalPoints ?? 0;
    const pb = room.players.get(b)?.totalPoints ?? 0;
    return pb - pa; // descendente
  });

  // Rotar el orden anterior para mantener la secuencia circular
  // El jugador con más puntos va primero, los demás siguen en el orden
  // que ya tenían relativo entre sí
  return sorted;
}

// ─── Estado visible de presentación ──────────────────────────────────────────

/**
 * Dados visibles de un jugador para otros — oculta los dados de índice 9 y 10.
 * Si el jugador usó uno o ambos dados ocultos, devuelve null en esa posición
 * hasta que llegue el round_ended.
 */
function maskHiddenDice(presentedDice, presentedDiceIndices) {
  if (!presentedDice || presentedDice.length === 0) return [];
  if (!presentedDiceIndices || presentedDiceIndices.length === 0) return presentedDice;

  return presentedDice.map((val, i) => {
    const idx = presentedDiceIndices[i];
    // Índices 9 y 10 son dados ocultos — enmascarar con null
    if (idx === 9 || idx === 10) return null;
    return val;
  });
}

// ─── Builders ─────────────────────────────────────────────────────────────────

function buildPlayerList(room, requestingPlayerId) {
  const currentTurnId = getCurrentTurnPlayerId(room);

  return [...room.players.entries()].map(([pid, player]) => {
    const isMe = pid === requestingPlayerId;

    // Dados presentados: visibles para todos pero con dados ocultos enmascarados
    const rawPresented = player.presentedDice ?? [];
    const maskedPresented = isMe
      ? rawPresented  // el dueño siempre ve sus propios dados
      : maskHiddenDice(rawPresented, player.presentedDiceIndices);

    // La mano solo se muestra si no hay dados ocultos enmascarados
    const hasHiddenMasked = !isMe && maskedPresented.some(d => d === null);
    const hand = rawPresented.length > 0 && !hasHiddenMasked ? player.hand : null;

    return {
      id: pid,
      name: player.name,
      isReady: player.isReady,
      hasRolled: player.hasRolled,
      // Dados visibles (0-8) se muestran a todos; ocultos (9-10) solo al dueño
      allDice: player.allDice.length > 0
        ? (isMe ? player.allDice : [...player.allDice.slice(0, 9), null, null])
        : (isMe ? player.allDice : []),
      usedDiceIndices: isMe ? player.usedDiceIndices : null,
      presentedDiceIndices: isMe ? player.presentedDiceIndices : null,
      presentedDice: maskedPresented,
      hasSelectedDice: rawPresented.length > 0,
      hand,
      roundPoints: player.roundPoints,
      totalPoints: player.totalPoints,
      isConnected: player.isConnected,
      isMyTurn: pid === currentTurnId,
      hasPredicted: player.hasPredicted,
      prediction: isMe ? player.prediction : null,
    };
  });
}

function buildSpectatorList(room) {
  return [...room.spectators.values()].map(s => ({
    id: s.id, name: s.name, isConnected: s.isConnected,
  }));
}

function buildRoomBase(room) {
  return {
    id: room.id, code: room.code, status: room.status,
    maxPlayers: room.maxPlayers, currentRound: room.currentRound,
    roundPhase: room.roundPhase, spectators: buildSpectatorList(room),
    currentTurnPlayerId: getCurrentTurnPlayerId(room),
    turnOrder: room.turnOrder,
  };
}

function getRoomSafeState(room, requestingPlayerId) {
  return { ...buildRoomBase(room), players: buildPlayerList(room, requestingPlayerId) };
}

function getRoomStateForSpectator(room) {
  return { ...buildRoomBase(room), players: buildPlayerList(room, null) };
}

module.exports = {
  createRoom, getRoomById, getRoomByCode, removeRoom,
  getRoomSafeState, getRoomStateForSpectator,
  getCurrentTurnPlayerId, buildTurnOrder,
};