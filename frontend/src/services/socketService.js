import { io } from 'socket.io-client';

const SOCKET_URL = 'http://192.168.100.72:3002';

class SocketService {
  constructor() {
    this.socket = null;
  }

  connect() {
    if (this.socket) return this.socket;

    this.socket = io(SOCKET_URL);

    this.socket.on('connect', () => {
      console.log('Connected to server');
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
    });

    return this.socket;
  }

  joinRoom(roomId) {
    if (this.socket) {
      this.socket.emit('join_room', roomId);
    }
  }

  sendAction(roomId, action) {
    if (this.socket) {
      this.socket.emit('game_action', { roomId, action });
    }
  }

  onGameUpdate(callback) {
    if (this.socket) {
      this.socket.on('game_update', callback);
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}

const socketService = new SocketService();
export default socketService;
