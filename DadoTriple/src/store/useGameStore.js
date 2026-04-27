/**
 * useGameStore.js
 * Estado global del juego — sincronizado con el servidor via WebSocket.
 */
import { create } from 'zustand';

const useGameStore = create((set, get) => ({
  // ─── Identidad ───────────────────────────────────────────────────────────────
  playerId:   null,
  playerName: null,
  roomId:     null,
  roomCode:   null,
  isHost:     false,
  isSpectator: false,

  // ─── Sala ────────────────────────────────────────────────────────────────────
  roomState:  null,
  players:    [],
  spectators: [],

  // ─── Flujo ───────────────────────────────────────────────────────────────────
  gamePhase:    'waiting',  // waiting | rolling | predicting | selecting | scoring | finished
  roundNumber:  0,
  totalRounds:  9,
  launchNumber: 1,          // 1, 2 o 3

  // ─── Predicción ──────────────────────────────────────────────────────────────
  prediction:   null,       // 'high' | 'mid' | 'low' | 'zero'
  hasPredicted: false,

  // ─── Turno ───────────────────────────────────────────────────────────────────
  currentTurnPlayerId: null,  // playerId del jugador activo
  turnOrder: [],              // orden de presentación de esta ronda
  isMyTurn: false,            // true cuando es el turno del jugador local

  // ─── Dados ───────────────────────────────────────────────────────────────────
  allDice:             [],
  usedDiceIndices:     [],
  selectedDiceIndices: [],
  presentedHistory:    [],  // (legado — ya no se usa para calcular usedDiceIndices)

  // ─── Resultados ──────────────────────────────────────────────────────────────
  roundSnapshot:  null,
  gameOver:       null,

  // ─── Conexión ────────────────────────────────────────────────────────────────
  isConnected:    false,
  connectionError: null,

  // ─── Setters ─────────────────────────────────────────────────────────────────

  setConnected: (v) => set({ isConnected: v, connectionError: null }),
  setConnectionError: (err) => set({ connectionError: err, isConnected: false }),

  setIdentity: ({ playerId, playerName, roomId, roomCode, isHost, isSpectator }) =>
    set({ playerId, playerName, roomId, roomCode,
          isHost: isHost ?? false, isSpectator: isSpectator ?? false }),

  // ─── Procesadores de eventos ─────────────────────────────────────────────────

  applyRoomState: (payload) => {
    const state = payload.state;
    const me = state.players.find(p => p.id === get().playerId);
    set({
      roomState: state,
      players: state.players,
      spectators: state.spectators ?? [],
      gamePhase: state.status === 'playing'
        ? (state.roundPhase === 'rolling'    ? 'rolling'
          : state.roundPhase === 'predicting' ? 'predicting'
          : 'selecting')
        : 'waiting',
      roundNumber: state.currentRound,
    });
    if (me && me.allDice) {
      set({ allDice: me.allDice });
    }
  },

  // round_started
  applyRoundStarted: (payload) => {
    const isFirstOfLaunch = payload.isFirstRoundOfLaunch;
    const launchNumber    = payload.launch ?? 1;

    set({
      roundNumber:  payload.round,
      totalRounds:  payload.totalRounds,
      launchNumber,
      gamePhase:    isFirstOfLaunch ? 'rolling' : 'selecting',
      roundSnapshot: null,
      selectedDiceIndices: [],
      roomState: payload.state,
      players:   payload.state.players,
    });

    // Al inicio de cada lanzamiento resetear dados, predicción e historial
    if (isFirstOfLaunch) {
      set({
        allDice: [],
        usedDiceIndices: [],
        presentedHistory: [],
        prediction: null,
        hasPredicted: false,
      });
    }
  },

  // dice_rolled
  applyDiceRolled: (payload) => {
    const { playerId } = get();
    const me = payload.state.players.find(p => p.id === playerId);
    set({ players: payload.state.players, roomState: payload.state });
    if (me && me.allDice) set({ allDice: me.allDice });
  },

  // phase_changed
  applyPhaseChanged: (payload) => {
    const { playerId, presentedHistory } = get();
    const me = payload.state.players.find(p => p.id === playerId);

    const phase = payload.phase; // 'predicting' | 'selecting'

    set({
      gamePhase: phase,
      players:   payload.state.players,
      roomState: payload.state,
      selectedDiceIndices: [],
      currentTurnPlayerId: payload.state.currentTurnPlayerId ?? null,
      turnOrder: payload.turnOrder ?? [],
      isMyTurn: payload.state.currentTurnPlayerId === playerId,
    });

    if (phase === 'selecting' && me && me.allDice) {
      const dice = me.allDice;
      // El servidor ya mantiene usedDiceIndices correcto — leerlo directamente
      // me.usedDiceIndices viene del estado seguro del servidor
      const usedIndices = me.usedDiceIndices ?? [];
      set({ allDice: dice, usedDiceIndices: usedIndices });
    }
  },

  // turn_started
  applyTurnStarted: (payload) => {
    const { playerId } = get();
    set({
      currentTurnPlayerId: payload.playerId,
      isMyTurn: payload.playerId === playerId,
      players: payload.state.players,
      roomState: payload.state,
    });
  },

  // dice_selected — actualizar estado incluyendo turno
  applyTurnAdvanced: (payload) => {
    const { playerId } = get();
    set({
      currentTurnPlayerId: payload.state.currentTurnPlayerId ?? null,
      isMyTurn: payload.state.currentTurnPlayerId === playerId,
      players: payload.state.players,
      roomState: payload.state,
    });
  },

  // prediction_made — el propio jugador recibe su predicción confirmada
  applyPredictionMade: (payload) => {
    const { playerId } = get();
    set({ players: payload.state.players, roomState: payload.state });
    // Solo actualizar si es mi propia predicción (el servidor solo nos la manda a nosotros)
    if (payload.playerId === playerId && payload.prediction) {
      set({ prediction: payload.prediction, hasPredicted: true });
    }
  },

  // dice_selected
  applyDiceSelected: (payload) => {
    set({ players: payload.state.players, roomState: payload.state });
  },

  // round_ended
  applyRoundEnded: (payload) => {
    const { playerId, usedDiceIndices } = get();
    const me = payload.snapshot.players.find(p => p.id === playerId);

    // Usar los índices exactos del servidor — no reconstruir por valor
    // El snapshot incluye usedDiceIndices acumulados del servidor
    let newUsedIndices = [...usedDiceIndices];
    if (me && me.presentedDiceIndices) {
      // Agregar los índices presentados en esta ronda
      me.presentedDiceIndices.forEach(idx => {
        if (!newUsedIndices.includes(idx)) newUsedIndices.push(idx);
      });
    }

    set({
      gamePhase:      'scoring',
      roundSnapshot:  payload.snapshot,
      players:        payload.state.players,
      roomState:      payload.state,
      selectedDiceIndices: [],
      usedDiceIndices: newUsedIndices,
    });
  },

  // game_over
  applyGameOver: (payload) => {
    set({
      gamePhase: 'finished',
      gameOver:  payload,
      players:   payload.state.players,
      roomState: payload.state,
    });
  },

  applyPlayerUpdate: (payload) => {
    set({ players: payload.state.players, roomState: payload.state });
  },

  // ─── Selección local ─────────────────────────────────────────────────────────

  toggleSelectDie: (index) => {
    const { selectedDiceIndices, usedDiceIndices } = get();
    if (usedDiceIndices.includes(index)) return;
    if (selectedDiceIndices.includes(index)) {
      set({ selectedDiceIndices: selectedDiceIndices.filter(i => i !== index) });
    } else {
      if (selectedDiceIndices.length >= 3) return;
      set({ selectedDiceIndices: [...selectedDiceIndices, index] });
    }
  },

  clearSelection: () => set({ selectedDiceIndices: [] }),

  markDiceAsUsed: (indices) =>
    set(state => ({
      usedDiceIndices: [...state.usedDiceIndices, ...indices],
      selectedDiceIndices: [],
    })),

  // ─── Reset ───────────────────────────────────────────────────────────────────

  resetGame: () => {
    const { playerName } = useGameStore.getState();
    set({
      roomId: null, roomCode: null, playerId: null,
      isHost: false, isSpectator: false,
      roomState: null, players: [], spectators: [],
      gamePhase: 'waiting', roundNumber: 0, launchNumber: 1,
      prediction: null, hasPredicted: false,
      currentTurnPlayerId: null, turnOrder: [], isMyTurn: false,
      allDice: [], usedDiceIndices: [], selectedDiceIndices: [],
      presentedHistory: [], roundSnapshot: null, gameOver: null,
      playerName,
    });
  },
}));

export default useGameStore;