/**
 * socketService.js
 *
 * Protocolo del servidor: { type: string, payload: object }
 * Protocolo del cliente:  { type: string, payload: object }
 */

import { CONFIG } from '../config';
const WS_URL = CONFIG.WS_URL;

class SocketService {
  constructor() {
    this.ws = null;
    this.listeners = {};   // type → [callback, ...]
    this.reconnectTimer = null;
    this.isConnecting  = false;

    // Datos de reconexión persistentes
    this.playerId  = null;
    this.roomCode  = null;
  }

  // ─── Conexión ───────────────────────────────────────────────────────────────

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return this.ws;
    }
    if (this.isConnecting) return this.ws;

    this.isConnecting = true;
    this.ws = new WebSocket(WS_URL);

    this.ws.onopen = () => {
      console.log('[WS] Conectado al servidor');
      this.isConnecting = false;
      clearTimeout(this.reconnectTimer);
      this._emit('__connected');
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        console.log('[WS] ←', msg.type, msg.payload);
        this._emit(msg.type, msg.payload);
        this._emit('*', msg); // wildcard para listeners generales
      } catch (e) {
        console.warn('[WS] Mensaje no parseable:', event.data);
      }
    };

    this.ws.onclose = () => {
      console.log('[WS] Desconectado');
      this.isConnecting = false;
      this._emit('__disconnected');

      // Auto-reconexión si tenemos token
      if (this.playerId && this.roomCode) {
        this.reconnectTimer = setTimeout(() => this._attemptReconnect(), 2000);
      }
    };

    this.ws.onerror = (err) => {
      console.warn('[WS] Error:', err.message);
      this.isConnecting = false;
      this._emit('__error', err);
    };

    return this.ws;
  }

  disconnect() {
    clearTimeout(this.reconnectTimer);
    this.playerId = null;
    this.roomCode = null;
    if (this.ws) {
      this.ws.onclose = null; // evitar auto-reconexión al desconectar manualmente
      this.ws.close();
      this.ws = null;
    }
  }

  // ─── Reconexión ─────────────────────────────────────────────────────────────

  _attemptReconnect() {
    console.log('[WS] Intentando reconectar...');
    this.connect();

    // Una vez conectado, enviar evento de reconexión
    this.once('__connected', () => {
      this.send('reconnect', {
        playerId: this.playerId,
        roomCode: this.roomCode,
      });
    });
  }

  saveReconnectData(playerId, roomCode) {
    this.playerId = playerId;
    this.roomCode = roomCode;
  }

  clearReconnectData() {
    this.playerId = null;
    this.roomCode = null;
  }

  // ─── Envío ───────────────────────────────────────────────────────────────────

  send(type, payload = {}) {
    const msg = JSON.stringify({ type, payload });
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('[WS] →', type, payload);
      this.ws.send(msg);
    } else {
      console.warn('[WS] No conectado — mensaje descartado:', type);
    }
  }

  // ─── Listeners ───────────────────────────────────────────────────────────────

  on(type, callback) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(callback);
    return () => this.off(type, callback); // retorna función de cleanup
  }

  once(type, callback) {
    const wrapper = (payload) => {
      callback(payload);
      this.off(type, wrapper);
    };
    this.on(type, wrapper);
  }

  off(type, callback) {
    if (!this.listeners[type]) return;
    this.listeners[type] = this.listeners[type].filter(cb => cb !== callback);
  }

  offAll(type) {
    delete this.listeners[type];
  }

  _emit(type, payload) {
    const handlers = this.listeners[type] || [];
    handlers.forEach(cb => {
      try { cb(payload); } catch (e) { console.error('[WS] Error en listener:', type, e); }
    });
  }

  // ─── API del juego ────────────────────────────────────────────────────────────

  createRoom(playerName, maxPlayers = 4) {
    this.send('create_room', { playerName, maxPlayers });
  }

  joinRoom(roomCode, playerName) {
    this.send('join_room', { roomCode, playerName });
  }

  joinAsSpectator(roomCode, playerName) {
    this.send('join_room', { roomCode, playerName, role: 'spectator' });
  }

  playerReady() {
    this.send('player_ready');
  }

  startGame() {
    this.send('start_game');
  }

  rollDice() {
    this.send('roll_dice');
  }

  makePrediction(prediction) {
    this.send('make_prediction', { prediction });
  }

  selectDice(diceIndices) {
    this.send('select_dice', { diceIndices });
  }
}

const socketService = new SocketService();
export default socketService;
