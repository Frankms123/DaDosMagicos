/**
 * WaitingRoomScreen.js
 * Sala de espera en tiempo real.
 * Los jugadores aparecen al instante via WebSocket.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  FlatList, Animated, Share, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import socketService from '../services/socketService';
import { playSound } from '../services/soundService';
import useGameStore from '../store/useGameStore';
import MagicBackground from '../components/MagicBackground';
import GameButton from '../components/GameButton';
import {colors, shadows} from '../theme';

// ─── Constantes ───────────────────────────────────────────────────────────────
const BG     = colors.bg;
const CARD   = colors.card;
const BORDER = colors.border;
const TEXT   = colors.text;
const MUTED  = colors.muted;
const PURPLE = colors.purple;
const GOLD   = colors.gold;
const GREEN  = colors.green;
const RED    = colors.red;

const AVATAR_COLORS = ['#7C3AED','#F59E0B','#10B981','#EF4444','#3B82F6','#EC4899'];

// ─── Componente: Tarjeta de jugador ──────────────────────────────────────────
function PlayerCard({ player, index, myPlayerId }) {
  const fade  = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade,  { toValue: 1, duration: 350, delay: index * 70, useNativeDriver: true }),
      Animated.spring(slide, { toValue: 0, delay: index * 70, useNativeDriver: true, tension: 80, friction: 10 }),
    ]).start();
  }, []);

  const isMe       = player.id === myPlayerId;
  const isHost     = index === 0;
  const color      = AVATAR_COLORS[index % AVATAR_COLORS.length];
  const initial    = player.name ? player.name[0].toUpperCase() : '?';
  const connected  = player.isConnected !== false;

  return (
    <Animated.View style={[
      styles.playerCard,
      isMe && styles.playerCardMe,
      !connected && styles.playerCardDisconnected,
      { opacity: fade, transform: [{ translateY: slide }] },
    ]}>
      {/* Avatar */}
      <View style={[styles.avatar, { backgroundColor: connected ? color : MUTED }]}>
        <Text style={styles.avatarText}>{initial}</Text>
        {!connected && <View style={styles.disconnectedDot} />}
      </View>

      {/* Info */}
      <View style={styles.playerInfo}>
        <Text style={[styles.playerName, isMe && styles.playerNameMe]}>
          {player.name}{isMe ? '  (tú)' : ''}
        </Text>
        <Text style={styles.playerStatus}>
          {!connected    ? 'Desconectado'
           : isHost      ? 'Host'
           : player.isReady ? 'Listo'
           : 'Esperando'}
        </Text>
      </View>

      {/* Badge host */}
      {isHost && (
        <View style={styles.hostBadge}>
          <Text style={styles.hostBadgeText}>HOST</Text>
        </View>
      )}
    </Animated.View>
  );
}

// ─── Componente: Slot vacío ───────────────────────────────────────────────────
function EmptySlot({ index }) {
  const blink = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(blink, { toValue: 0.7, duration: 900, useNativeDriver: true }),
        Animated.timing(blink, { toValue: 0.3, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={[styles.emptySlot, { opacity: blink }]}>
      <View style={styles.emptyAvatar}>
        <Text style={styles.emptyAvatarText}>?</Text>
      </View>
      <Text style={styles.emptyText}>Esperando jugador...</Text>
    </Animated.View>
  );
}

// ─── Componente: Punto de pulso ───────────────────────────────────────────────
function PulseDot() {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale,   { toValue: 1.5, duration: 700, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.2, duration: 700, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale,   { toValue: 1,   duration: 700, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.7, duration: 700, useNativeDriver: true }),
        ]),
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={[styles.pulseDot, { transform: [{ scale }], opacity }]} />
  );
}

// ─── Pantalla principal ───────────────────────────────────────────────────────
function StartCountdown({ countdown }) {
  const scale = useRef(new Animated.Value(0.7)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    scale.setValue(0.7);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 80,
        friction: 7,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [countdown, opacity, scale]);

  return (
    <View style={styles.countdownOverlay}>
      <Animated.Text
        style={[
          styles.countdownNum,
          {
            opacity,
            transform: [{ scale }],
          },
        ]}
      >
        {countdown === 0 ? 'GO' : countdown}
      </Animated.Text>
      <Text style={styles.countdownSub}>
        {countdown === 0 ? '¡A jugar!' : 'Preparando la mesa...'}
      </Text>
    </View>
  );
}

