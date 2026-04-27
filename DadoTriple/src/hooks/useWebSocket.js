/**
 * useWebSocket.js
 * Hook central que conecta socketService con useGameStore.
 * Registra todos los listeners del servidor y los mapea al store.
 */
import { useEffect, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';
import socketService from '../services/socketService';
import useGameStore from '../store/useGameStore';

export default function useWebSocket() {
  const navigation = useNavigation();
  const store = useGameStore();
  const cleanupFns = useRef([]);

  useEffect(() => {
    const ws = socketService.connect();

    // Helper para registrar listeners y guardar cleanup
    const on = (type, handler) => {
      const off = socketService.on(type, handler);
      cleanupFns.current.push(off);
      return off;
    };

    // ── Conexión ──────────────────────────────────────────────────────────────
    on('__connected', () => store.setConnected(true));
    on('__disconnected', () => store.setConnected(false));
    on('__error', () => store.setConnectionError('No se pudo conectar al servidor'));

    // ── Sala creada (host) ────────────────────────────────────────────────────
    on('room_created', (payload) => {
      socketService.saveReconnectData(payload.playerId, payload.roomCode);
      store.setIdentity({
        playerId:   payload.playerId,
        roomId:     payload.roomId,
        roomCode:   payload.roomCode,
        playerName: useGameStore.getState().playerName,
        isHost:     true,
      });
      store.applyRoomState(payload);
      navigation.navigate('WaitingRoom', {
        roomCode:   payload.roomCode,
        playerName: useGameStore.getState().playerName,
        isHost:     true,
      });
    });

    // ── Sala unida (jugador) ──────────────────────────────────────────────────
    on('room_joined', (payload) => {
      socketService.saveReconnectData(payload.playerId, payload.roomCode);
      store.setIdentity({
        playerId:   payload.playerId,
        roomId:     payload.roomId,
        roomCode:   payload.roomCode,
        playerName: useGameStore.getState().playerName,
        isHost:     false,
      });
      store.applyRoomState(payload);
      navigation.navigate('WaitingRoom', {
        roomCode:   payload.roomCode,
        playerName: useGameStore.getState().playerName,
        isHost:     false,
      });
    });

    // ── Espectador ────────────────────────────────────────────────────────────
    on('spectator_joined', (payload) => {
      const { playerName, roomCode } = useGameStore.getState();
      store.setIdentity({
        playerId:    payload.spectatorId,
        roomCode:    roomCode,
        playerName:  playerName,
        isSpectator: true,
      });
      store.applyRoomState({ state: payload.state });
      // Espectadores van a su propia pantalla
      navigation.navigate('Spectator', {
        roomCode: payload.state.code,
      });
    });

    // ── Jugadores entrando / saliendo ─────────────────────────────────────────
    on('player_joined',       (p) => store.applyPlayerUpdate(p));
    on('player_disconnected', (p) => store.applyPlayerUpdate(p));
    on('player_reconnected',  (p) => store.applyPlayerUpdate(p));
    on('spectator_entered',   (p) => store.applyPlayerUpdate(p));
    on('spectator_left',      (p) => store.applyPlayerUpdate(p));

    // ── Inicio de partida ─────────────────────────────────────────────────────
    on('game_starting', (payload) => {
      store.applyPlayerUpdate(payload);
      // El countdown lo maneja WaitingRoomScreen al recibir este evento
    });

    // ── Flujo de ronda ────────────────────────────────────────────────────────
    on('round_started', (payload) => {
      store.applyRoundStarted(payload);
      // Espectadores no navegan — se quedan en SpectatorScreen
      const { isSpectator, roomCode, playerName } = useGameStore.getState();
      if (!isSpectator) {
        navigation.navigate('Game', { roomCode, playerName });
      }
    });

    on('round_ended', (payload) => {
      // Espectadores no navegan a RoundResults — actualizan store en pantalla
      const { isSpectator } = useGameStore.getState();
      store.applyRoundEnded(payload);
      if (!isSpectator) {
        const { roomCode, playerName } = useGameStore.getState();
        navigation.navigate('RoundResults', {
          roomCode, playerName,
          totalRounds: payload.snapshot?.round ?? 3,
        });
      }
    });

    on('dice_rolled',      (p) => store.applyDiceRolled(p));
    on('phase_changed',    (p) => store.applyPhaseChanged(p));
    on('prediction_made',  (p) => store.applyPredictionMade(p));
    on('turn_started',     (p) => store.applyTurnStarted(p));
    on('dice_selected',    (p) => store.applyTurnAdvanced(p));
    on('auto_selected',    (p) => store.applyTurnAdvanced(p));

    on('game_over', (payload) => {
      const { isSpectator, roomCode, playerName } = useGameStore.getState();
      store.applyGameOver(payload);
      if (!isSpectator) {
        navigation.navigate('GameOver', { roomCode, playerName });
      }
    });

    // ── Reconexión ────────────────────────────────────────────────────────────
    on('reconnected', (payload) => {
      store.applyRoomState(payload);
      // Navegar a la pantalla correcta según la fase
      const phase = payload.roundPhase;
      if (payload.currentRound === 0) {
        navigation.navigate('WaitingRoom', {
          roomCode: payload.state.code,
          playerName: useGameStore.getState().playerName,
          isHost: store.isHost,
        });
      } else if (phase === 'scoring') {
        // Esperando resultados
      } else {
        navigation.navigate('Game', {
          roomCode:   payload.state.code,
          playerName: useGameStore.getState().playerName,
        });
      }
    });

    // ── Errores del servidor ──────────────────────────────────────────────────
    on('error', (payload) => {
      console.warn('[Server Error]', payload.message);
    });

    return () => {
      cleanupFns.current.forEach(fn => fn());
      cleanupFns.current = [];
    };
  }, []);

  return {
    isConnected: store.isConnected,
    send: socketService.send.bind(socketService),
  };
}