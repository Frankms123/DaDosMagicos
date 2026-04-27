/**
 * RoundResultsScreen.js
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  Animated, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useGameStore from '../store/useGameStore';
import { playSound } from '../services/soundService';
import MagicBackground from '../components/MagicBackground';
import AnimatedNumber from '../components/AnimatedNumber';
import DiceFace from '../components/DiceFace';
import { colors, shadows } from '../theme';
import { Trophy, Medal, Award, CheckCircle2, AlertCircle } from 'lucide-react-native';

// ─── Colores ──────────────────────────────────────────────────────────────────
const BG     = colors.bg;
const CARD   = colors.card;
const BORDER = colors.border;
const TEXT   = colors.text;
const MUTED  = colors.muted;
const PURPLE = colors.purple;
const GOLD   = colors.gold;
const GREEN  = colors.green;
const RED    = colors.red;
const BLUE   = colors.blue;

const VALUE_COLOR = { 1:'#94A3B8', 2:'#60A5FA', 3:'#34D399', 4:'#FBBF24', 5:'#F87171', 6:'#A78BFA' };

const RANK_META = [
  { label: '1°', color: '#F59E0B', pts: 6 },
  { label: '2°', color: '#94A3B8', pts: 3 },
  { label: '3°', color: '#CD7C3E', pts: 1 },
  { label: '4°', color: '#64748B', pts: 0 },
];

const HAND_COLOR = {
  'Trío':     '#A78BFA',
  'Escalera': '#34D399',
  'Par':      '#60A5FA',
  'Nada':     '#64748B',
};

function handColor(handName) {
  if (!handName) return MUTED;
  for (const [key, color] of Object.entries(HAND_COLOR)) {
    if (handName.startsWith(key)) return color;
  }
  return MUTED;
}

// ─── Componente: Dado estático ────────────────────────────────────────────────
function StaticDie({ value, color }) {
  const hidden = value === null || value === undefined;
  return (
    <View style={[styles.staticDie, hidden && styles.staticDieHidden, { borderColor: color + '80' }]}>
      <DiceFace
        value={value}
        hidden={hidden}
        size={32}
        pipColor={hidden ? BLUE : color}
        faceColor={hidden ? colors.bg2 : BG}
        borderColor={hidden ? BLUE + '80' : color + '80'}
      />
      <Text style={[styles.staticDieNum, { color: hidden ? BLUE : color }]}>
        {hidden ? 'OCULTO' : value}
      </Text>
    </View>
  );
}

// ─── Componente: Fila de jugador ──────────────────────────────────────────────
function PlayerRow({ player, rank, isMe, delay }) {
  const slide = useRef(new Animated.Value(60)).current;
  const fade  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade,  { toValue: 1, duration: 400, delay, useNativeDriver: true }),
      Animated.spring(slide, { toValue: 0, delay, useNativeDriver: true, tension: 70, friction: 11 }),
    ]).start();
  }, []);

  const meta   = RANK_META[rank] ?? RANK_META[3];
  const hColor = handColor(player.hand?.name);
  const dice   = player.presentedDice ?? [];

  return (
    <Animated.View style={[
      styles.playerRow,
      isMe && styles.playerRowMe,
      rank === 0 && styles.playerRowFirst,
      { opacity: fade, transform: [{ translateX: slide }] },
    ]}>
      {/* Posición */}
      <View style={[styles.rankMark, {borderColor: meta.color + '66', backgroundColor: meta.color + '14'}]}>
        {rank === 0 ? <Trophy size={16} color={GOLD} /> :
         rank === 1 ? <Medal size={16} color={meta.color} /> :
         rank === 2 ? <Award size={16} color={meta.color} /> :
         <Text style={[styles.rankMarkText, {color: meta.color}]}>{meta.label}</Text>}
      </View>

      {/* Info jugador */}
      <View style={styles.playerInfo}>
        <View style={styles.playerNameRow}>
          <Text style={[styles.playerName, isMe && styles.playerNameMe]} numberOfLines={1}>
            {player.name}{isMe ? ' (tú)' : ''}
          </Text>
          <View style={[styles.handBadge, { backgroundColor: hColor + '20', borderColor: hColor + '50' }]}>
            <Text style={[styles.handBadgeText, { color: hColor }]}>
              {player.hand?.name ?? 'Sin mano'}
            </Text>
          </View>
        </View>

        {/* Dados presentados */}
        {dice.length === 0 ? (
          <Text style={styles.noDice}>Sin dados presentados</Text>
        ) : (
          <View style={styles.diceRow}>
            {dice.map((val, i) => (
              <StaticDie key={i} value={val} color={VALUE_COLOR[Number(val)] ?? MUTED} />
            ))}
          </View>
        )}
      </View>

      {/* Puntos */}
      <View style={styles.pointsCol}>
        <AnimatedNumber
          value={player.roundPoints ?? 0}
          prefix="+"
          style={[styles.roundPts, { color: meta.color }]}
        />
        {player.bonusPoints > 0 && (
          <Text style={styles.bonusPts}>Bonus +{player.bonusPoints}</Text>
        )}
        <Text style={styles.totalPts}>{player.totalPoints ?? 0} pts</Text>
      </View>
    </Animated.View>
  );
}

