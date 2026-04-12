import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useGameStore from '../store/useGameStore';
import socketService from '../services/socketService';

// ────────────────────────────────────────────
// Componente: Podio (top 3)
// ────────────────────────────────────────────
function Podium({ players }) {
  const scaleAnims = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];

  useEffect(() => {
    // Animar de derecha a izquierda: 3ero, 2do, 1ero
    const order = [2, 1, 0];
    order.forEach((i, delay) => {
      Animated.spring(scaleAnims[i], {
        toValue: 1,
        delay: delay * 200 + 300,
        useNativeDriver: true,
        tension: 80,
        friction: 9,
      }).start();
    });
  }, []);

  const PODIUM_CONFIG = [
    { height: 100, color: '#F59E0B', emoji: '🥇', label: '1°', textSize: 17 },
    { height: 70,  color: '#94A3B8', emoji: '🥈', label: '2°', textSize: 15 },
    { height: 50,  color: '#CD7C3E', emoji: '🥉', label: '3°', textSize: 14 },
  ];

  // Ordenar para mostrar: [2°, 1°, 3°]
  const display = [players[1], players[0], players[2]];
  const configOrder = [1, 0, 2];

  return (
    <View style={styles.podium}>
      {display.map((player, displayIdx) => {
        const origIdx = configOrder[displayIdx];
        const cfg = PODIUM_CONFIG[origIdx];
        const anim = scaleAnims[origIdx];
        if (!player) return <View key={displayIdx} style={{ flex: 1 }} />;

        return (
          <Animated.View
            key={displayIdx}
            style={[styles.podiumSlot, { transform: [{ scale: anim }] }]}
          >
            <Text style={styles.podiumEmoji}>{cfg.emoji}</Text>
            <Text style={[styles.podiumName, { fontSize: cfg.textSize }]} numberOfLines={2}>
              {player.name}
            </Text>
            <Text style={[styles.podiumScore, { color: cfg.color }]}>{player.score}</Text>
            <View style={[styles.podiumBlock, { height: cfg.height, backgroundColor: cfg.color + '22', borderColor: cfg.color + '60' }]}>
              <Text style={[styles.podiumLabel, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}

// ────────────────────────────────────────────
// Componente: Fila de ranking
// ────────────────────────────────────────────
function RankRow({ rank, name, score, isMe }) {
  const slide = useRef(new Animated.Value(50)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1, duration: 300,
        delay: rank * 80 + 800, useNativeDriver: true,
      }),
      Animated.spring(slide, {
        toValue: 0, delay: rank * 80 + 800,
        useNativeDriver: true, tension: 70, friction: 11,
      }),
    ]).start();
  }, []);

  const RANK_COLORS = ['#F59E0B', '#94A3B8', '#CD7C3E'];
  const rankColor = RANK_COLORS[rank] ?? '#64748B';

  return (
    <Animated.View
      style={[
        styles.rankRow,
        isMe && styles.rankRowMe,
        { opacity: fade, transform: [{ translateX: slide }] },
      ]}
    >
      <View style={[styles.rankNumBox, rank < 3 && { backgroundColor: rankColor + '22', borderColor: rankColor + '55' }]}>
        <Text style={[styles.rankNum, { color: rank < 3 ? rankColor : '#64748B' }]}>
          {rank + 1}
        </Text>
      </View>
      <Text style={[styles.rankName, isMe && styles.rankNameMe]} numberOfLines={1}>
        {name}{isMe ? '  (Tú)' : ''}
      </Text>
      <Text style={[styles.rankScore, rank === 0 && { color: '#F59E0B' }]}>
        {score} pts
      </Text>
    </Animated.View>
  );
}

// ────────────────────────────────────────────
// Pantalla de Fin de Partida
// ────────────────────────────────────────────
export default function GameOverScreen({ route, navigation }) {
  const { roomCode, playerName } = route.params ?? {};

  const gameResults = useGameStore((s) => s.gameResults);
  const roundResults = useGameStore((s) => s.roundResults);
  const scores = useGameStore((s) => s.scores);
  const resetGame = useGameStore((s) => s.resetGame);

  // Usar gameResults del store, o construir desde roundResults como fallback
  const rawPlayers =
    gameResults?.players ??
    roundResults?.playerScores ?? [
      { name: playerName ?? 'Jugador', score: scores['local'] ?? 0, isMe: true },
    ];

  const sorted = [...rawPlayers].sort((a, b) => b.score - a.score);
  const winner = sorted[0];
  const isWinner = winner?.name === playerName || winner?.isMe;

  // Animación del banner ganador
  const bannerScale = useRef(new Animated.Value(0.5)).current;
  const bannerOpacity = useRef(new Animated.Value(0)).current;
  const starRotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(bannerScale, {
        toValue: 1, useNativeDriver: true, tension: 70, friction: 8,
      }),
      Animated.timing(bannerOpacity, {
        toValue: 1, duration: 500, useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.timing(starRotate, {
        toValue: 1, duration: 4000, useNativeDriver: true,
      })
    ).start();
  }, []);

  const rotate = starRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const handleRematch = () => {
    resetGame();
    // ✅ FIX: Quien pide revancha siempre es el host del nuevo juego
    // así no queda esperando eternamente a que alguien inicie la partida
    navigation.navigate('WaitingRoom', {
      roomCode,
      playerName,
      isHost: true,
    });
  };

  const handleExit = () => {
    resetGame();
    navigation.navigate('Lobby');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Banner ganador ── */}
        <Animated.View
          style={[
            styles.winnerBanner,
            isWinner && styles.winnerBannerGold,
            { opacity: bannerOpacity, transform: [{ scale: bannerScale }] },
          ]}
        >
          <Animated.Text style={[styles.winnerStar, { transform: [{ rotate }] }]}>
            ⭐
          </Animated.Text>
          <Text style={styles.winnerTitle}>
            {isWinner ? '¡Felicidades!' : '¡Fin de Partida!'}
          </Text>
          <Text style={styles.winnerName}>{winner?.name ?? '?'}</Text>
          <Text style={styles.winnerSubtitle}>
            {isWinner ? '¡Ganaste la partida! 🎉' : `${winner?.name} ganó la partida`}
          </Text>
          <Text style={styles.winnerScore}>{winner?.score ?? 0} pts</Text>
        </Animated.View>

        {/* ── Podio ── */}
        {sorted.length >= 2 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>PODIO</Text>
            <Podium players={sorted} />
          </View>
        )}

        {/* ── Ranking completo ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>RANKING FINAL</Text>
          <View style={styles.rankList}>
            {sorted.map((p, i) => (
              <RankRow
                key={i}
                rank={i}
                name={p.name}
                score={p.score}
                isMe={p.isMe || p.name === playerName}
              />
            ))}
          </View>
        </View>

        {/* ── Botones ── */}
        <View style={styles.buttons}>
          <TouchableOpacity
            style={styles.rematchBtn}
            onPress={handleRematch}
            activeOpacity={0.85}
          >
            <Text style={styles.rematchBtnText}>🔁 Revancha</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.exitBtn}
            onPress={handleExit}
            activeOpacity={0.85}
          >
            <Text style={styles.exitBtnText}>🚪 Salir al Lobby</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const BG = '#0F0F1A';
