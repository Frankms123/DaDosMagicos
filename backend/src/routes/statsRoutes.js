const express = require('express');
const {
  getDailyRanking, getWeeklyRanking,
  getPlayerPeriodPosition, getPlayerStats,
} = require('../db/playerRepository');

const router = express.Router();

/**
 * GET /api/stats/ranking/daily?name=Kevin
 * Top 10 del día con posición del jugador si no está en top.
 */
router.get('/ranking/daily', async (req, res) => {
  try {
    const { name } = req.query;
    const ranking = await getDailyRanking(10);

    let myPosition = null;
    if (name) {
      const now   = new Date();
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      const inTop = ranking.find(p => p.name === name);
      if (!inTop) {
        myPosition = await getPlayerPeriodPosition(name, start, now);
      }
    }

    res.json({ ranking, myPosition });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error obteniendo ranking diario' });
  }
});

/**
 * GET /api/stats/ranking/weekly?name=Kevin
 * Top 10 de la semana (lunes–domingo) con posición del jugador si no está en top.
 */
router.get('/ranking/weekly', async (req, res) => {
  try {
    const { name } = req.query;
    const ranking = await getWeeklyRanking(10);

    let myPosition = null;
    if (name) {
      const now = new Date();
      const day = now.getDay();
      const daysFromMonday = day === 0 ? 6 : day - 1;
      const monday = new Date(now);
      monday.setDate(now.getDate() - daysFromMonday);
      monday.setHours(0, 0, 0, 0);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);

      const inTop = ranking.find(p => p.name === name);
      if (!inTop) {
        myPosition = await getPlayerPeriodPosition(name, monday, sunday);
      }
    }

    res.json({ ranking, myPosition });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error obteniendo ranking semanal' });
  }
});

/**
 * GET /api/stats/player/:name
 */
router.get('/player/:name', async (req, res) => {
  try {
    const stats = await getPlayerStats(req.params.name);
    if (!stats) return res.status(404).json({ error: 'Jugador no encontrado' });
    res.json({ stats });
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo stats' });
  }
});

module.exports = router;