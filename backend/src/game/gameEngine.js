/**
 * gameEngine.js
 * Lógica pura del juego Dado Triple — sin WebSocket ni BD aquí.
 *
 * Reglas:
 * - Cada jugador tiene 11 dados en total (9 visibles + 2 ocultos)
 * - Por ronda presenta 3 dados → 3 rondas → quedan 2 dados sin usar
 * - La mano de 3 dados se evalúa estilo póker:
 *     Trío    > Escalera > Par > Nada
 *   En empate de tipo, gana el número más alto del grupo principal
 * - Puntos por posición en la ronda: 1º→6, 2º→3, 3º→1, 4º→0
 * - Si dos o más jugadores empatan en posición, suman sus puntos y dividen
 */

const TOTAL_ROUNDS = 3;
const TOTAL_DICE    = 11; // 9 visibles + 2 ocultos
const DICE_PER_ROUND = 3;

// ─── Tipos de mano (mayor número = mejor mano) ────────────────────────────────

const HAND_RANK = {
  TRIO:     3,
  ESCALERA: 2,
  PAR:      1,
  NADA:     0,
};

const HAND_NAME = {
  3: 'Trío',
  2: 'Escalera',
  1: 'Par',
  0: 'Nada',
};

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

/**
 * Evalúa una mano de exactamente 3 dados.
 * Retorna { rank, tiebreaker, name, dice }
 *
 * rank:        número para comparar tipos (Trío > Escalera > Par > Nada)
 * tiebreaker:  número para desempatar dentro del mismo tipo
 *              - Trío:    valor del dado repetido (ej: trio de 5 → tiebreaker=5)
 *              - Escalera: valor más alto (ej: 2,3,4 → tiebreaker=4)
 *              - Par:      valor del par (ej: par de 6 → tiebreaker=6)
 *              - Nada:     valor más alto (ej: 2,4,6 → tiebreaker=6)
 */
function evaluateHand(dice) {
  if (dice.length !== 3) throw new Error('La mano debe tener exactamente 3 dados');

  const sorted = [...dice].sort((a, b) => a - b);
  const counts = {};
  for (const d of sorted) counts[d] = (counts[d] || 0) + 1;

  const entries = Object.entries(counts).map(([face, count]) => ({
    face: Number(face),
    count,
  }));

  // ── Trío ──
  const trio = entries.find(e => e.count === 3);
  if (trio) {
    return { rank: HAND_RANK.TRIO, tiebreaker: trio.face, name: `Trío de ${trio.face}`, dice };
  }

  // ── Escalera: los 3 dados son consecutivos ──
  if (sorted[1] === sorted[0] + 1 && sorted[2] === sorted[1] + 1) {
    return { rank: HAND_RANK.ESCALERA, tiebreaker: sorted[2], name: `Escalera ${sorted.join('-')}`, dice };
  }

  // ── Par ──
  const par = entries.find(e => e.count === 2);
  if (par) {
    return { rank: HAND_RANK.PAR, tiebreaker: par.face, name: `Par de ${par.face}`, dice };
  }

  // ── Nada ──
  return { rank: HAND_RANK.NADA, tiebreaker: sorted[2], name: `Nada (${sorted.join('-')})`, dice };
}

/**
 * Compara dos manos. Retorna:
 *  > 0 si handA es mejor que handB
 *  < 0 si handA es peor que handB
 *    0 si son exactamente iguales (mismo rank y tiebreaker)
 */
function compareHands(handA, handB) {
  if (handA.rank !== handB.rank) return handA.rank - handB.rank;
  return handA.tiebreaker - handB.tiebreaker;
}

// ─── Distribución de puntos por ronda ────────────────────────────────────────

/**
 * Dado un array de { playerId, hand }, calcula los puntos de la ronda
 * aplicando la regla de empate: puntos de posiciones compartidas se suman y dividen.
 *
 * Retorna Map<playerId, roundPoints>
 */
function calculateRoundPoints(playerHands) {
  // Ordenar de mejor a peor mano
  const sorted = [...playerHands].sort((a, b) => compareHands(b.hand, a.hand));

  const pointsMap = new Map();
  let i = 0;

  while (i < sorted.length) {
    // Encontrar todos los jugadores empatados en esta posición
    const currentHand = sorted[i].hand;
    let j = i;
    while (j < sorted.length && compareHands(sorted[j].hand, currentHand) === 0) {
      j++;
    }

    // sorted[i..j-1] están empatados
    const tiedCount = j - i;

    // Sumar los puntos de las posiciones que ocupan
    let totalPoints = 0;
    for (let k = i; k < j; k++) {
      totalPoints += POSITION_POINTS[k] ?? 0;
    }

    // Dividir equitativamente (con decimales → se redondea a 1 decimal)
    const pointsEach = Math.round((totalPoints / tiedCount) * 10) / 10;

    for (let k = i; k < j; k++) {
      pointsMap.set(sorted[k].playerId, pointsEach);
    }

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
    allDice: [],        // los 11 dados lanzados al inicio de cada ronda
    usedDiceIndices: [], // índices de dados ya presentados en rondas anteriores
    presentedDice: [],   // los 3 dados elegidos para presentar esta ronda
    hand: null,          // mano evaluada de los presentedDice
    roundPoints: 0,
    totalPoints: 0,
    isConnected: true,
  };
}

