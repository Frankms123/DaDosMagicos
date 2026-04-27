/**
 * gameEngine.js
 * Lógica pura del juego Dado Triple — sin WebSocket ni BD aquí.
 *
 * Reglas:
 * - 3 lanzamientos × 3 rondas = 9 rondas totales
 * - Cada lanzamiento: tirar 11 dados nuevos → predecir → presentar 3 dados por ronda
 * - Predicción por lanzamiento (antes de la ronda 1 de ese lanzamiento):
 *     'high' → más de 10 pts   'mid' → 7-10 pts
 *     'low'  → 1-6 pts         'zero' → exactamente 0 pts
 * - Acertar: puntos × 2 (o 40 fijos si predijo 'zero' y obtuvo 0)
 * - No acertar: puntos normales sin modificar
 */

const TOTAL_ROUNDS    = 9;   // 3 lanzamientos × 3 rondas
const TOTAL_LAUNCHES  = 3;
const ROUNDS_PER_LAUNCH = 3;
const TOTAL_DICE      = 11;  // 9 visibles + 2 ocultos
const DICE_PER_ROUND  = 3;

// ─── Predicciones ─────────────────────────────────────────────────────────────

const PREDICTIONS = {
  high: { label: 'Más de 10 puntos',    min: 11, max: Infinity },
  mid:  { label: 'Entre 7 y 10 puntos', min: 7,  max: 10 },
  low:  { label: 'Entre 1 y 6 puntos',  min: 1,  max: 6 },
  zero: { label: 'Exactamente 0 puntos',min: 0,  max: 0 },
};

/**
 * Verifica si el total de puntos del lanzamiento coincide con la predicción.
 */
function checkPrediction(prediction, launchPoints) {
  const pred = PREDICTIONS[prediction];
  if (!pred) return false;
  return launchPoints >= pred.min && launchPoints <= pred.max;
}

/**
 * Calcula los puntos finales del lanzamiento aplicando el bonus de predicción.
 */
function applyPredictionBonus(prediction, launchPoints) {
  const hit = checkPrediction(prediction, launchPoints);
  if (!hit) return launchPoints; // sin cambio

  if (prediction === 'zero') return 40; // bonus especial
  return launchPoints * 2;             // doblar puntos
}

/**
 * Retorna el número de lanzamiento (1, 2, 3) dado el número de ronda (1-9).
 */
function getLaunchNumber(round) {
  return Math.ceil(round / ROUNDS_PER_LAUNCH);
}

/**
 * Retorna si una ronda es la primera de su lanzamiento.
 */
function isFirstRoundOfLaunch(round) {
  return (round - 1) % ROUNDS_PER_LAUNCH === 0;
}

/**
 * Retorna si una ronda es la última de su lanzamiento.
 */
function isLastRoundOfLaunch(round) {
  return round % ROUNDS_PER_LAUNCH === 0;
}

// ─── Tipos de mano ────────────────────────────────────────────────────────────

const HAND_RANK = { TRIO: 3, ESCALERA: 2, PAR: 1, NADA: 0 };
const HAND_NAME = { 3: 'Trío', 2: 'Escalera', 1: 'Par', 0: 'Nada' };

// Puntos por posición (índice 0 = 1er lugar)
const POSITION_POINTS = [6, 3, 1, 0];

// ─── Dados ────────────────────────────────────────────────────────────────────

function rollDie() {
  return Math.floor(Math.random() * 6) + 1;
}

function rollAllDice() {
  return Array.from({ length: TOTAL_DICE }, rollDie);
}

// ─── Evaluación de mano ───────────────────────────────────────────────────────

