import { create } from 'zustand';

const useGameStore = create((set, get) => ({
  user: null,
  room: null,

  gamePhase: 'waiting',
  roundNumber: 1,
  totalRounds: 3, // ✅ FIX: 3 rondas (no 5)

  // ✅ FIX: Pool unificado de 11 dados — se generan UNA SOLA VEZ
  // Índices 0-8: dados visibles | Índices 9-10: dados ocultos (comodines)
  allDice: [],
  playedDiceIndices: [], // dados ya usados en rondas anteriores
  selectedDiceIndices: [],

  players: [],
  scores: {},

  roundResults: null,
  gameResults: null,

  // Legacy
  gameState: {
    dice: [],
    currentPlayer: null,
    status: 'waiting',
  },

  setUser: (user) => set({ user }),
  setRoom: (room) => set({ room }),

  setAllDice: (dice) => set({ allDice: dice }),

  toggleSelectDie: (index) =>
    set((state) => {
      const { selectedDiceIndices, playedDiceIndices } = state;
      // No se puede seleccionar un dado ya jugado
      if (playedDiceIndices.includes(index)) return {};
      if (selectedDiceIndices.includes(index)) {
        return { selectedDiceIndices: selectedDiceIndices.filter((i) => i !== index) };
      }
      if (selectedDiceIndices.length >= 3) return {};
      return { selectedDiceIndices: [...selectedDiceIndices, index] };
    }),

  clearSelection: () => set({ selectedDiceIndices: [] }),

  // ✅ FIX: Marcar los 3 dados jugados — así se acumulan ronda a ronda
  markSelectedAsPlayed: () =>
    set((state) => ({
      playedDiceIndices: [
        ...state.playedDiceIndices,
        ...state.selectedDiceIndices,
      ],
      selectedDiceIndices: [],
    })),

  setGamePhase: (phase) => set({ gamePhase: phase }),
  setRoundNumber: (n) => set({ roundNumber: n }),

  setPlayers: (players) => set({ players }),

  updateScore: (playerId, score) =>
    set((state) => ({
      scores: { ...state.scores, [playerId]: score },
    })),

  setRoundResults: (results) => set({ roundResults: results }),
  setGameResults: (results) => set({ gameResults: results }),

  // ✅ FIX: Avanzar ronda CONSERVA los dados y los índices ya jugados
  resetForNewRound: () =>
    set((state) => ({
      selectedDiceIndices: [],
      gamePhase: 'selecting',
      roundNumber: state.roundNumber + 1,
      // allDice y playedDiceIndices se conservan intencionalmente
    })),

  // Reset total para nueva partida (revancha)
  resetGame: () =>
    set({
      gamePhase: 'waiting',
      roundNumber: 1,
      allDice: [],
      playedDiceIndices: [],
      selectedDiceIndices: [],
      scores: {},
      roundResults: null,
      gameResults: null,
    }),

  updateGameState: (newState) =>
    set((state) => ({
      gameState: { ...state.gameState, ...newState },
    })),
}));

export default useGameStore;