/**
 * Lanza los 11 dados UNA SOLA VEZ al inicio de la partida (ronda 1).
 * En rondas siguientes los dados ya existen — solo se limpian presentedDice y hand.
 */
function applyRollToPlayer(player) {
  return {
    ...player,
    hasRolled: true,
    allDice: rollAllDice(),   // solo se usa en ronda 1
    usedDiceIndices: [],
    presentedDice: [],
    hand: null,
    roundPoints: 0,
  };
}

/**
 * Prepara al jugador para una nueva ronda SIN relanzar dados.
 * Conserva allDice y usedDiceIndices acumulados.
 */
function prepareNextRound(player) {
  return {
    ...player,
    presentedDice: [],
    hand: null,
    roundPoints: 0,
  };
}

/**
 * El jugador elige los índices de 3 dados de su allDice para presentar.
 * diceIndices: array de 3 números — deben ser índices no usados en rondas anteriores.
 */
function applyDiceSelection(player, diceIndices) {
  if (!Array.isArray(diceIndices) || diceIndices.length !== DICE_PER_ROUND) {
    throw new Error(`Debes seleccionar exactamente ${DICE_PER_ROUND} dados`);
  }

  const unique = new Set(diceIndices).size === diceIndices.length;
  if (!unique) throw new Error('No puedes seleccionar el mismo dado dos veces');

  const valid = diceIndices.every(i => Number.isInteger(i) && i >= 0 && i < player.allDice.length);
  if (!valid) throw new Error(`Índices fuera de rango (tienes ${player.allDice.length} dados)`);

  // Verificar que ningún índice haya sido usado en rondas anteriores
  const alreadyUsed = diceIndices.filter(i => player.usedDiceIndices.includes(i));
  if (alreadyUsed.length > 0) {
    throw new Error(`Los dados en posición [${alreadyUsed.join(', ')}] ya fueron presentados`);
  }

  const presentedDice = diceIndices.map(i => player.allDice[i]);
  const hand = evaluateHand(presentedDice);

  return {
    ...player,
    presentedDice,
    hand,
    usedDiceIndices: [...player.usedDiceIndices, ...diceIndices],
  };
}

/**
 * Elige automáticamente la mejor mano posible para un jugador ausente.
 * Usa la misma lógica de elegirMejoresDados del cliente, pero en el servidor.
 */
function autoSelectBestDice(player) {
  const available = player.allDice
    .map((val, idx) => ({ val, idx }))
    .filter(d => !player.usedDiceIndices.includes(d.idx));

  if (available.length < DICE_PER_ROUND) {
    throw new Error(`No hay suficientes dados disponibles (${available.length} de ${DICE_PER_ROUND} requeridos)`);
  }

  let bestIndices = [0, 1, 2];
  let bestHand = evaluateHand([available[0].val, available[1].val, available[2].val]);

  for (let i = 0; i < available.length - 2; i++) {
    for (let j = i + 1; j < available.length - 1; j++) {
      for (let k = j + 1; k < available.length; k++) {
        const hand = evaluateHand([available[i].val, available[j].val, available[k].val]);
        if (compareHands(hand, bestHand) > 0) {
          bestHand = hand;
          bestIndices = [i, j, k];
        }
      }
    }
  }

  const globalIndices = bestIndices.map(i => available[i].idx);
  const presentedDice = globalIndices.map(i => player.allDice[i]);

  return {
    ...player,
    presentedDice,
    hand: bestHand,
    usedDiceIndices: [...player.usedDiceIndices, ...globalIndices],
  };
}

// ─── Checks de sala ───────────────────────────────────────────────────────────

function allPlayersReady(room) {
  for (const player of room.players.values()) {
    if (player.isConnected && !player.isReady) return false;
  }
  return true;
}

function allPlayersRolled(room) {
  for (const player of room.players.values()) {
    if (player.isConnected && !player.hasRolled) return false;
  }
  return true;
}

function allPlayersSelectedDice(room) {
  for (const player of room.players.values()) {
    if (player.isConnected && player.presentedDice.length === 0) return false;
  }
  return true;
}

// ─── Snapshot y puntuación de ronda ──────────────────────────────────────────

