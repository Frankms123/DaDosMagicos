const { MongoClient } = require('mongodb');

let client;
let db;

async function connect() {
  if (db) return db;

  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('La variable de entorno MONGO_URI no está definida');
  }
  client = new MongoClient(uri);
  await client.connect();
  db = client.db(process.env.MONGODB_DB || 'dado_triple');
  console.log('📦 Conectado a MongoDB');
  return db;
}

/**
 * Persiste el resultado final de una partida.
 * MongoDB es ideal aquí porque el esquema es flexible y podemos guardar los snapshots de cada ronda sin transformarlos.
 *
 * Estructura del documento guardado:
 * {
 *   gameId: string,
 *   startedAt: Date,
 *   finishedAt: Date,
 *   players: [...],   // info básica de cada jugador
 *   rounds: [...]     // array con los snapshots de las 3 rondas
 * }
 */
async function persistGameResult(room) {
  const database = await connect();

  const players = [...room.players.values()].map(p => ({
    id: p.id,
    name: p.name,
    totalPoints: p.totalPoints,
  }));

  await database.collection('games').insertOne({
    gameId: room.id,
    roomCode: room.code,
    startedAt: room.createdAt,
    finishedAt: new Date(),
    players,
    rounds: room.roundLogs,   // los 3 snapshots tal cual, sin serializar
  });
}

/**
 * Consulta el historial completo de una partida (para replay).
 */
async function getGameHistory(gameId) {
  const database = await connect();

  return database.collection('games').findOne(
    { gameId },
    { projection: { _id: 0, rounds: 1, players: 1 } }
  );
}

/**
 * Historial de partidas de un jugador por nombre.
 */
async function getPlayerHistory(playerName) {
  const database = await connect();

  return database.collection('games')
    .find({ 'players.name': playerName })
    .sort({ finishedAt: -1 })
    .limit(20)
    .toArray();
}

module.exports = { connect, persistGameResult, getGameHistory, getPlayerHistory };