function evaluateHand(dice) {
  if (dice.length !== 3) throw new Error('La mano debe tener exactamente 3 dados');

  const sorted = [...dice].sort((a, b) => a - b);
  const counts = {};
  for (const d of sorted) counts[d] = (counts[d] || 0) + 1;

  const entries = Object.entries(counts).map(([face, count]) => ({
    face: Number(face), count,
  }));

  const trio = entries.find(e => e.count === 3);
  if (trio) return { rank: HAND_RANK.TRIO, tiebreaker: trio.face, name: `Trío de ${trio.face}`, dice };

  if (sorted[1] === sorted[0] + 1 && sorted[2] === sorted[1] + 1) {
    return { rank: HAND_RANK.ESCALERA, tiebreaker: sorted[2], name: `Escalera ${sorted.join('-')}`, dice };
  }

  const par = entries.find(e => e.count === 2);
  if (par) return { rank: HAND_RANK.PAR, tiebreaker: par.face, name: `Par de ${par.face}`, dice };

  return { rank: HAND_RANK.NADA, tiebreaker: sorted[2], name: `Nada (${sorted.join('-')})`, dice };
}

function compareHands(handA, handB) {
  if (handA.rank !== handB.rank) return handA.rank - handB.rank;
  return handA.tiebreaker - handB.tiebreaker;
}

// ─── Distribución de puntos por ronda ────────────────────────────────────────

function calculateRoundPoints(playerHands) {
  const sorted = [...playerHands].sort((a, b) => compareHands(b.hand, a.hand));
  const pointsMap = new Map();
  let i = 0;

  while (i < sorted.length) {
    const currentHand = sorted[i].hand;
    let j = i;
    while (j < sorted.length && compareHands(sorted[j].hand, currentHand) === 0) j++;

    const tiedCount = j - i;
    let totalPoints = 0;
    for (let k = i; k < j; k++) totalPoints += POSITION_POINTS[k] ?? 0;

    const pointsEach = Math.round((totalPoints / tiedCount) * 10) / 10;
    for (let k = i; k < j; k++) pointsMap.set(sorted[k].playerId, pointsEach);

    i = j;
  }

  return pointsMap;
}

// ─── Estado del jugador ───────────────────────────────────────────────────────

function createPlayerState(playerId, name) {
  return {
    id: playerId,
    name,
    isReady: false,
    hasRolled: false,
    allDice: [],
    usedDiceIndices: [],
    presentedDice: [],
    hand: null,
    roundPoints: 0,
    totalPoints: 0,
    isConnected: true,
    // Predicción por lanzamiento
    prediction: null,       // 'high' | 'mid' | 'low' | 'zero'
    hasPredicted: false,
    launchPoints: 0,        // puntos acumulados en el lanzamiento actual
  };
}

function applyRollToPlayer(player) {
  return {
    ...player,
    hasRolled: true,
    allDice: rollAllDice(),
    usedDiceIndices: [],
    presentedDice: [],
    presentedDiceIndices: [],
    hand: null,
    roundPoints: 0,
    // Resetear predicción para el nuevo lanzamiento
    prediction: null,
    hasPredicted: false,
    launchPoints: 0,
  };
}

function prepareNextRound(player) {
  return {
    ...player,
    presentedDice: [],
    presentedDiceIndices: [],
    hand: null,
    roundPoints: 0,
  };
}

function applyPrediction(player, prediction) {
  if (!PREDICTIONS[prediction]) throw new Error(`Predicción inválida: ${prediction}`);
  if (player.hasPredicted) throw new Error('Ya hiciste tu predicción para este lanzamiento');
  return { ...player, prediction, hasPredicted: true };
}

function applyDiceSelection(player, diceIndices) {
  if (!Array.isArray(diceIndices) || diceIndices.length !== DICE_PER_ROUND) {
    throw new Error(`Debes seleccionar exactamente ${DICE_PER_ROUND} dados`);
  }
  if (new Set(diceIndices).size !== diceIndices.length) {
    throw new Error('No puedes seleccionar el mismo dado dos veces');
  }
  if (!diceIndices.every(i => Number.isInteger(i) && i >= 0 && i < player.allDice.length)) {
    throw new Error(`Índices fuera de rango (tienes ${player.allDice.length} dados)`);
  }
  const alreadyUsed = diceIndices.filter(i => player.usedDiceIndices.includes(i));
  if (alreadyUsed.length > 0) {
    throw new Error(`Los dados en posición [${alreadyUsed.join(', ')}] ya fueron presentados`);
  }

  const presentedDice = diceIndices.map(i => player.allDice[i]);
  const hand = evaluateHand(presentedDice);

  return {
    ...player,
    presentedDice,
    presentedDiceIndices: diceIndices,  // índices exactos seleccionados esta ronda
    hand,
    usedDiceIndices: [...player.usedDiceIndices, ...diceIndices],
  };
}

