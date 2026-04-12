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

// Posición en el ranking
const RANK_META = [
  { emoji: '🥇', color: '#F59E0B', label: '1°' },
  { emoji: '🥈', color: '#94A3B8', label: '2°' },
  { emoji: '🥉', color: '#CD7C3E', label: '3°' },
];

// Dado estilo visual
function StaticDie({ value, color = '#7C3AED' }) {
  return (
    <View style={[styles.staticDie, { borderColor: color, shadowColor: color }]}>
      <Text style={[styles.staticDieNum, { color }]}>{value}</Text>
    </View>
  );
}

// Fila del marcador
function ScoreRow({ rank, name, score, isMe, isFirst }) {
  const slideAnim = useRef(new Animated.Value(40)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1, duration: 350,
        delay: rank * 100, useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0, delay: rank * 100,
        useNativeDriver: true, tension: 70, friction: 11,
      }),
    ]).start();
  }, []);

  const meta = RANK_META[rank] ?? { emoji: `${rank + 1}°`, color: '#64748B', label: `${rank + 1}°` };

  return (
    <Animated.View
      style={[
        styles.scoreRow,
        isMe && styles.scoreRowMe,
        isFirst && styles.scoreRowFirst,
        { opacity: fadeAnim, transform: [{ translateX: slideAnim }] },
      ]}
    >
      <Text style={styles.rankEmoji}>{RANK_META[rank]?.emoji ?? `${rank + 1}`}</Text>
      <Text style={[styles.scoreName, isMe && styles.scoreNameMe]} numberOfLines={1}>
        {name}{isMe ? ' (Tú)' : ''}
      </Text>
      <Text style={[styles.scoreValue, { color: meta.color }]}>{score} pts</Text>
    </Animated.View>
  );
}

