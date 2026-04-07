import { useEffect } from 'react';
import socketService from '../services/socketService';
import useGameStore from '../store/useGameStore';

const useWebSocket = (roomId) => {
  const updateGameState = useGameStore((state) => state.updateGameState);

  useEffect(() => {
    const socket = socketService.connect();

    const timeout = setTimeout(() => {
      if (roomId) {
        socketService.joinRoom(roomId);
      }
    }, 500);

    socketService.onGameUpdate((action) => {
      console.log('Game update received:', action);
      updateGameState(action);
    });

    return () => {
      clearTimeout(timeout);
      if (socketService.socket) {
        socketService.socket.off('game_update');
      }
      socketService.disconnect();
    };
  }, [roomId, updateGameState]);

  const sendAction = (action) => {
    socketService.sendAction(roomId, action);
  };

  return { sendAction };
};

export default useWebSocket;