function autoSelectBestDice(player) {
  const available = player.allDice
    .map((val, idx) => ({ val, idx }))
    .filter(d => !player.usedDiceIndices.includes(d.idx));

  if (available.length < DICE_PER_ROUND) {
    throw new Error(`No hay suficientes dados (${available.length} de ${DICE_PER_ROUND})`);
  }

  let bestIndices = [0, 1, 2];
  let bestHand = evaluateHand([available[0].val, available[1].val, available[2].val]);

  for (let i = 0; i < available.length - 2; i++) {
    for (let j = i + 1; j < available.length - 1; j++) {
      for (let k = j + 1; k < available.length; k++) {
        const hand = evaluateHand([available[i].val, available[j].val, available[k].val]);
        if (compareHands(hand, bestHand) > 0) { bestHand = hand; bestIndices = [i, j, k]; }
      }
    }
  }

  const globalIndices = bestIndices.map(i => available[i].idx);
  return {
    ...player,
    presentedDice: globalIndices.map(i => player.allDice[i]),
    presentedDiceIndices: globalIndices,
    hand: bestHand,
    usedDiceIndices: [...player.usedDiceIndices, ...globalIndices],
  };
}

// Auto-predicción para jugador desconectado
function autoPredict() {
  return 'mid'; // predicción por defecto
}

// ─── Checks de sala ───────────────────────────────────────────────────────────

function allPlayersReady(room) {
  for (const p of room.players.values()) if (p.isConnected && !p.isReady) return false;
  return true;
}

function allPlayersRolled(room) {
  for (const p of room.players.values()) if (p.isConnected && !p.hasRolled) return false;
  return true;
}

function allPlayersPredicted(room) {
  for (const p of room.players.values()) if (p.isConnected && !p.hasPredicted) return false;
  return true;
}

function allPlayersSelectedDice(room) {
  for (const p of room.players.values()) if (p.isConnected && p.presentedDice.length === 0) return false;
  return true;
}

// ─── Snapshot y puntuación ────────────────────────────────────────────────────

function resolveRound(room) {
  const connectedPlayers = [...room.players.entries()].filter(([, p]) => p.isConnected);
  const playerHands = connectedPlayers.map(([pid, p]) => ({ playerId: pid, hand: p.hand }));
  const pointsMap = calculateRoundPoints(playerHands);

  const snapshotPlayers = [];
  const isLast = isLastRoundOfLaunch(room.currentRound);

  for (const [pid, player] of connectedPlayers) {
    const roundPoints = pointsMap.get(pid) ?? 0;
    const newLaunchPoints = Math.round((player.launchPoints + roundPoints) * 10) / 10;

    // Al final del lanzamiento aplicar bonus de predicción
    let bonusPoints = 0;
    let predictionHit = false;

    if (isLast && player.prediction) {
      const finalPoints = applyPredictionBonus(player.prediction, newLaunchPoints);
      bonusPoints = Math.round((finalPoints - newLaunchPoints) * 10) / 10;
      predictionHit = checkPrediction(player.prediction, newLaunchPoints);
    }

    const totalPoints = Math.round((player.totalPoints + roundPoints + bonusPoints) * 10) / 10;

    const updatedPlayer = {
      ...player,
      roundPoints,
      launchPoints: newLaunchPoints,
      totalPoints,
    };
    room.players.set(pid, updatedPlayer);

    snapshotPlayers.push({
      id: pid,
      name: player.name,
      allDice: player.allDice,
      presentedDice: player.presentedDice,
      hand: player.hand,
      roundPoints,
      launchPoints: newLaunchPoints,
      totalPoints,
      prediction: player.prediction,
      predictionHit: isLast ? predictionHit : null,
      bonusPoints: isLast ? bonusPoints : 0,
    });
  }

  snapshotPlayers.sort((a, b) => b.roundPoints - a.roundPoints);

  return {
    round: room.currentRound,
    launch: getLaunchNumber(room.currentRound),
    isLastRoundOfLaunch: isLast,
    players: snapshotPlayers,
    timestamp: new Date().toISOString(),
  };
}

