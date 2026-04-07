const gameEngine = require('../engine/gameEngine');

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Join a room
    socket.on('join_room', (roomId) => {
      socket.join(roomId);
      console.log(`User ${socket.id} joined room ${roomId}`);
      
      // Check if room joined successfully
      const rooms = Array.from(socket.rooms);
      console.log(`Socket ${socket.id} is now in rooms:`, rooms);
      
      // Send initial game state (for demo)
      socket.emit('game_update', { status: 'waiting', players: [socket.id] });
    });

    // Handle game actions
    socket.on('game_action', (data) => {
      const { roomId, action } = data;
      console.log(`Game action in room ${roomId}:`, action);

      if (action.type === 'roll') {
        const dice = gameEngine.rollDice();
        const score = gameEngine.calculateScore(dice);
        
        const update = {
          type: 'roll_result',
          status: 'results',
          dice,
          score,
          playerId: socket.id
        };

        // Broadcast update to all in room
        console.log(`Emitting update to room ${roomId}:`, update);
        io.to(roomId).emit('game_update', update);
      }
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });
  });
};

