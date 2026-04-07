import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Button, ActivityIndicator } from 'react-native';
import useWebSocket from '../hooks/useWebSocket';
import useGameStore from '../store/useGameStore';

export default function GameScreen({ roomId }) {
  const gameState = useGameStore((state) => state.gameState);
  const updateGameState = useGameStore((state) => state.updateGameState);
  const { sendAction } = useWebSocket(roomId);
  const [localRolling, setLocalRolling] = useState(false);

  // Efecto para detener la animación local cuando llega el resultado
  useEffect(() => {
    if (gameState.type === 'roll_result') {
      setLocalRolling(false);
    }
  }, [gameState.dice]);

  const handleRoll = () => {
    setLocalRolling(true);
    // Limpiar dados anteriores visualmente
    updateGameState({ dice: [], score: 0, status: 'rolling' });
    sendAction({ type: 'roll' });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Dado Triple</Text>
      <Text style={styles.roomLabel}>Sala: {roomId}</Text>
      
      <View style={styles.diceContainer}>
        {localRolling ? (
          <View style={styles.rollingContainer}>
            <ActivityIndicator size="large" color="#0000ff" />
            <Text style={styles.rollingText}>Lanzando dados...</Text>
          </View>
        ) : (
          gameState.dice && gameState.dice.length > 0 ? (
            gameState.dice.map((die, index) => (
              <View key={index} style={styles.die}>
                <Text style={styles.dieText}>{die}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.placeholderText}>¡Tira los dados para comenzar!</Text>
          )
        )}
      </View>

      <View style={styles.resultContainer}>
        <Text style={styles.scoreText}>
          Puntaje: <Text style={styles.scoreValue}>{gameState.score || 0}</Text>
        </Text>
      </View>

      <View style={styles.buttonWrapper}>
        <Button 
          title={localRolling ? "Lanzando..." : "Lanzar Dados"} 
          onPress={handleRoll} 
          disabled={localRolling}
          color="#007bff"
        />
      </View>

      <View style={styles.statusCard}>
        <Text style={styles.statusTitle}>Estado del Juego</Text>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Fase:</Text>
          <Text style={styles.statusValue}>{gameState.status === 'results' ? 'Resultado' : 'Esperando'}</Text>
        </View>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Jugador:</Text>
          <Text style={styles.statusValue} numberOfLines={1}>
            {gameState.playerId ? `ID: ${gameState.playerId.substring(0, 8)}...` : 'Nadie'}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1a1a1a',
    marginTop: 20,
  },
  roomLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 40,
  },
  diceContainer: {
    flexDirection: 'row',
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 20,
  },
  rollingContainer: {
    alignItems: 'center',
  },
  rollingText: {
    marginTop: 10,
    color: '#007bff',
    fontWeight: '600',
  },
  die: {
    width: 70,
    height: 70,
    backgroundColor: '#fff',
    borderWidth: 3,
    borderColor: '#1a1a1a',
    borderRadius: 14,
    margin: 10,
    alignItems: 'center',
    justifyContent: 'center',
    // Sombra para iOS
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    // Sombra para Android
    elevation: 6,
  },
  dieText: {
    fontSize: 34,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  placeholderText: {
    fontSize: 16,
    color: '#999',
    fontStyle: 'italic',
  },
  resultContainer: {
    marginBottom: 30,
  },
  scoreText: {
    fontSize: 22,
    color: '#444',
  },
  scoreValue: {
    fontWeight: 'bold',
    color: '#28a745',
    fontSize: 28,
  },
  buttonWrapper: {
    width: '100%',
    paddingHorizontal: 40,
    marginBottom: 40,
  },
  statusCard: {
    width: '100%',
    padding: 20,
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#eee',
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statusLabel: {
    color: '#666',
    fontWeight: '500',
  },
  statusValue: {
    color: '#333',
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
    marginLeft: 10,
  },
});
