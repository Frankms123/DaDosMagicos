/**
 * socketService.js
 *
 * Cliente WebSocket robusto con reconexión automática de 3 minutos.
 */

import { CONFIG } from '../config';
const WS_URL = CONFIG.WS_URL;

class SocketService {
  constructor() {
    this.ws = null;
    this.listeners = {};   
    this.reconnectTimer = null;
    this.isConnecting  = false;
    this.reconnectStartedAt = null;
    this.MAX_RECONNECT_TIME = 3 * 60 * 1000; // 3 minutos

    // Datos de reconexión persistentes
    this.playerId  = null;
    this.roomCode  = null;
  }

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return this.ws;
    }
    if (this.isConnecting) return this.ws;

    console.log('[WS] Conectando a:', WS_URL);
    this.isConnecting = true;
    
    try {
      this.ws = new WebSocket(WS_URL);

      this.ws.onopen = () => {
        console.log('[WS] ✅ Conectado');
        this.isConnecting = false;
        this.reconnectStartedAt = null;
        clearTimeout(this.reconnectTimer);
        this._emit('__connected');
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this._emit(msg.type, msg.payload);
          this._emit('*', msg);
        } catch (e) {
          console.warn('[WS] Error parseando mensaje');
        }
      };

      this.ws.onclose = (e) => {
        console.log(`[WS]  Desconectado (Código: ${e.code})`);
        this.isConnecting = false;
        this._emit('__disconnected');
        this._handleAutoReconnect();
      };

      this.ws.onerror = (err) => {
        console.warn('[WS] ⚠️ Error de conexión:', err.message);
        this.isConnecting = false;
        // El onclose se encargará de la reconexión
      };
    } catch (e) {
      console.error('[WS] Error fatal al crear WebSocket:', e);
      this.isConnecting = false;
      this._handleAutoReconnect();
    }

    return this.ws;
  }

  _handleAutoReconnect() {
    // Si tenemos datos de sala, intentamos reconectar
    if (this.playerId && this.roomCode) {
      if (!this.reconnectStartedAt) {
        this.reconnectStartedAt = Date.now();
      }

      const elapsed = Date.now() - this.reconnectStartedAt;
      if (elapsed < this.MAX_RECONNECT_TIME) {
        console.log(`[WS] Reintentando reconexión en 3s... (${Math.round((this.MAX_RECONNECT_TIME - elapsed)/1000)}s restantes)`);
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => this._attemptReconnect(), 3000);
      } else {
        console.log('[WS] Se agotó el tiempo de reconexión (3 min).');
        this.reconnectStartedAt = null;
        this.clearReconnectData();
      }
    }
  }

  _attemptReconnect() {
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    this.connect();

    // Una vez conectado, enviar evento de reconexión
    this.once('__connected', () => {
      console.log('[WS] Enviando solicitud de recuperación de sesión...');
      this.send('reconnect', {
        playerId: this.playerId,
        roomCode: this.roomCode,
      });
    });
  }

  disconnect() {
    clearTimeout(this.reconnectTimer);
    this.clearReconnectData();
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
  }

  saveReconnectData(playerId, roomCode) {
    this.playerId = playerId;
    this.roomCode = roomCode;
  }

  clearReconnectData() {
    this.playerId = null;
    this.roomCode = null;
    this.reconnectStartedAt = null;
  }

  send(type, payload = {}) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    } else {
      console.warn('[WS] ⚠️ No se pudo enviar mensaje (Sin conexión):', type);
      // Forzar reconexión inmediata si se intenta enviar algo
      if (!this.isConnecting) {
        this._attemptReconnect();
      }
    }
  }

  on(type, callback) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(callback);
    return () => this.off(type, callback);
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

  // API del juego
  createRoom(playerName, maxPlayers = 4) { this.send('create_room', { playerName, maxPlayers }); }
  joinRoom(roomCode, playerName) { this.send('join_room', { roomCode, playerName }); }
  joinAsSpectator(roomCode, playerName) { this.send('join_room', { roomCode, playerName, role: 'spectator' }); }
  playerReady() { this.send('player_ready'); }
  startGame() { this.send('start_game'); }
  rollDice() { this.send('roll_dice'); }
  makePrediction(prediction) { this.send('make_prediction', { prediction }); }
  selectDice(diceIndices) { this.send('select_dice', { diceIndices }); }
}

const socketService = new SocketService();
export default socketService;