export default function WaitingRoomScreen({ route, navigation }) {
  const { roomCode, playerName, isHost, isSpectator } = route.params;
  const [countdown, setCountdown] = useState(null);

  const players    = useGameStore(s => s.players);
  const spectators = useGameStore(s => s.spectators);
  const playerId   = useGameStore(s => s.playerId);
  const maxPlayers = useGameStore(s => s.roomState?.maxPlayers ?? 4);

  // Escuchar game_starting para mostrar countdown
  useEffect(() => {
    const off = socketService.on('game_starting', (payload) => setCountdown(payload?.countdown ?? 3));
    // También reaccionar a round_started (lo maneja useWebSocket navegando a Game)
    return () => off();
  }, []);

  // Countdown
  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) return; // useWebSocket navega al recibir round_started
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // Marcar listo al entrar (automático)
  useEffect(() => {
    if (!isSpectator) {
      const off = socketService.on('room_joined', () => {
        socketService.playerReady();
      });
      // Si ya estamos en la sala (host o reconexión), marcar listo directamente
      socketService.playerReady();
      return () => off();
    }
  }, []);

  const handleShare = async () => {
    playSound('click', 0.6);
    try {
      await Share.share({
        message: `¡Únete a mi partida de Dado Triple!\nCódigo de sala: ${roomCode}\n\nDescarga la app y usa este código para unirte.`,
      });
    } catch (e) {}
  };

  const handleStartGame = () => {
    if (countdown !== null) return;
    playSound('click', 0.7);
    if (players.length < 2) {
      Alert.alert('¡Espera!', 'Necesitas al menos 2 jugadores para iniciar.');
      return;
    }
    socketService.startGame();
    setCountdown(3);
  };

  const handleBack = () => {
    playSound('click', 0.55);
    socketService.disconnect();
    useGameStore.getState().resetGame();
    navigation.navigate('Lobby');
  };

  // Slots: jugadores reales + vacíos hasta maxPlayers
  const emptySlots = Math.max(0, maxPlayers - players.length);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <MagicBackground intensity={0.85} />
      <View style={styles.root}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn} activeOpacity={0.7}>
            <Text style={styles.backText}>← Salir</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Sala de Espera</Text>
          <View style={{ width: 60 }} />
        </View>

        {/* ── Código de sala ── */}
        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>CÓDIGO DE SALA</Text>
          <Text style={styles.codeValue}>{roomCode}</Text>
          <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.8}>
            <Text style={styles.shareBtnText}>Compartir</Text>
          </TouchableOpacity>
        </View>

        {/* ── Estado ── */}
        <View style={styles.statusRow}>
          <PulseDot />
          <Text style={styles.statusText}>
            {isSpectator
              ? `Observando · ${players.length} jugadores`
              : `Esperando jugadores · ${players.length}/${maxPlayers}`}
          </Text>
          {spectators.length > 0 && (
            <Text style={styles.spectatorCount}>Ver {spectators.length}</Text>
          )}
        </View>

        {/* ── Lista de jugadores ── */}
        <Text style={styles.sectionLabel}>JUGADORES EN SALA</Text>

        <FlatList
          data={players}
          keyExtractor={item => item.id}
          renderItem={({ item, index }) => (
            <PlayerCard player={item} index={index} myPlayerId={playerId} />
          )}
          ListFooterComponent={
            !isSpectator && emptySlots > 0
              ? () => (
                  <View style={{ gap: 10 }}>
                    {Array.from({ length: emptySlots }).map((_, i) => (
                      <EmptySlot key={`empty-${i}`} index={i} />
                    ))}
                  </View>
                )
              : null
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: 10, paddingBottom: 16 }}
          style={styles.list}
        />

        {/* ── Espectadores ── */}
        {spectators.length > 0 && (
          <View style={styles.spectatorsRow}>
            <Text style={styles.spectatorsText}>
              {spectators.map(s => s.name).join(', ')} {spectators.length === 1 ? 'está' : 'están'} observando
            </Text>
          </View>
        )}

        {/* ── Botón host ── */}
        {isHost && !isSpectator && (
          <View style={styles.footer}>
            <GameButton
              style={[styles.startBtn, players.length < 2 && styles.startBtnDisabled]}
              onPress={handleStartGame}
              disabled={players.length < 2 || countdown !== null}
              sound={null}
            >
              <Text style={styles.startBtnText}>Iniciar partida</Text>
            </GameButton>
            {players.length < 2 && (
              <Text style={styles.startHint}>Mínimo 2 jugadores para iniciar</Text>
            )}
            {players.length >= 2 && (
              <Text style={[styles.startHint, { color: GREEN }]}>
                O espera: inicia automáticamente con 4 jugadores
              </Text>
            )}
          </View>
        )}

        {/* ── No host ── */}
        {!isHost && !isSpectator && (
          <View style={styles.footer}>
            <View style={styles.waitingBox}>
              <Text style={styles.waitingBoxText}>Esperando que el host inicie...</Text>
            </View>
          </View>
        )}

        {/* ── Countdown overlay ── */}
        {countdown !== null && <StartCountdown countdown={countdown} />}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  root: { flex: 1, backgroundColor: 'transparent', paddingHorizontal: 20, paddingTop: 8 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 20,
  },
  backBtn: { width: 60 },
  backText: { color: MUTED, fontSize: 14, fontWeight: '600' },
  title: { fontSize: 18, fontWeight: '800', color: TEXT },

  // Código de sala
  codeCard: {
    backgroundColor: CARD, borderRadius: 20,
    borderWidth: 1, borderColor: BORDER,
    padding: 20, alignItems: 'center', marginBottom: 18,
    ...shadows.purple,
  },
  codeLabel: { fontSize: 10, fontWeight: '700', color: MUTED, letterSpacing: 2, marginBottom: 8 },
  codeValue: { fontSize: 42, fontWeight: '900', color: GOLD, letterSpacing: 10, marginBottom: 14 },
  shareBtn: {
    backgroundColor: GOLD + '18', borderRadius: 10,
    paddingHorizontal: 20, paddingVertical: 10,
    borderWidth: 1, borderColor: GOLD + '35',
  },
  shareBtnText: { color: GOLD, fontWeight: '700', fontSize: 14 },

  // Estado
  statusRow: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 18, gap: 10,
  },
  pulseDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: GREEN },
  statusText: { flex: 1, color: MUTED, fontSize: 14, fontWeight: '500' },
  spectatorCount: { color: MUTED, fontSize: 13 },

  sectionLabel: {
    fontSize: 10, fontWeight: '700', color: MUTED,
    letterSpacing: 2, marginBottom: 12,
  },
  list: { flex: 1 },

  // Tarjeta jugador
  playerCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: CARD, borderRadius: 16,
    borderWidth: 1, borderColor: BORDER, padding: 14,
  },
  playerCardMe: {
    borderColor: PURPLE + '55',
    backgroundColor: PURPLE + '0D',
  },
  playerCardDisconnected: { opacity: 0.5 },
  avatar: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center', marginRight: 14,
  },
  avatarText: { fontSize: 20, fontWeight: '800', color: '#fff' },
  disconnectedDot: {
    position: 'absolute', bottom: 0, right: 0,
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: RED, borderWidth: 2, borderColor: CARD,
  },
  playerInfo: { flex: 1 },
  playerName: { fontSize: 16, fontWeight: '700', color: TEXT },
  playerNameMe: { color: '#C4B5FD' },
  playerStatus: { fontSize: 12, color: MUTED, marginTop: 2 },
  hostBadge: {
    backgroundColor: GOLD + '18', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: GOLD + '40',
  },
  hostBadgeText: { color: GOLD, fontSize: 11, fontWeight: '700', letterSpacing: 1 },

  // Slot vacío
  emptySlot: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: CARD + '80', borderRadius: 16,
    borderWidth: 1, borderColor: BORDER + '60',
    borderStyle: 'dashed', padding: 14,
  },
  emptyAvatar: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: BORDER, alignItems: 'center',
    justifyContent: 'center', marginRight: 14,
  },
  emptyAvatarText: { fontSize: 20, color: MUTED },
  emptyText: { color: MUTED, fontSize: 14, fontStyle: 'italic' },

  // Espectadores
  spectatorsRow: {
    backgroundColor: GOLD + '0D', borderRadius: 10,
    borderWidth: 1, borderColor: GOLD + '25',
    padding: 10, marginBottom: 12,
  },
  spectatorsText: { color: GOLD, fontSize: 13, textAlign: 'center' },

  // Footer
  footer: { paddingBottom: 8, gap: 8 },
  startBtn: {
    backgroundColor: PURPLE, borderRadius: 16,
    paddingVertical: 18, alignItems: 'center',
    shadowColor: PURPLE, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5, shadowRadius: 12, elevation: 10,
  },
  startBtnDisabled: { opacity: 0.4 },
  startBtnText: { fontSize: 18, fontWeight: '700', color: '#fff' },
  startHint: { textAlign: 'center', color: MUTED, fontSize: 12 },
  waitingBox: {
    backgroundColor: CARD, borderRadius: 14, padding: 16,
    alignItems: 'center', borderWidth: 1, borderColor: BORDER,
  },
  waitingBoxText: { color: MUTED, fontSize: 14, fontWeight: '500' },

  // Countdown
  countdownOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,15,26,0.93)',
    alignItems: 'center', justifyContent: 'center', zIndex: 100,
  },
  countdownNum: { fontSize: 100, fontWeight: '900', color: GOLD },
  countdownSub: { color: MUTED, fontSize: 18, marginTop: 12, fontWeight: '600' },
});
