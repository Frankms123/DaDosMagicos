const { connect } = require('./repository');

async function setupPlayerCollection() {
  const db = await connect();
  try {
    const collections = await db.listCollections({ name: 'players' }).toArray();
    const validator = {
      $jsonSchema: {
        bsonType: 'object',
        required: ['id', 'name', 'email', 'password', 'createdAt', 'status'],
        properties: {
          id:        { bsonType: 'string' },
          name:      { bsonType: 'string' },
          email:     { bsonType: 'string', pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$' },
          password:  { bsonType: 'string' },
          createdAt: { bsonType: 'date' },
          status:    { enum: ['active', 'inactive', 'pending'] },
          totalScore:  { bsonType: ['int', 'double'] },
          gamesPlayed: { bsonType: ['int', 'double'] },
          podiums:     { bsonType: ['int', 'double'] },
          wins:        { bsonType: ['int', 'double'] },
        }
      }
    };
    if (collections.length === 0) {
      await db.createCollection('players', { validator });
    } else {
      await db.command({ collMod: 'players', validator });
    }
    await db.collection('players').createIndex({ email: 1 }, { unique: true });
    await db.collection('players').createIndex({ totalScore: -1 });
    console.log('✅ Player collection configured');
  } catch (err) {
    console.error('❌ Error setting up player collection:', err);
  }
}

async function createPlayer(playerData) {
  const db = await connect();
  const { id, name, email, password } = playerData;
  return db.collection('players').insertOne({
    id, name, email, password,
    createdAt: new Date(),
    status: 'active',
    totalScore: 0,
    gamesPlayed: 0,
    podiums: 0,
    wins: 0,
  });
}

async function getPlayerByEmail(email) {
  const db = await connect();
  return db.collection('players').findOne({ email });
}

async function getPlayerByName(name) {
  const db = await connect();
  return db.collection('players').findOne({ name });
}

/**
 * Actualiza estadísticas globales del jugador si está registrado.
 * Solo se llama para jugadores en el podio (posiciones 1, 2, 3).
 * Guarda un entry con timestamp para rankings diario/semanal.
 */
async function updatePlayerStats(name, points, position) {
  const db = await connect();
  const player = await db.collection('players').findOne({ name });
  if (!player) {
    console.log(`ℹ️  Jugador "${name}" no registrado — stats no actualizadas`);
    return null;
  }

  const now = new Date();

  const inc = {
    totalScore:  points,
    gamesPlayed: 1,
    podiums:     1,
  };
  if (position === 1) inc.wins = 1;

  // Actualizar stats globales y agregar entry con timestamp
  await db.collection('players').updateOne(
    { name },
    {
      $inc: inc,
      $push: {
        scoreHistory: {
          points,
          position,
          playedAt: now,
        }
      }
    }
  );
  console.log(`✅ Stats de "${name}" actualizadas: +${points}pts, pos ${position}`);
  return true;
}

async function getGlobalRanking(limit = 10) {
  const db = await connect();
  return db.collection('players')
    .find(
      { gamesPlayed: { $gt: 0 } },
      { projection: { _id: 0, name: 1, totalScore: 1, gamesPlayed: 1, podiums: 1, wins: 1 } }
    )
    .sort({ totalScore: -1 })
    .limit(limit)
    .toArray();
}

/**
 * Ranking de puntos obtenidos dentro de un rango de fechas.
 * Agrupa los scoreHistory entries del período y suma sus puntos.
 */
async function getRanking(from, to, limit = 10) {
  const db = await connect();
  const result = await db.collection('players').aggregate([
    // Expandir el array scoreHistory en documentos individuales
    { $unwind: '$scoreHistory' },
    // Filtrar solo los del período
    {
      $match: {
        'scoreHistory.playedAt': { $gte: from, $lte: to }
      }
    },
    // Agrupar por jugador y sumar puntos del período
    {
      $group: {
        _id: '$name',
        name:       { $first: '$name' },
        periodScore: { $sum: '$scoreHistory.points' },
        games:       { $sum: 1 },
        podiums:     { $sum: 1 },
        wins: {
          $sum: { $cond: [{ $eq: ['$scoreHistory.position', 1] }, 1, 0] }
        }
      }
    },
    { $sort: { periodScore: -1 } },
    { $limit: limit },
    {
      $project: {
        _id: 0, name: 1, periodScore: 1, games: 1, podiums: 1, wins: 1
      }
    }
  ]).toArray();
  return result;
}

/**
 * Ranking del día (medianoche → ahora).
 */
async function getDailyRanking(limit = 10) {
  const now   = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return getRanking(start, now, limit);
}

/**
 * Ranking semanal (lunes 00:00 → domingo 23:59 de la semana actual).
 */
async function getWeeklyRanking(limit = 10) {
  const now  = new Date();
  const day  = now.getDay(); // 0=dom, 1=lun ... 6=sab
  // Ajustar para que la semana empiece el lunes
  const daysFromMonday = day === 0 ? 6 : day - 1;

  const monday = new Date(now);
  monday.setDate(now.getDate() - daysFromMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return getRanking(monday, sunday, limit);
}

/**
 * Posición global de un jugador en el ranking del período.
 */
async function getPlayerPeriodPosition(name, from, to) {
  const db = await connect();
  const all = await getRanking(from, to, 1000);
  const pos = all.findIndex(p => p.name === name);
  if (pos === -1) return null;
  return { position: pos + 1, total: all.length, score: all[pos].periodScore };
}

async function getPlayerStats(name) {
  const db = await connect();
  return db.collection('players').findOne(
    { name },
    { projection: { _id: 0, name: 1, totalScore: 1, gamesPlayed: 1, podiums: 1, wins: 1, email: 1 } }
  );
}

module.exports = {
  setupPlayerCollection, createPlayer, getPlayerByEmail,
  getPlayerByName, updatePlayerStats,
  getGlobalRanking, getDailyRanking, getWeeklyRanking,
  getPlayerPeriodPosition, getPlayerStats,
};