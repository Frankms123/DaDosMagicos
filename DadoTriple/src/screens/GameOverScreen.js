/**
 * GameOverScreen.js
 * Ranking final, podio animado y revancha automática.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  Animated, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useGameStore from '../store/useGameStore';
import socketService from '../services/socketService';
import { API_URL } from '../services/apiService';

// ─── Colores ──────────────────────────────────────────────────────────────────
const BG     = '#0F0F1A';
const CARD   = '#1A1A2E';
const BORDER = '#2A2A45';
const TEXT   = '#E2E8F0';
const MUTED  = '#64748B';
const PURPLE = '#7C3AED';
const GOLD   = '#F59E0B';
const GREEN  = '#10B981';
const RED    = '#EF4444';
const SILVER = '#94A3B8';
const BRONZE = '#CD7C3E';

// ─── Componente: Podio ────────────────────────────────────────────────────────
function Podium({ players }) {
  const anims = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];

  useEffect(() => {
    // Animación: 3°, 2°, 1° con delay escalonado
    [2, 1, 0].forEach((pos, i) => {
      Animated.spring(anims[pos], {
        toValue: 1,
        delay: i * 250 + 400,
        useNativeDriver: true,
        tension: 70, friction: 8,
      }).start();
    });
  }, []);

  const SLOTS = [
    { height: 90,  color: GOLD,   emoji: '🥇', label: '1°', fontSize: 16 },
    { height: 64,  color: SILVER, emoji: '🥈', label: '2°', fontSize: 14 },
    { height: 46,  color: BRONZE, emoji: '🥉', label: '3°', fontSize: 13 },
  ];

  // Display order: 2°, 1°, 3°
  const displayOrder = [1, 0, 2];

  return (
    <View style={styles.podium}>
      {displayOrder.map((pos, i) => {
        const player = players[pos];
        const slot   = SLOTS[pos];
        const anim   = anims[pos];
        if (!player) return <View key={i} style={{ flex: 1 }} />;

        return (
          <Animated.View
            key={i}
            style={[styles.podiumSlot, { transform: [{ scale: anim }], opacity: anim }]}
          >
            <Text style={styles.podiumEmoji}>{slot.emoji}</Text>
            <Text style={[styles.podiumName, { fontSize: slot.fontSize }]} numberOfLines={2}>
              {player.name}
            </Text>
            <Text style={[styles.podiumScore, { color: slot.color }]}>
              {player.totalPoints} pts
            </Text>
            <View style={[styles.podiumBlock, {
              height: slot.height,
              backgroundColor: slot.color + '18',
              borderColor: slot.color + '50',
            }]}>
              <Text style={[styles.podiumLabel, { color: slot.color }]}>{slot.label}</Text>
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}

// ─── Componente: Fila de ranking ──────────────────────────────────────────────
function RankRow({ player, rank, isMe, delay }) {
  const slide = useRef(new Animated.Value(50)).current;
  const fade  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade,  { toValue: 1, duration: 350, delay, useNativeDriver: true }),
      Animated.spring(slide, { toValue: 0, delay, useNativeDriver: true, tension: 70, friction: 11 }),
    ]).start();
  }, []);

  const COLORS = [GOLD, SILVER, BRONZE];
  const color  = COLORS[rank] ?? MUTED;
  const MEDALS = ['🥇', '🥈', '🥉'];
  const medal  = MEDALS[rank] ?? `${rank + 1}°`;

  return (
    <Animated.View style={[
      styles.rankRow,
      isMe && styles.rankRowMe,
      rank === 0 && styles.rankRowFirst,
      { opacity: fade, transform: [{ translateX: slide }] },
    ]}>
      <View style={[styles.rankNumBox, rank < 3 && { backgroundColor: color + '18', borderColor: color + '40' }]}>
        <Text style={[styles.rankMedal]}>{medal}</Text>
      </View>
      <Text style={[styles.rankName, isMe && styles.rankNameMe]} numberOfLines={1}>
        {player.name}{isMe ? '  (tú)' : ''}
      </Text>
      <View style={styles.rankPtsCol}>
        <Text style={[styles.rankScore, rank === 0 && { color: GOLD }]}>
          {player.totalPoints} pts
        </Text>
      </View>
    </Animated.View>
  );
}

// ─── Pantalla principal ───────────────────────────────────────────────────────
export default function GameOverScreen({ navigation }) {
  const gameOver    = useGameStore(s => s.gameOver);
  const playerId    = useGameStore(s => s.playerId);
  const playerName  = useGameStore(s => s.playerName);
  const resetGame   = useGameStore(s => s.resetGame);

  // Capturar nombre en ref para que no se pierda aunque el store se resetee
  const playerNameRef = useRef(playerName);
  useEffect(() => {
    if (playerName) playerNameRef.current = playerName;
  }, [playerName]);

  const [rematchLoading, setRematchLoading] = useState(false);
  const [playerStats, setPlayerStats]     = useState(null);
  const [globalRanking, setGlobalRanking] = useState([]);
  const [podiumPoints, setPodiumPoints]   = useState(null); // puntos ganados al perfil

  // Animaciones del banner
  const bannerScale   = useRef(new Animated.Value(0.5)).current;
  const bannerOpacity = useRef(new Animated.Value(0)).current;
  const starRotate    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(bannerScale,   { toValue: 1, useNativeDriver: true, tension: 70, friction: 8 }),
      Animated.timing(bannerOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();

    Animated.loop(
      Animated.timing(starRotate, { toValue: 1, duration: 4000, useNativeDriver: true })
    ).start();
  }, []);

  // Cargar stats del jugador y ranking global
  useEffect(() => {
    const currentName = playerNameRef.current || playerName;
    if (!currentName) return;

    // Stats del jugador actual
    fetch(`${API_URL}/stats/player/${encodeURIComponent(currentName)}`)
      .then(r => r.json())
      .then(data => { if (data.stats) setPlayerStats(data.stats); })
      .catch(() => {});

    // Ranking global top 5
    fetch(`${API_URL}/stats/ranking?limit=5`)
      .then(r => r.json())
      .then(data => { if (data.ranking) setGlobalRanking(data.ranking); })
      .catch(() => {});

    // Determinar si el jugador está en el podio de esta partida
    if (gameOver?.podium) {
      const myPodium = gameOver.podium.find(
        p => p.name === currentName || p.id === playerId
      );
      if (myPodium) setPodiumPoints(myPodium);
    }
  }, [gameOver]);

  const rotate = starRotate.interpolate({
    inputRange: [0, 1], outputRange: ['0deg', '360deg'],
  });

  // Construir lista de jugadores ordenada
  const players = gameOver?.state?.players
    ? [...gameOver.state.players].sort((a, b) => b.totalPoints - a.totalPoints)
    : [];

  const winner   = gameOver?.winner;
  const isWinner = winner?.id === playerId || winner?.name === playerName;

  const handleRematch = () => {
    // Usar la ref que capturó el nombre antes de cualquier reset
    const currentName = playerNameRef.current || playerName || 'Jugador';
    console.log('🎮 Revancha con nombre:', currentName);
    setRematchLoading(true);
    resetGame();

    // Escuchar room_created para navegar
    socketService.once('room_created', (payload) => {
      socketService.saveReconnectData(payload.playerId, payload.roomCode);
      useGameStore.setState({
        playerId:   payload.playerId,
        roomId:     payload.roomId,
        roomCode:   payload.roomCode,
        playerName: currentName,
        isHost:     true,
      });
      useGameStore.getState().applyRoomState(payload);
      navigation.navigate('WaitingRoom', {
        roomCode:   payload.roomCode,
        playerName: currentName,
        isHost:     true,
      });
      setRematchLoading(false);
    });

    socketService.createRoom(currentName, 4);
  };

  const handleExit = () => {
    resetGame();
    socketService.clearReconnectData();
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
        <Animated.View style={[
          styles.winnerBanner,
          isWinner && styles.winnerBannerGold,
          { opacity: bannerOpacity, transform: [{ scale: bannerScale }] },
        ]}>
          <Animated.Text style={[styles.winnerStar, { transform: [{ rotate }] }]}>
            ⭐
          </Animated.Text>
          <Text style={styles.winnerLabel}>
            {isWinner ? '¡GANASTE!' : 'FIN DE PARTIDA'}
          </Text>
          <Text style={styles.winnerName}>{winner?.name ?? '?'}</Text>
          <Text style={styles.winnerSub}>
            {isWinner ? '¡Eres el campeón! 🎉' : `${winner?.name} ganó la partida`}
          </Text>
          <Text style={styles.winnerScore}>{winner?.totalPoints ?? 0} pts</Text>
        </Animated.View>

        {/* ── Podio ── */}
        {players.length >= 2 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>PODIO</Text>
            <Podium players={players} />
          </View>
        )}

        {/* ── Ranking completo ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>RANKING FINAL</Text>
          <View style={styles.rankList}>
            {players.map((p, i) => (
              <RankRow
                key={p.id}
                player={p}
                rank={i}
                isMe={p.id === playerId || p.name === playerName}
                delay={i * 100}
              />
            ))}
          </View>
        </View>

        {/* ── Puntos al perfil global ── */}
        {podiumPoints && (
          <View style={[
            styles.podiumBadge,
            podiumPoints.position === 1 && { borderColor: GOLD + '60', backgroundColor: GOLD + '10' },
            podiumPoints.position === 2 && { borderColor: SILVER + '60', backgroundColor: SILVER + '10' },
            podiumPoints.position === 3 && { borderColor: BRONZE + '60', backgroundColor: BRONZE + '10' },
          ]}>
            <Text style={styles.podiumBadgeEmoji}>
              {['🥇','🥈','🥉'][podiumPoints.position - 1]}
            </Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.podiumBadgeTitle}>¡Puntos guardados en tu perfil!</Text>
              <Text style={styles.podiumBadgeDesc}>
                +{podiumPoints.totalPoints} pts · posición {podiumPoints.position}
              </Text>
            </View>
          </View>
        )}

        {/* ── Stats personales ── */}
        {playerStats && (
          <View style={styles.statsCard}>
            <Text style={styles.statsCardTitle}>TU PERFIL GLOBAL</Text>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{playerStats.totalScore ?? 0}</Text>
                <Text style={styles.statLabel}>pts totales</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{playerStats.gamesPlayed ?? 0}</Text>
                <Text style={styles.statLabel}>partidas</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{playerStats.podiums ?? 0}</Text>
                <Text style={styles.statLabel}>podios</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{playerStats.wins ?? 0}</Text>
                <Text style={styles.statLabel}>victorias</Text>
              </View>
            </View>
          </View>
        )}

        {/* ── Ranking global ── */}
        {globalRanking.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>🌍 RANKING GLOBAL</Text>
            <View style={styles.globalRankingCard}>
              {globalRanking.map((p, i) => {
                const isMe = p.name === (playerNameRef.current || playerName);
                return (
                  <View key={p.name} style={[
                    styles.globalRankRow,
                    isMe && styles.globalRankRowMe,
                    i === 0 && styles.globalRankRowFirst,
                  ]}>
                    <Text style={styles.globalRankMedal}>
                      {['🥇','🥈','🥉'][i] ?? `${i+1}`}
                    </Text>
                    <Text style={[styles.globalRankName, isMe && { color: '#C4B5FD' }]} numberOfLines={1}>
                      {p.name}{isMe ? ' (tú)' : ''}
                    </Text>
                    <Text style={[styles.globalRankScore, i === 0 && { color: GOLD }]}>
                      {p.totalScore} pts
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Botones ── */}
        <View style={styles.buttons}>
          <TouchableOpacity
            style={[styles.rematchBtn, rematchLoading && styles.btnDisabled]}
            onPress={handleRematch}
            disabled={rematchLoading}
            activeOpacity={0.85}
          >
            <Text style={styles.rematchBtnText}>
              {rematchLoading ? '⏳ Creando sala...' : '🔁 Revancha'}
            </Text>
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

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: BG },
  root:   { flex: 1, backgroundColor: BG },
  scroll: { paddingHorizontal: 20, paddingTop: 20 },

  // Banner ganador
  winnerBanner: {
    backgroundColor: CARD, borderRadius: 24,
    borderWidth: 1.5, borderColor: PURPLE + '55',
    padding: 28, alignItems: 'center', marginBottom: 28,
    shadowColor: PURPLE, shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4, shadowRadius: 20, elevation: 15,
  },
  winnerBannerGold: {
    borderColor: GOLD + '66',
    shadowColor: GOLD,
  },
  winnerStar:  { fontSize: 48, marginBottom: 8 },
  winnerLabel: {
    fontSize: 12, fontWeight: '800', color: MUTED,
    letterSpacing: 3, marginBottom: 8,
  },
  winnerName:  { fontSize: 34, fontWeight: '900', color: TEXT, marginBottom: 4 },
  winnerSub:   { fontSize: 14, color: MUTED, marginBottom: 12 },
  winnerScore: { fontSize: 48, fontWeight: '900', color: GOLD },

  // Sección
  section: { marginBottom: 28 },
  sectionLabel: {
    fontSize: 10, fontWeight: '700', color: MUTED,
    letterSpacing: 2, marginBottom: 16,
  },

  // Podio
  podium: {
    flexDirection: 'row', alignItems: 'flex-end',
    justifyContent: 'center', gap: 8, paddingHorizontal: 8,
  },
  podiumSlot:  { flex: 1, alignItems: 'center' },
  podiumEmoji: { fontSize: 28, marginBottom: 6 },
  podiumName:  {
    fontWeight: '700', color: TEXT, textAlign: 'center',
    marginBottom: 4, lineHeight: 20,
  },
  podiumScore: { fontSize: 15, fontWeight: '800', marginBottom: 8 },
  podiumBlock: {
    width: '100%', borderRadius: 12, borderWidth: 1,
    alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 8,
  },
  podiumLabel: { fontSize: 20, fontWeight: '900' },

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
    backgroundColor: PURPLE + '0D',
  },
  rankRowFirst: {
    borderColor: GOLD + '55',
    backgroundColor: GOLD + '08',
  },
  rankNumBox: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: BORDER, borderWidth: 1, borderColor: BORDER,
    alignItems: 'center', justifyContent: 'center',
  },
  rankMedal:   { fontSize: 18 },
  rankName:    { flex: 1, fontSize: 16, fontWeight: '700', color: TEXT },
  rankNameMe:  { color: '#C4B5FD' },
  rankPtsCol:  { alignItems: 'flex-end' },
  rankScore:   { fontSize: 20, fontWeight: '800', color: MUTED },

  // Botones
  buttons: { gap: 12 },
  rematchBtn: {
    backgroundColor: PURPLE, borderRadius: 16,
    paddingVertical: 18, alignItems: 'center',
    shadowColor: PURPLE, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5, shadowRadius: 14, elevation: 10,
  },
  rematchBtnText: { fontSize: 18, fontWeight: '700', color: '#fff' },
  exitBtn: {
    backgroundColor: CARD, borderRadius: 16,
    paddingVertical: 18, alignItems: 'center',
    borderWidth: 1, borderColor: BORDER,
  },
  exitBtnText: { fontSize: 17, fontWeight: '600', color: MUTED },
  btnDisabled: { opacity: 0.5 },

  // Podio badge
  podiumBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: PURPLE + '10', borderRadius: 16, borderWidth: 1.5,
    borderColor: PURPLE + '40', padding: 16, marginBottom: 16,
  },
  podiumBadgeEmoji: { fontSize: 28 },
  podiumBadgeTitle: { fontSize: 14, fontWeight: '800', color: TEXT },
  podiumBadgeDesc:  { fontSize: 12, color: MUTED, marginTop: 2 },

  // Stats personales
  statsCard: {
    backgroundColor: CARD, borderRadius: 16, borderWidth: 1,
    borderColor: BORDER, padding: 16, marginBottom: 16,
  },
  statsCardTitle: {
    fontSize: 9, fontWeight: '700', color: MUTED,
    letterSpacing: 2, marginBottom: 12,
  },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '900', color: GOLD },
  statLabel: { fontSize: 10, color: MUTED, marginTop: 2 },
  statDivider: { width: 1, height: 32, backgroundColor: BORDER },

  // Ranking global
  globalRankingCard: {
    backgroundColor: CARD, borderRadius: 14,
    borderWidth: 1, borderColor: BORDER, overflow: 'hidden',
  },
  globalRankRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    gap: 12, borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  globalRankRowMe:    { backgroundColor: PURPLE + '0D' },
  globalRankRowFirst: { backgroundColor: GOLD + '08' },
  globalRankMedal:    { fontSize: 18, width: 28 },
  globalRankName:     { flex: 1, fontSize: 14, fontWeight: '700', color: TEXT },
  globalRankScore:    { fontSize: 16, fontWeight: '800', color: MUTED },
});