export default function RoundResultsScreen({ route, navigation }) {
  const { roomCode, playerName, totalRounds } = route.params ?? {};

  const allDice           = useGameStore((s) => s.allDice);
  const playedDiceIndices  = useGameStore((s) => s.playedDiceIndices);
  const roundResults       = useGameStore((s) => s.roundResults);
  const roundNumber        = useGameStore((s) => s.roundNumber);
  const resetForNewRound   = useGameStore((s) => s.resetForNewRound);
  const setGameResults     = useGameStore((s) => s.setGameResults);

  const combo = roundResults?.combo;
  const selectedDice = roundResults?.selectedDice ?? [];
  const playerScores = roundResults?.playerScores ?? [
    { name: playerName ?? 'Jugador', score: combo?.score ?? 0, isMe: true },
  ];

  // Ordenar por puntaje descendente
  const sorted = [...playerScores].sort((a, b) => b.score - a.score);

  const isLastRound = roundNumber >= (totalRounds ?? 3); // ✅ FIX: 3 rondas por defecto

  // Calcular sobrantes (solo útil en última ronda)
  const sobrantes = allDice.filter((_, i) => !playedDiceIndices.includes(i));

  const handleContinue = () => {
    if (isLastRound) {
      setGameResults({ players: sorted });
      navigation.navigate('GameOver', { roomCode, playerName });
    } else {
      resetForNewRound();
      navigation.navigate('Game', { roomCode, playerName });
    }
  };

  // Animaciones del encabezado
  const headerScale = useRef(new Animated.Value(0.6)).current;
  const headerOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(headerScale, {
        toValue: 1, useNativeDriver: true, tension: 80, friction: 9,
      }),
      Animated.timing(headerOpacity, {
        toValue: 1, duration: 400, useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const comboColor = combo?.color ?? '#7C3AED';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Encabezado de ronda ── */}
        <View style={styles.roundHeader}>
          <Text style={styles.roundTag}>RONDA {roundNumber}</Text>
          <Text style={styles.roundTitle}>Resultados</Text>
        </View>

        {/* ── Tarjeta de resultado del jugador ── */}
        <Animated.View
          style={[
            styles.resultCard,
            { borderColor: comboColor + '55', shadowColor: comboColor },
            { opacity: headerOpacity, transform: [{ scale: headerScale }] },
          ]}
        >
          {/* Dados jugados */}
          <Text style={styles.resultLabel}>DADOS JUGADOS</Text>
          <View style={styles.diceRow}>
            {selectedDice.map((d, i) => (
              <StaticDie key={i} value={d} color={comboColor} />
            ))}
          </View>

          {/* Combinación detectada */}
          {combo && (
            <View style={[styles.comboBanner, { backgroundColor: comboColor + '18', borderColor: comboColor + '44' }]}>
              <Text style={styles.comboEmoji}>{combo.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.comboType, { color: comboColor }]}>{combo.label}</Text>
                <Text style={styles.comboDesc}>
                  {combo.type === 'TRIPLE'   && 'Tres dados iguales — ¡mejor combinación!'}
                  {combo.type === 'STRAIGHT' && 'Tres dados consecutivos'}
                  {combo.type === 'DOUBLE'   && 'Dos dados iguales'}
                  {combo.type === 'SUM'      && 'Sin combinación — suma de los tres dados'}
                </Text>
              </View>
              <Text style={[styles.comboPoints, { color: comboColor }]}>+{combo.score}</Text>
            </View>
          )}
        </Animated.View>

        {/* ── Marcador acumulado ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>MARCADOR ACUMULADO</Text>
          <View style={styles.scoreList}>
            {sorted.map((p, i) => (
              <ScoreRow
                key={i}
                rank={i}
                name={p.name}
                score={p.score}
                isMe={p.isMe}
                isFirst={i === 0}
              />
            ))}
          </View>
        </View>

        {/* ── Sobrantes (solo en última ronda) ── */}
        {isLastRound && sobrantes.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>DADOS SOBRANTES</Text>
            <View style={styles.sobrantesCard}>
              <Text style={styles.sobrantesDesc}>
                Estos {sobrantes.length} dados no fueron jugados en ninguna ronda
              </Text>
              <View style={styles.diceRow}>
                {sobrantes.map((d, i) => (
                  <StaticDie key={i} value={d} color="#64748B" />
                ))}
              </View>
            </View>
          </View>
        )}

        {/* ── Botón continuar / finalizar ── */}
        <TouchableOpacity
          style={[styles.continueBtn, isLastRound && styles.finishBtn]}
          onPress={handleContinue}
          activeOpacity={0.85}
        >
          <Text style={styles.continueBtnText}>
            {isLastRound ? '🏆 Ver Resultados Finales' : `▶  Siguiente Ronda (${roundNumber + 1}/${totalRounds})`}
          </Text>
        </TouchableOpacity>

        <View style={{ height: 24 }} />
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

  // Encabezado
  roundHeader: { alignItems: 'center', marginBottom: 24 },
  roundTag: {
    fontSize: 11, fontWeight: '700', color: MUTED,
    letterSpacing: 2, marginBottom: 4,
  },
  roundTitle: { fontSize: 30, fontWeight: '900', color: TEXT },

  // Tarjeta resultado
  resultCard: {
    backgroundColor: CARD, borderRadius: 22, borderWidth: 1.5,
    padding: 20, marginBottom: 24,
    shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16,
    elevation: 12,
  },
  resultLabel: {
    fontSize: 10, fontWeight: '700', color: MUTED,
    letterSpacing: 2, marginBottom: 14, textAlign: 'center',
  },
  diceRow: {
    flexDirection: 'row', justifyContent: 'center',
    gap: 14, marginBottom: 20,
  },
  staticDie: {
    width: 72, height: 72, borderRadius: 16,
    backgroundColor: '#0F0F1A', borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
    shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.5,
    shadowRadius: 8, elevation: 6,
  },
  staticDieNum: { fontSize: 32, fontWeight: '900' },

  // Combo banner
  comboBanner: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, borderWidth: 1, padding: 16, gap: 12,
  },
  comboEmoji: { fontSize: 28 },
  comboType: { fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  comboDesc: { fontSize: 12, color: MUTED, marginTop: 2 },
  comboPoints: { fontSize: 24, fontWeight: '900' },

  // Marcador
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: MUTED,
    letterSpacing: 2, marginBottom: 14,
  },
  scoreList: { gap: 10 },
  scoreRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: CARD, borderRadius: 14,
    borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  scoreRowMe: {
    borderColor: PURPLE + '66',
    backgroundColor: 'rgba(124,58,237,0.1)',
  },
  scoreRowFirst: {
    borderColor: GOLD + '55',
    backgroundColor: 'rgba(245,158,11,0.08)',
  },
  rankEmoji: { fontSize: 22, width: 30, textAlign: 'center' },
  scoreName: { flex: 1, fontSize: 16, fontWeight: '700', color: TEXT },
  scoreNameMe: { color: '#C4B5FD' },
  scoreValue: { fontSize: 18, fontWeight: '800' },

  // Botón continuar
  continueBtn: {
    backgroundColor: PURPLE, borderRadius: 16, paddingVertical: 18,
    alignItems: 'center',
    shadowColor: PURPLE, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5, shadowRadius: 14, elevation: 10,
  },
  finishBtn: {
    backgroundColor: GOLD, shadowColor: GOLD,
  },
  continueBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  // Sobrantes
  sobrantesCard: {
    backgroundColor: 'rgba(100,116,139,0.1)',
    borderRadius: 14, borderWidth: 1,
    borderColor: '#2A2A45', padding: 16, alignItems: 'center', gap: 12,
  },
  sobrantesDesc: {
    fontSize: 13, color: '#64748B', textAlign: 'center', fontStyle: 'italic',
  },
});