const CARD = '#1A1A2E';
const BORDER = '#2A2A45';
const TEXT = '#E2E8F0';
const MUTED = '#64748B';
const PURPLE = '#7C3AED';
const GOLD = '#F59E0B';

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  root: { flex: 1, backgroundColor: BG },
  scroll: { paddingHorizontal: 20, paddingTop: 20 },

  // Banner ganador
  winnerBanner: {
    backgroundColor: CARD, borderRadius: 24, borderWidth: 1.5,
    borderColor: PURPLE + '55', padding: 28, alignItems: 'center',
    marginBottom: 28, shadowColor: PURPLE,
    shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.4,
    shadowRadius: 20, elevation: 15,
  },
  winnerBannerGold: {
    borderColor: GOLD + '66', shadowColor: GOLD,
  },
  winnerStar: { fontSize: 48, marginBottom: 8 },
  winnerTitle: {
    fontSize: 14, fontWeight: '700', color: MUTED,
    letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6,
  },
  winnerName: { fontSize: 32, fontWeight: '900', color: TEXT, marginBottom: 4 },
  winnerSubtitle: { fontSize: 14, color: MUTED, marginBottom: 12 },
  winnerScore: { fontSize: 44, fontWeight: '900', color: GOLD },

  // Secciones
  section: { marginBottom: 28 },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: MUTED,
    letterSpacing: 2, marginBottom: 16,
  },

  // Podio
  podium: {
    flexDirection: 'row', alignItems: 'flex-end',
    justifyContent: 'center', gap: 8, paddingHorizontal: 10,
  },
  podiumSlot: { flex: 1, alignItems: 'center' },
  podiumEmoji: { fontSize: 28, marginBottom: 6 },
  podiumName: {
    fontWeight: '700', color: TEXT, textAlign: 'center',
    marginBottom: 4, lineHeight: 20,
  },
  podiumScore: { fontSize: 16, fontWeight: '800', marginBottom: 8 },
  podiumBlock: {
    width: '100%', borderRadius: 12, borderWidth: 1,
    alignItems: 'center', justifyContent: 'flex-end',
    paddingBottom: 10,
  },
  podiumLabel: { fontSize: 18, fontWeight: '900' },

  // Ranking
  rankList: { gap: 10 },
  rankRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: CARD, borderRadius: 14,
    borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 16, paddingVertical: 14, gap: 14,
  },
  rankRowMe: {
    borderColor: PURPLE + '55',
    backgroundColor: 'rgba(124,58,237,0.1)',
  },
  rankNumBox: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: BORDER, borderWidth: 1, borderColor: BORDER,
    alignItems: 'center', justifyContent: 'center',
  },
  rankNum: { fontSize: 15, fontWeight: '900' },
  rankName: { flex: 1, fontSize: 16, fontWeight: '700', color: TEXT },
  rankNameMe: { color: '#C4B5FD' },
  rankScore: { fontSize: 18, fontWeight: '800', color: MUTED },

  // Botones
  buttons: { gap: 12, marginBottom: 12 },
  rematchBtn: {
    backgroundColor: PURPLE, borderRadius: 16, paddingVertical: 18,
    alignItems: 'center',
    shadowColor: PURPLE, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5, shadowRadius: 14, elevation: 10,
  },
  rematchBtnText: { fontSize: 17, fontWeight: '700', color: '#fff' },
  exitBtn: {
    backgroundColor: CARD, borderRadius: 16, paddingVertical: 18,
    alignItems: 'center', borderWidth: 1, borderColor: BORDER,
  },
  exitBtnText: { fontSize: 17, fontWeight: '600', color: MUTED },
});
