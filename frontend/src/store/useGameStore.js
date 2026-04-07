import { create } from 'zustand';

const useGameStore = create((set) => ({
  user: null,
  room: null,
  gameState: {
    dice: [],
    currentPlayer: null,
    status: 'waiting', // waiting, rolling, results
  },
  setUser: (user) => set({ user }),
  setRoom: (room) => set({ room }),
  updateGameState: (newState) => set((state) => ({ 
    gameState: { ...state.gameState, ...newState } 
  })),
}));

export default useGameStore;
