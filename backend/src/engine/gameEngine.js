class GameEngine {
  rollDice(count = 3) {
    const dice = [];
    for (let i = 0; i < count; i++) {
      dice.push(Math.floor(Math.random() * 6) + 1);
    }
    return dice;
  }

  calculateScore(dice) {
    // Basic logic for Dado Triple: 3 equal dice = triple score
    const counts = {};
    dice.forEach(d => {
      counts[d] = (counts[d] || 0) + 1;
    });

    let score = 0;
    Object.keys(counts).forEach(die => {
      if (counts[die] === 3) {
        score = die * 10; // Triple score
      } else if (counts[die] === 2) {
        score = die * 2; // Double score
      } else {
        score += parseInt(die);
      }
    });

    return score;
  }

  validateMove(playerId, gameState) {
    // Ensure it's the player's turn
    return gameState.currentPlayer === playerId;
  }
}

module.exports = new GameEngine();
