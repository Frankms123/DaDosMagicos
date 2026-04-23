/**
 * setupIndexes.js
 * Crea los índices necesarios en MongoDB.
 * Ejecutar una sola vez: node src/db/setupIndexes.js
 */
require('dotenv').config();
const { connect } = require('./repository');
 
async function setup() {
  const db = await connect();
  const games = db.collection('games');
 
  // Búsqueda por ID de partida
  await games.createIndex({ gameId: 1 }, { unique: true });
 
  // Historial de un jugador por nombre
  await games.createIndex({ 'players.name': 1 });
 
  // Partidas recientes
  await games.createIndex({ finishedAt: -1 });
 
  console.log('✅ Índices creados correctamente');
  process.exit(0);
}
 
setup().catch(err => {
  console.error('❌ Error creando índices:', err.message);
  process.exit(1);
});