function getWinner(room) {
  let winner = null, maxPoints = -1;
  for (const player of room.players.values()) {
    if (player.totalPoints > maxPoints) { maxPoints = player.totalPoints; winner = player; }
  }
  return winner;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

function runTests() {
  console.log('🧪 Tests de gameEngine\n');
  const cases = [
    { dice: [5,5,5], expected: 'Trío de 5' },
    { dice: [6,6,6], expected: 'Trío de 6' },
    { dice: [1,2,3], expected: 'Escalera 1-2-3' },
    { dice: [4,5,6], expected: 'Escalera 4-5-6' },
    { dice: [3,3,5], expected: 'Par de 3' },
    { dice: [6,6,1], expected: 'Par de 6' },
    { dice: [1,3,5], expected: 'Nada (1-3-5)' },
    { dice: [2,4,6], expected: 'Nada (2-4-6)' },
  ];

  let passed = 0;
  for (const { dice, expected } of cases) {
    const hand = evaluateHand(dice);
    const ok = hand.name === expected;
    console.log(`  ${ok ? '✅' : '❌'} [${dice.join(',')}] → ${hand.name}`);
    if (ok) passed++;
  }

  // Test predicciones
  console.log('\n  Tests de predicción:');
  console.log(`  high + 11pts → ${applyPredictionBonus('high', 11)} (esperado: 22) ${applyPredictionBonus('high', 11) === 22 ? '✅' : '❌'}`);
  console.log(`  mid  + 8pts  → ${applyPredictionBonus('mid',  8)}  (esperado: 16) ${applyPredictionBonus('mid', 8) === 16 ? '✅' : '❌'}`);
  console.log(`  zero + 0pts  → ${applyPredictionBonus('zero', 0)}  (esperado: 40) ${applyPredictionBonus('zero', 0) === 40 ? '✅' : '❌'}`);
  console.log(`  high + 5pts  → ${applyPredictionBonus('high', 5)}  (esperado: 5)  ${applyPredictionBonus('high', 5) === 5 ? '✅' : '❌'}`);

  // Test lanzamientos
  console.log('\n  Tests de lanzamiento:');
  console.log(`  Ronda 1 → Lanzamiento ${getLaunchNumber(1)} (esperado: 1) ${getLaunchNumber(1) === 1 ? '✅' : '❌'}`);
  console.log(`  Ronda 3 → Lanzamiento ${getLaunchNumber(3)} (esperado: 1) ${getLaunchNumber(3) === 1 ? '✅' : '❌'}`);
  console.log(`  Ronda 4 → Lanzamiento ${getLaunchNumber(4)} (esperado: 2) ${getLaunchNumber(4) === 2 ? '✅' : '❌'}`);
  console.log(`  Ronda 9 → Lanzamiento ${getLaunchNumber(9)} (esperado: 3) ${getLaunchNumber(9) === 3 ? '✅' : '❌'}`);

  console.log(`\n  ${passed}/${cases.length} tests de mano pasados\n`);
}

if (require.main === module) runTests();

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  TOTAL_ROUNDS,
  TOTAL_LAUNCHES,
  ROUNDS_PER_LAUNCH,
  TOTAL_DICE,
  DICE_PER_ROUND,
  HAND_RANK,
  HAND_NAME,
  PREDICTIONS,
  getLaunchNumber,
  isFirstRoundOfLaunch,
  isLastRoundOfLaunch,
  checkPrediction,
  applyPredictionBonus,
  evaluateHand,
  compareHands,
  calculateRoundPoints,
  createPlayerState,
  applyRollToPlayer,
  prepareNextRound,
  applyPrediction,
  applyDiceSelection,
  autoSelectBestDice,
  autoPredict,
  allPlayersReady,
  allPlayersRolled,
  allPlayersPredicted,
  allPlayersSelectedDice,
  resolveRound,
  getWinner,
};