// ─── Componente: Countdown circular ──────────────────────────────────────────
function Countdown({ seconds, total, onFinish, onPress }) {
  const progress = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 0,
      duration: total * 1000,
      useNativeDriver: false,
    }).start();
  }, []);

  const width = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <TouchableOpacity style={styles.countdownBtn} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.countdownTrack}>
        <Animated.View style={[styles.countdownFill, { width }]} />
      </View>
      <Text style={styles.countdownText}>
        Continuar ({seconds}s)
      </Text>
    </TouchableOpacity>
  );
}

// ─── Pantalla principal ───────────────────────────────────────────────────────
export default function RoundResultsScreen({ route, navigation }) {
  const { roomCode, playerName, totalRounds: routeTotalRounds } = route.params ?? {};

  const roundSnapshot = useGameStore(s => s.roundSnapshot);
  const playerId      = useGameStore(s => s.playerId);
  const roundNumber   = useGameStore(s => s.roundNumber);
  const totalRounds   = useGameStore(s => s.totalRounds) || routeTotalRounds || 3;
  const roomCode_     = useGameStore(s => s.roomCode) || roomCode;
  const playerName_   = useGameStore(s => s.playerName) || playerName;

  const [countdown, setCountdown] = useState(10);
  const isLastRound = roundNumber >= totalRounds;

  // Countdown automático
  useEffect(() => {
    if (countdown <= 0) {
      handleContinue(false);
      return;
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // Animación del header
  const headerScale = useRef(new Animated.Value(0.7)).current;
  const headerOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(headerScale,   { toValue: 1, useNativeDriver: true, tension: 70, friction: 8 }),
      Animated.timing(headerOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleContinue = (withSound = true) => {
    if (withSound) playSound('click', 0.55);
    if (isLastRound) {
      navigation.navigate('GameOver', { roomCode: roomCode_, playerName: playerName_ });
    }
    // Si no es la última ronda, useWebSocket navegará a Game cuando llegue round_started
    // No hacemos nada — esperamos el evento del servidor
  };

  // Ordenar jugadores por puntos de ronda desc
  const players = roundSnapshot?.players
    ? [...roundSnapshot.players].sort((a, b) => b.roundPoints - a.roundPoints)
    : [];

  const myResult = players.find(p => p.id === playerId);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <MagicBackground intensity={0.65} />
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <Animated.View style={[styles.header, { opacity: headerOpacity, transform: [{ scale: headerScale }] }]}>
          <Text style={styles.roundTag}>RONDA {roundNumber} · RESULTADOS</Text>
          <Text style={styles.roundTitle}>
            {isLastRound ? 'Última ronda' : `${roundNumber} de ${totalRounds}`}
          </Text>

          {/* Mi resultado destacado */}
          {myResult && (
            <View style={[styles.myResultBadge, { borderColor: handColor(myResult.hand?.name) + '60' }]}>
              <Text style={[styles.myHandName, { color: handColor(myResult.hand?.name) }]}>
                {myResult.hand?.name ?? '—'}
              </Text>
              <Text style={styles.myPoints}>+{myResult.roundPoints ?? 0} pts</Text>
            </View>
          )}
          {/* Resultado de predicción al final del lanzamiento */}
          {roundSnapshot?.isLastRoundOfLaunch && myResult?.prediction && (
            <View style={[
              styles.predictionResult,
              myResult.predictionHit
                ? { backgroundColor: '#10B98120', borderColor: '#10B98155' }
                : { backgroundColor: '#EF444420', borderColor: '#EF444455' },
            ]}>
              <View style={[
                styles.predictionResultMark,
                myResult.predictionHit ? styles.predictionResultMarkHit : styles.predictionResultMarkMiss,
              ]}>
                {myResult.predictionHit ? <CheckCircle2 size={16} color="#fff" /> : <AlertCircle size={16} color="#fff" />}
              </View>
              <View>
                <Text style={[styles.predictionResultTitle, { color: myResult.predictionHit ? '#10B981' : '#EF4444' }]}>
                  {myResult.predictionHit ? 'Predicción acertada' : 'Predicción fallida'}
                </Text>
                {myResult.predictionHit && myResult.bonusPoints > 0 && (
                  <Text style={styles.predictionResultBonus}>+{myResult.bonusPoints} pts bonus</Text>
                )}
              </View>
            </View>
          )}
        </Animated.View>

        {/* ── Resultados de todos ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>MANOS PRESENTADAS</Text>
          <View style={styles.playersList}>
            {players.map((p, i) => (
              <PlayerRow
                key={p.id}
                player={p}
                rank={i}
                isMe={p.id === playerId}
                delay={i * 120}
              />
            ))}
          </View>
        </View>

        {/* ── Marcador acumulado ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>MARCADOR ACUMULADO</Text>
          <View style={styles.scoreboard}>
            {[...players]
              .sort((a, b) => b.totalPoints - a.totalPoints)
              .map((p, i) => (
                <View key={p.id} style={[
                  styles.scoreRow,
                  p.id === playerId && styles.scoreRowMe,
                  i === 0 && styles.scoreRowFirst,
                ]}>
                  <Text style={styles.scoreRank}>{`${i + 1}°`}</Text>
                  <Text style={[styles.scoreName, p.id === playerId && styles.scoreNameMe]} numberOfLines={1}>
                    {p.name}{p.id === playerId ? ' (tú)' : ''}
                  </Text>
                  <Text style={[styles.scoreTotal, i === 0 && { color: GOLD }]}>
                    {p.totalPoints ?? 0} pts
                  </Text>
                </View>
              ))}
          </View>
        </View>

        {/* ── Countdown ── */}
        <Countdown
          seconds={countdown}
          total={10}
          onPress={handleContinue}
          onFinish={handleContinue}
        />

        {!isLastRound && (
          <Text style={styles.nextRoundHint}>
            La siguiente ronda iniciará automáticamente
          </Text>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: BG },
  root:   { flex: 1, backgroundColor: 'transparent' },
  scroll: { paddingHorizontal: 16, paddingTop: 16 },

  // Header
  header: {
    backgroundColor: CARD, borderRadius: 20,
    borderWidth: 1, borderColor: BORDER,
    padding: 20, alignItems: 'center',
    marginBottom: 20,
    ...shadows.purple,
  },
  roundTag: {
    fontSize: 10, fontWeight: '700', color: MUTED,
    letterSpacing: 2, marginBottom: 6,
  },
  roundTitle: {
    fontSize: 26, fontWeight: '900', color: TEXT, marginBottom: 14,
  },
  myResultBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: CARD, borderRadius: 14, borderWidth: 1.5,
    paddingHorizontal: 20, paddingVertical: 10,
  },
  myHandName: { fontSize: 16, fontWeight: '800' },
  myPoints:   { fontSize: 22, fontWeight: '900', color: GOLD },

  // Sección
  section: { marginBottom: 20 },
  sectionLabel: {
    fontSize: 9, fontWeight: '700', color: MUTED,
    letterSpacing: 2, marginBottom: 12,
  },

  // Lista de jugadores
  playersList: { gap: 10 },
  playerRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: CARD, borderRadius: 16,
    borderWidth: 1, borderColor: BORDER,
    padding: 14, gap: 12,
  },
  playerRowMe: {
    borderColor: PURPLE + '55',
    backgroundColor: PURPLE + '0D',
  },
  playerRowFirst: {
    borderColor: GOLD + '55',
    backgroundColor: GOLD + '08',
  },
  rankMark: {
    width: 34, height: 34, borderRadius: 10, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  rankMarkText: { fontSize: 12, fontWeight: '900' },
  playerInfo: { flex: 1 },
  playerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  playerName:   { fontSize: 15, fontWeight: '700', color: TEXT },
  playerNameMe: { color: '#C4B5FD' },
  handBadge: {
    borderRadius: 8, borderWidth: 1,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  handBadgeText: { fontSize: 11, fontWeight: '700' },
  diceRow: { flexDirection: 'row', gap: 8 },
  noDice: { fontSize: 12, color: MUTED, fontStyle: 'italic' },

  // Dado estático
  staticDie: {
    width: 46, height: 56,
    backgroundColor: BG, borderRadius: 10,
    borderWidth: 1.5, alignItems: 'center',
    justifyContent: 'center',
  },
  staticDieHidden: {
    borderStyle: 'dashed',
    backgroundColor: BLUE + '10',
  },
  staticDieEmoji: { fontSize: 18 },
  staticDieNum:   { fontSize: 8, fontWeight: '900', marginTop: 2, letterSpacing: 0.4 },

  // Puntos
  pointsCol:  { alignItems: 'flex-end' },
  roundPts:   { fontSize: 22, fontWeight: '900' },
  totalPts:   { fontSize: 12, color: MUTED, fontWeight: '600' },

  // Marcador
  scoreboard: {
    backgroundColor: CARD, borderRadius: 16,
    borderWidth: 1, borderColor: BORDER, overflow: 'hidden',
  },
  scoreRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    gap: 12, borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  scoreRowMe: { backgroundColor: PURPLE + '0D' },
  scoreRowFirst: { backgroundColor: GOLD + '08' },
  scoreRank:  { fontSize: 13, width: 28, textAlign: 'center', fontWeight: '900', color: MUTED },
  scoreName:  { flex: 1, fontSize: 15, fontWeight: '700', color: TEXT },
  scoreNameMe:{ color: '#C4B5FD' },
  scoreTotal: { fontSize: 18, fontWeight: '800', color: MUTED },

  // Countdown
  countdownBtn: {
    backgroundColor: CARD, borderRadius: 16,
    borderWidth: 1, borderColor: BORDER,
    overflow: 'hidden', marginBottom: 8,
  },
  countdownTrack: {
    height: 3, backgroundColor: BORDER,
  },
  countdownFill: {
    height: 3, backgroundColor: GREEN,
  },
  countdownText: {
    textAlign: 'center', paddingVertical: 16,
    fontSize: 15, fontWeight: '700', color: MUTED,
  },
  nextRoundHint: {
    textAlign: 'center', color: MUTED,
    fontSize: 12, fontStyle: 'italic',
  },
  bonusPts: { fontSize: 12, fontWeight: '700', color: '#F59E0B' },
  predictionResult: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 16, paddingVertical: 10,
    marginTop: 10, alignSelf: 'stretch',
  },
  predictionResultMark: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  predictionResultMarkHit: { backgroundColor: '#10B981' },
  predictionResultMarkMiss: { backgroundColor: '#EF4444' },
  predictionResultTitle: { fontSize: 14, fontWeight: '800' },
  predictionResultBonus: { fontSize: 12, color: '#F59E0B', fontWeight: '700', marginTop: 2 },
});
