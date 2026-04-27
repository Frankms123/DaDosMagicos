const { MongoClient } = require('mongodb');

let client;
let db;

async function connect() {
  if (db) return db;

  client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  db = client.db(process.env.MONGODB_DB || 'dado_triple');
  console.log('📦 Conectado a MongoDB');
  return db;
}

/**
 * Persiste la partida completa en un solo documento al finalizar.
 * MongoDB es ideal aquí: el snapshot JSONB de Postgres es simplemente
 * un objeto nativo en Mongo, sin conversión.
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
  const now      = new Date();

  // ── Resumen de jugadores ──────────────────────────────────────────────────
  const playersSummary = [...room.players.values()]
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .map((p, i) => ({
      id:          p.id,
      name:        p.name,
      position:    i + 1,
      totalPoints: p.totalPoints,
    }));

  // ── Bitácora por lanzamiento ──────────────────────────────────────────────
  // Agrupar los 9 roundLogs en 3 lanzamientos de 3 rondas cada uno
  const launches = [1, 2, 3].map(launchNum => {
    const launchRounds = room.roundLogs.filter(r => r.launch === launchNum);
    const lastRound    = launchRounds.find(r => r.isLastRoundOfLaunch);

    // Datos por jugador en este lanzamiento
    const playerLaunchData = [...room.players.keys()].map(pid => {
      // Sacar el estado del jugador del snapshot de la última ronda del lanzamiento
      const snap = lastRound?.players.find(p => p.id === pid);
      if (!snap) return null;

      return {
        id:             pid,
        name:           snap.name,
        allDice:        snap.allDice,
        visibleDice:    snap.visibleDice,
        hiddenDice:     snap.hiddenDice,
        prediction:     snap.prediction,
        predictionHit:  snap.predictionHit,
        launchPoints:   snap.launchPoints,
        predictionBonus:snap.predictionBonus,
      };
    }).filter(Boolean);

    // Rondas del lanzamiento con detalle
    const roundsDetail = launchRounds.map(r => ({
      round:          r.round,
      roundInLaunch:  r.roundInLaunch,
      turnOrder:      r.turnOrder,
      players: r.players.map(p => ({
        id:            p.id,
        name:          p.name,
        position:      p.position,
        availableBeforeSelection: p.availableBeforeSelection,
        presentedDice: p.presentedDice,
        presentedIndices: p.presentedIndices,
        hand:          p.hand,
        basePoints:    p.basePoints,
        predictionBonus: p.predictionBonus,
        launchPoints:  p.launchPoints,
        totalPoints:   p.totalPoints,
      })),
      timestamp: r.timestamp,
    }));

    return {
      launch:        launchNum,
      playerData:    playerLaunchData,   // dados lanzados + predicción + resultado del lance
      rounds:        roundsDetail,        // detalle de cada una de las 3 rondas
      launchSummary: lastRound?.launchSummary ?? null,  // resumen al final del lanzamiento
    };
  });

  // ── Resultados finales ────────────────────────────────────────────────────
  const finalResults = playersSummary.map(p => {
    // Calcular puntos base totales (sin bonus) para contraste
    const baseTotal = room.roundLogs.reduce((sum, r) => {
      const rp = r.players.find(rpl => rpl.id === p.id);
      return sum + (rp?.basePoints ?? 0);
    }, 0);
    const bonusTotal = room.roundLogs.reduce((sum, r) => {
      const rp = r.players.find(rpl => rpl.id === p.id);
      return sum + (rp?.predictionBonus ?? 0);
    }, 0);
    return {
      ...p,
      basePointsTotal:       Math.round(baseTotal  * 10) / 10,
      predictionBonusTotal:  Math.round(bonusTotal * 10) / 10,
    };
  });

  await database.collection('games').insertOne({
    gameId:     room.id,
    roomCode:   room.code,
    startedAt:  room.createdAt,
    finishedAt: now,
    durationMs: now - room.createdAt,
    playerCount: room.players.size,

    // Resumen rápido (para queries sin necesidad de unwind)
    players:      playersSummary,
    winner:       playersSummary[0] ?? null,

    // Bitácora completa estructurada por lanzamiento
    launches,

    // Resultados finales con desglose base vs bonus
    finalResults,
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