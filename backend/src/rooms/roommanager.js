const { v4: uuidv4 } = require('uuid');

// Estado global en memoria — nunca toca la BD durante la partida
const rooms = new Map();

/**
 * Estructura de una sala:
 * {
 *   id: string,
 *   code: string,          // código corto para unirse (ej: "ABC1")
 *   status: 'waiting' | 'playing' | 'finished',
 *   maxPlayers: number,
 *   players: Map<playerId, PlayerState>,
 *   spectators: Map<spectatorId, SpectatorState>,
 *   currentRound: number,  // 1, 2 o 3
 *   roundPhase: 'rolling' | 'selecting' | 'revealing' | 'scoring',
 *   roundLogs: [],         // snapshots de cada ronda para persistir al final
 *   createdAt: Date,
 * }
 */

function createRoom(maxPlayers = 4) {
  const id = uuidv4();
  const code = generateRoomCode();

  const room = {
    id,
    code,
    status: 'waiting',
    maxPlayers,
    players: new Map(),
    spectators: new Map(),  // Map<spectatorId, { id, name, isConnected }>
    currentRound: 0,
    roundPhase: null,
    roundLogs: [],
    createdAt: new Date(),
  };

  rooms.set(id, room);
  return room;
}

function getRoomById(roomId) {
  return rooms.get(roomId) || null;
}

function getRoomByCode(code) {
  for (const room of rooms.values()) {
    if (room.code === code.toUpperCase()) return room;
  }
  return null;
}

function removeRoom(roomId) {
  rooms.delete(roomId);
}

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from({ length: 4 }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join('');
  } while (getRoomByCode(code)); // garantiza unicidad
  return code;
}

// Construye la lista de jugadores filtrada por quién pregunta
function buildPlayerList(room, requestingPlayerId) {
  const players = [];
  for (const [pid, player] of room.players.entries()) {
    const isMe = pid === requestingPlayerId;
    players.push({
      id: pid,
      name: player.name,
      isReady: player.isReady,
      hasRolled: player.hasRolled,
      allDice: isMe ? player.allDice : null,              // solo el dueño ve sus dados
      presentedDice: player.presentedDice,                // visibles para todos
      hasSelectedDice: player.presentedDice?.length > 0,
      hand: player.presentedDice?.length > 0 ? player.hand : null,
      roundPoints: player.roundPoints,
      totalPoints: player.totalPoints,
      isConnected: player.isConnected,
    });
  }
  return players;
}

function buildSpectatorList(room) {
  return [...room.spectators.values()].map(s => ({
    id: s.id,
    name: s.name,
    isConnected: s.isConnected,
  }));
}

function buildRoomBase(room) {
  return {
    id: room.id,
    code: room.code,
    status: room.status,
    maxPlayers: room.maxPlayers,
    currentRound: room.currentRound,
    roundPhase: room.roundPhase,
    spectators: buildSpectatorList(room),
  };
}

// Para jugadores — incluye sus propios dados completos
function getRoomSafeState(room, requestingPlayerId) {
  return {
    ...buildRoomBase(room),
    players: buildPlayerList(room, requestingPlayerId),
  };
}

// Para espectadores — nunca ven dados ocultos de nadie
function getRoomStateForSpectator(room) {
  return {
    ...buildRoomBase(room),
    players: buildPlayerList(room, null),  // null = nadie es "yo", todos filtrados
  };
}

module.exports = {
  createRoom,
  getRoomById,
  getRoomByCode,
  removeRoom,
  getRoomSafeState,
  getRoomStateForSpectator,
};