import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Animated,
  Share,
  Alert,
} from 'react-native';
import socketService from '../services/socketService';
import useGameStore from '../store/useGameStore';

// Colores por avatar
const AVATAR_COLORS = ['#7C3AED', '#F59E0B', '#10B981', '#EF4444', '#3B82F6', '#EC4899'];

function PlayerCard({ player, index, isHost }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        delay: index * 80,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        delay: index * 80,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }),
    ]).start();
  }, []);

  const avatarColor = AVATAR_COLORS[index % AVATAR_COLORS.length];
  const initial = player.name ? player.name.charAt(0).toUpperCase() : '?';

  return (
    <Animated.View
      style={[
        styles.playerCard,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
      <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
        <Text style={styles.avatarText}>{initial}</Text>
      </View>
      <View style={styles.playerInfo}>
        <Text style={styles.playerName}>{player.name}</Text>
        <Text style={styles.playerStatus}>
          {player.isHost ? '👑 Host' : '✅ Listo'}
        </Text>
      </View>
      {player.isHost && (
        <View style={styles.hostBadge}>
          <Text style={styles.hostBadgeText}>HOST</Text>
        </View>
      )}
    </Animated.View>
  );
}

// Punto de pulso animado
function PulseDot() {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scaleAnim, { toValue: 1.4, duration: 700, useNativeDriver: true }),
          Animated.timing(opacityAnim, { toValue: 0.2, duration: 700, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scaleAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
          Animated.timing(opacityAnim, { toValue: 0.7, duration: 700, useNativeDriver: true }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <Animated.View
      style={[styles.pulseDot, { transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}
    />
  );
}

export default function WaitingRoomScreen({ route, navigation }) {
  const { roomCode, playerName, isHost } = route.params;
  const [players, setPlayers] = useState([
    { id: 'me', name: playerName, isHost },
  ]);
  const [countdown, setCountdown] = useState(null);

  const setRoom = useGameStore((state) => state.setRoom);

  useEffect(() => {
    const socket = socketService.connect();

    // Escuchar jugadores que se unen
    socket.on('player_joined', (data) => {
      setPlayers((prev) => {
        const exists = prev.find((p) => p.id === data.id);
        if (exists) return prev;
        return [...prev, { id: data.id, name: data.name, isHost: false }];
      });
    });

    // Escuchar inicio de partida desde el host
    socket.on('game_starting', (data) => {
      setCountdown(3);
    });

    // Emitir al resto que este jugador se unió
    socket.emit('announce_player', { name: playerName, isHost });

    return () => {
      socket.off('player_joined');
      socket.off('game_starting');
      socket.off('announce_player');
    };
  }, []);

  // Countdown para navegar
  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      navigation.navigate('Game', { roomCode, playerName });
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `¡Únete a mi sala de Dados Mágicos! Código: ${roomCode}`,
      });
    } catch (e) {
      console.log(e);
    }
  };

  const handleStartGame = () => {
    // 🧪 MODO TEST: mínimo 1 jugador — cambiar a < 2 para producción
    if (players.length < 1) {
      Alert.alert('¡Espera!', 'Necesitas al menos 2 jugadores para iniciar la partida.', [
        { text: 'OK' },
      ]);
      return;
    }
    const socket = socketService.connect();
    socket.emit('game_action', { roomId: roomCode, action: { type: 'start_game' } });
    setCountdown(3);
  };

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>← Salir</Text>
        </TouchableOpacity>
        <Text style={styles.screenTitle}>Sala de Espera</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Código de sala */}
      <View style={styles.codeCard}>
        <Text style={styles.codeLabel}>CÓDIGO DE SALA</Text>
        <Text style={styles.codeValue}>{roomCode}</Text>
        <TouchableOpacity style={styles.shareButton} onPress={handleShare} activeOpacity={0.8}>
          <Text style={styles.shareButtonText}>📤 Compartir</Text>
        </TouchableOpacity>
      </View>

      {/* Estado de espera */}
      <View style={styles.waitingRow}>
        <PulseDot />
        <Text style={styles.waitingText}>
          Esperando jugadores... ({players.length}/6)
        </Text>
      </View>

      {/* Lista de jugadores */}
      <View style={styles.playersSection}>
        <Text style={styles.sectionTitle}>Jugadores en la sala</Text>
        <FlatList
          data={players}
          keyExtractor={(item, idx) => item.id || String(idx)}
          renderItem={({ item, index }) => (
            <PlayerCard player={item} index={index} isHost={item.isHost} />
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: 10 }}
        />
      </View>

      {/* Countdown overlay */}
      {countdown !== null && (
        <View style={styles.countdownOverlay}>
          <Text style={styles.countdownText}>
            {countdown === 0 ? '¡Vamos!' : countdown}
          </Text>
          <Text style={styles.countdownSub}>Iniciando partida...</Text>
        </View>
      )}

      {/* Botón de iniciar (solo host) */}
      {isHost && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.startButton, players.length < 1 && styles.startButtonDisabled]}
            onPress={handleStartGame}
            activeOpacity={0.85}
          >
            <Text style={styles.startButtonText}>🎲 Iniciar Partida</Text>
          </TouchableOpacity>
          {/* 🧪 MODO TEST: ocultar hint — descomentar para producción */}
          {/* {players.length < 2 && (
            <Text style={styles.startHint}>Necesitas al menos 2 jugadores</Text>
          )} */}
        </View>
      )}

      {!isHost && (
        <View style={styles.footer}>
          <View style={styles.waitingForHostBox}>
            <Text style={styles.waitingForHostText}>
              ⏳ Esperando que el host inicie la partida...
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const PURPLE = '#7C3AED';
const GOLD = '#F59E0B';
const BG = '#0F0F1A';
const CARD_BG = '#1A1A2E';
const BORDER = '#2A2A45';
const TEXT = '#E2E8F0';
const MUTED = '#64748B';

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
    paddingTop: 52,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  backButton: {
    width: 60,
  },
  backText: {
    color: MUTED,
    fontSize: 14,
    fontWeight: '600',
  },
  screenTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT,
    letterSpacing: 0.3,
  },
  codeCard: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: PURPLE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  codeLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: MUTED,
    letterSpacing: 2,
    marginBottom: 8,
  },
  codeValue: {
    fontSize: 38,
    fontWeight: '800',
    color: GOLD,
    letterSpacing: 8,
    marginBottom: 16,
  },
  shareButton: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  shareButtonText: {
    color: GOLD,
    fontWeight: '600',
    fontSize: 14,
  },
  waitingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 10,
  },
  pulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
  },
  waitingText: {
    color: MUTED,
    fontSize: 14,
    fontWeight: '500',
  },
  playersSection: {
    flex: 1,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: MUTED,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 14,
  },
  playerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT,
  },
  playerStatus: {
    fontSize: 12,
    color: MUTED,
    marginTop: 2,
  },
  hostBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  hostBadgeText: {
    color: GOLD,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  footer: {
    paddingBottom: 32,
    gap: 8,
  },
  startButton: {
    backgroundColor: PURPLE,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: PURPLE,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 10,
  },
  startButtonDisabled: {
    opacity: 0.45,
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  startHint: {
    textAlign: 'center',
    color: MUTED,
    fontSize: 12,
  },
  waitingForHostBox: {
    backgroundColor: CARD_BG,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },
  waitingForHostText: {
    color: MUTED,
    fontSize: 14,
    fontWeight: '500',
  },
  countdownOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,15,26,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  countdownText: {
    fontSize: 100,
    fontWeight: '900',
    color: GOLD,
  },

  countdownSub: {
    color: MUTED,
    fontSize: 18,
    marginTop: 12,
    fontWeight: '600',
  },
});