/**
 * Calcula los puntos de todos los jugadores para esta ronda
 * y actualiza room.players con los nuevos totales.
 * Retorna el snapshot de la ronda.
 */
function resolveRound(room) {
  const connectedPlayers = [...room.players.entries()]
    .filter(([, p]) => p.isConnected);

  // Calcular puntos
  const playerHands = connectedPlayers.map(([pid, p]) => ({
    playerId: pid,
    hand: p.hand,
  }));

  const pointsMap = calculateRoundPoints(playerHands);

  // Aplicar puntos y construir snapshot
  const snapshotPlayers = [];

  for (const [pid, player] of connectedPlayers) {
    const roundPoints = pointsMap.get(pid) ?? 0;
    const updatedPlayer = {
      ...player,
      roundPoints,
      totalPoints: Math.round((player.totalPoints + roundPoints) * 10) / 10,
    };
    room.players.set(pid, updatedPlayer);

    snapshotPlayers.push({
      id: pid,
      name: player.name,
      allDice: player.allDice,
      presentedDice: player.presentedDice,
      hand: player.hand,
      roundPoints,
      totalPoints: updatedPlayer.totalPoints,
    });
  }

  // Ordenar snapshot por puntos de ronda desc
  snapshotPlayers.sort((a, b) => b.roundPoints - a.roundPoints);

  return {
    round: room.currentRound,
    players: snapshotPlayers,
    timestamp: new Date().toISOString(),
  };
}

function getWinner(room) {
  let winner = null;
  let maxPoints = -1;

  for (const player of room.players.values()) {
    if (player.totalPoints > maxPoints) {
      maxPoints = player.totalPoints;
      winner = player;
    }
  }

  return winner;
}

// ─── Tests unitarios rápidos (correr con: node gameEngine.js) ─────────────────

function runTests() {
  console.log('🧪 Tests de gameEngine\n');

  // Manos
  const cases = [
    { dice: [5, 5, 5], expected: 'Trío de 5' },
    { dice: [6, 6, 6], expected: 'Trío de 6' },
    { dice: [1, 2, 3], expected: 'Escalera 1-2-3' },
    { dice: [4, 5, 6], expected: 'Escalera 4-5-6' },
    { dice: [3, 3, 5], expected: 'Par de 3' },
    { dice: [6, 6, 1], expected: 'Par de 6' },
    { dice: [1, 3, 5], expected: 'Nada (1-3-5)' },
    { dice: [2, 4, 6], expected: 'Nada (2-4-6)' },
  ];

  let passed = 0;
  for (const { dice, expected } of cases) {
    const hand = evaluateHand(dice);
    const ok = hand.name === expected;
    console.log(`  ${ok ? '✅' : '❌'} [${dice.join(',')}] → ${hand.name}${!ok ? ` (esperado: ${expected})` : ''}`);
    if (ok) passed++;
  }

  // Empate con distribución de puntos
  console.log('\n  Caso del enunciado:');
  const playerHands = [
    { playerId: 'j1', hand: evaluateHand([1, 1, 1]) },  // Trío de 1
    { playerId: 'j2', hand: evaluateHand([2, 3, 4]) },  // Escalera
    { playerId: 'j3', hand: evaluateHand([2, 3, 4]) },  // Escalera (empate)
    { playerId: 'j4', hand: evaluateHand([1, 2, 5]) },  // Nada
  ];

  const pts = calculateRoundPoints(playerHands);
  console.log(`  j1 (Trío de 1):   ${pts.get('j1')} pts  (esperado: 6)`);
  console.log(`  j2 (Escalera):    ${pts.get('j2')} pts  (esperado: 2)`);
  console.log(`  j3 (Escalera):    ${pts.get('j3')} pts  (esperado: 2)`);
  console.log(`  j4 (Nada):        ${pts.get('j4')} pts  (esperado: 0)`);

  const empateOk = pts.get('j2') === 2 && pts.get('j3') === 2;
  console.log(`\n  Empate: ${empateOk ? '✅' : '❌'}`);

  // Trío de 6 > Trío de 5
  const trio6 = evaluateHand([6, 6, 6]);
  const trio5 = evaluateHand([5, 5, 5]);
  const betterOk = compareHands(trio6, trio5) > 0;
  console.log(`  Trío de 6 > Trío de 5: ${betterOk ? '✅' : '❌'}`);

  console.log(`\n  ${passed}/${cases.length} tests de mano pasados\n`);
}

if (require.main === module) runTests();

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  TOTAL_ROUNDS,
  TOTAL_DICE,
  DICE_PER_ROUND,
  HAND_RANK,
  HAND_NAME,
  evaluateHand,
  compareHands,
  calculateRoundPoints,
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
};