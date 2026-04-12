import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import socketService from '../services/socketService';
import useGameStore from '../store/useGameStore';

// ────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────
const genDice = (n) =>
  Array.from({ length: n }, () => Math.floor(Math.random() * 6) + 1);

const detectCombo = (values) => {
  if (values.length !== 3) return null;
  const counts = {};
  values.forEach((v) => { counts[v] = (counts[v] || 0) + 1; });
  const keys = Object.keys(counts);

  // Trío: 3 dados iguales
  if (keys.some((k) => counts[k] === 3)) {
    const die = parseInt(keys.find((k) => counts[k] === 3));
    return { type: 'TRIPLE', emoji: '🔥', label: 'TRÍO', score: die * 10, color: '#F59E0B' };
  }

  // Escalera: 3 dados consecutivos (ej: 2-3-4, 4-5-6)
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted[1] === sorted[0] + 1 && sorted[2] === sorted[1] + 1) {
    return { type: 'STRAIGHT', emoji: '📈', label: 'ESCALERA', score: 15, color: '#06B6D4' };
  }

  // Par: 2 dados iguales
  if (keys.some((k) => counts[k] === 2)) {
    const die = parseInt(keys.find((k) => counts[k] === 2));
    return { type: 'DOUBLE', emoji: '⚡', label: 'PAR', score: die * 2, color: '#A78BFA' };
  }

  // Ninguna: suma simple
  const sum = values.reduce((a, b) => a + b, 0);
  return { type: 'SUM', emoji: '➕', label: 'NINGUNA', score: sum, color: '#34D399' };
};


// ────────────────────────────────────────────
// Componente: dado individual
// ────────────────────────────────────────────
function DieCard({ value, index, selected, played, disabled, onSelect, isSecret }) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    if (played || disabled) return;
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.82, duration: 75, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 280, friction: 9 }),
    ]).start();
    onSelect(index);
  };

  return (
    <TouchableOpacity onPress={handlePress} disabled={played || disabled} activeOpacity={0.8}>
      <Animated.View
        style={[
          styles.die,
          selected && styles.dieSelected,
          played && styles.diePlayed,
          isSecret && !played && !selected && styles.dieSecret,
          disabled && !selected && !played && styles.dieDisabled,
          { transform: [{ scale }] },
        ]}
      >
        {/* Valor o checkmark si ya fue jugado */}
        <Text
          style={[
            styles.dieNum,
            selected && styles.dieNumSelected,
            played && styles.dieNumPlayed,
            isSecret && !played && !selected && styles.dieNumSecret,
          ]}
        >
          {played ? '✓' : value}
        </Text>

        {/* Punto indicador cuando está seleccionado */}
        {selected && <View style={styles.dieSelDot} />}

        {/* Badge de secreto (solo en dados ocultos disponibles) */}
        {isSecret && !played && (
          <View style={styles.secretBadge}>
            <Text style={styles.secretBadgeText}>🔒</Text>
          </View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
}

// ────────────────────────────────────────────
// Componente: barra de combinación
// ────────────────────────────────────────────
function ComboBar({ selectedCount, combo }) {
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(fade, { toValue: 0.3, duration: 100, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }, [selectedCount, combo?.type]);

  const borderColor = combo?.color ?? '#2A2A45';
  const bg = combo ? combo.color + '18' : 'transparent';

  return (
    <Animated.View style={[styles.comboBar, { borderColor, backgroundColor: bg, opacity: fade }]}>
      {selectedCount === 0 && (
        <Text style={styles.comboHint}>👆 Selecciona 3 dados — visibles o comodines</Text>
      )}
      {selectedCount > 0 && selectedCount < 3 && (
        <Text style={styles.comboHint}>
          Selecciona {3 - selectedCount} dado{3 - selectedCount !== 1 ? 's' : ''} más...
        </Text>
      )}
      {selectedCount === 3 && combo && (
        <View style={styles.comboContent}>
          <Text style={styles.comboEmoji}>{combo.emoji}</Text>
          <Text style={[styles.comboLabel, { color: combo.color }]}>{combo.label}</Text>
          <View style={[styles.comboScorePill, { backgroundColor: combo.color + '22', borderColor: combo.color + '55' }]}>
            <Text style={[styles.comboScore, { color: combo.color }]}>+{combo.score} pts</Text>
          </View>
        </View>
      )}
    </Animated.View>
  );
}

// ────────────────────────────────────────────
// Mini tablero oponentes
// ────────────────────────────────────────────
function MiniBoard({ player, score }) {
  const initials = player.name?.charAt(0)?.toUpperCase() ?? '?';
  const COLORS = ['#7C3AED', '#F59E0B', '#10B981', '#EF4444', '#3B82F6'];
  const color = COLORS[(player.name?.charCodeAt(0) ?? 0) % COLORS.length];

  return (
    <View style={styles.miniBoard}>
      <View style={styles.miniBoardTop}>
        <View style={[styles.miniAvatar, { backgroundColor: color }]}>
          <Text style={styles.miniAvatarText}>{initials}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.miniName} numberOfLines={1}>{player.name}</Text>
          <Text style={styles.miniScore}>{score ?? 0} pts</Text>
        </View>
      </View>
      <View style={styles.miniGrid}>
        {(player.dice ?? genDice(9)).map((d, i) => (
          <View key={i} style={styles.miniDie}>
            <Text style={styles.miniDieText}>{d}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ────────────────────────────────────────────
// Pantalla principal del juego
// ────────────────────────────────────────────
export default function GameScreen({ route, navigation }) {
  const params = route?.params ?? {};
  const roomCode = params.roomCode ?? 'DEMO01';
  const playerName = params.playerName ?? 'Jugador';

  // Store selectors
  const allDice            = useGameStore((s) => s.allDice);
  const playedDiceIndices  = useGameStore((s) => s.playedDiceIndices);
  const selectedDiceIndices = useGameStore((s) => s.selectedDiceIndices);
  const players            = useGameStore((s) => s.players);
  const scores             = useGameStore((s) => s.scores);
  const roundNumber        = useGameStore((s) => s.roundNumber);
  const totalRounds        = useGameStore((s) => s.totalRounds);

  // Store actions
  const setAllDice         = useGameStore((s) => s.setAllDice);
  const toggleSelectDie    = useGameStore((s) => s.toggleSelectDie);
  const clearSelection     = useGameStore((s) => s.clearSelection);
  const markSelectedAsPlayed = useGameStore((s) => s.markSelectedAsPlayed);
  const setGamePhase       = useGameStore((s) => s.setGamePhase);
  const setRoundResults    = useGameStore((s) => s.setRoundResults);
  const updateScore        = useGameStore((s) => s.updateScore);

  const [submitting, setSubmitting] = useState(false);
  const MY_ID = 'local';

  useEffect(() => {
    // ✅ FIX: Solo generar dados si aún no existen (una sola tirada por partida)
    if (allDice.length === 0) {
      setAllDice(genDice(11)); // índices 0-8: visibles, 9-10: ocultos
    }
    setGamePhase('selecting');
    clearSelection();

    const socket = socketService.connect();

    socket.on('round_results', (data) => {
      setRoundResults(data);
      navigation.navigate('RoundResults', { roomCode, playerName, totalRounds });
    });
    socket.on('game_over', () => {
      navigation.navigate('GameOver', { roomCode, playerName });
    });

    return () => {
      socket.off('round_results');
      socket.off('game_over');
    };
  }, []); // Sin dependencia de roundNumber: los dados no se regeneran

  // Computed
  const selectedValues = selectedDiceIndices.map((i) => allDice[i]);
  const combo          = detectCombo(selectedValues);
  const canConfirm     = selectedDiceIndices.length === 3 && !submitting;

  // Dados disponibles (no jugados, no seleccionados actualmente)
  const totalPlayed    = playedDiceIndices.length;
  const available      = allDice.length - totalPlayed;

  // Separación para display
  const visibleDice = allDice.slice(0, 9);   // índices 0–8
  const hiddenDice  = allDice.slice(9, 11);  // índices 9–10

  const handleConfirm = () => {
    if (!canConfirm) return;
    setSubmitting(true);

    const pts      = combo?.score ?? 0;
    const newScore = (scores[MY_ID] ?? 0) + pts;
    updateScore(MY_ID, newScore);

    setRoundResults({
      playerName,
      selectedDice: selectedValues,
      combo,
      roundNumber,
      totalRounds,
      playerScores: [
        { name: playerName, score: newScore, isMe: true },
        ...players
          .filter((p) => p.id !== MY_ID)
          .map((p) => ({ name: p.name, score: scores[p.id] ?? 0 })),
      ],
    });

    const socket = socketService.connect();
    socket.emit('game_action', {
      roomId: roomCode,
      action: { type: 'play_dice', selectedDice: selectedValues, combo, playerName },
    });

    // ✅ FIX: Marcar como jugados ANTES de navegar para que persistan
    markSelectedAsPlayed();

    setTimeout(() => {
      setSubmitting(false);
      navigation.navigate('RoundResults', { roomCode, playerName, totalRounds });
    }, 600);
  };

  const otherPlayers = players.filter((p) => p.id !== MY_ID);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.roundBadge}>
            <Text style={styles.roundLabel}>RONDA</Text>
            <Text style={styles.roundNum}>
              {roundNumber}
              <Text style={styles.roundTotal}>/{totalRounds}</Text>
            </Text>
          </View>

          <View style={styles.phaseRow}>
            <View style={styles.phaseDot} />
            <Text style={styles.phaseText}>Seleccionando</Text>
          </View>

          <View style={styles.availBox}>
            <Text style={styles.availLabel}>Disponibles</Text>
            <Text style={styles.availValue}>{available}</Text>
          </View>
        </View>

        {/* ── Aviso ronda 1: una sola tirada ── */}
        {roundNumber === 1 && (
          <View style={styles.tipsBox}>
            <Text style={styles.tipsText}>
              🎲 Los dados se lanzaron <Text style={styles.tipsBold}>una sola vez</Text>.
              Elige sabiamente 3 dados por ronda durante las {totalRounds} rondas.{' '}
              Al final te quedarán <Text style={styles.tipsBold}>2 sobrantes</Text>.
            </Text>
          </View>
        )}

        {/* ── Oponentes ── */}
        {otherPlayers.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>OPONENTES</Text>
            <FlatList
              horizontal
              data={otherPlayers}
              keyExtractor={(p, i) => p.id ?? String(i)}
              renderItem={({ item }) => (
                <MiniBoard player={item} score={scores[item.id]} />
              )}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 12, paddingVertical: 4 }}
            />
          </View>
        )}

        {/* ── 9 Dados visibles ── */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionLabel}>DADOS VISIBLES</Text>
            <Text style={styles.selCount}>
              <Text style={{ color: selectedDiceIndices.length === 3 ? '#7C3AED' : '#64748B' }}>
                {selectedDiceIndices.length}
              </Text>
              /3
            </Text>
          </View>

          <View style={styles.diceGrid}>
            {visibleDice.map((die, i) => {
              const played   = playedDiceIndices.includes(i);
              const selected = selectedDiceIndices.includes(i);
              const full     = selectedDiceIndices.length >= 3 && !selected;
              return (
                <DieCard
                  key={i}
                  value={die}
                  index={i}
                  selected={selected}
                  played={played}
                  onSelect={toggleSelectDie}
                  disabled={full || played}
                  isSecret={false}
                />
              );
            })}
          </View>
        </View>

        {/* ── Barra de combinación ── */}
        <ComboBar selectedCount={selectedDiceIndices.length} combo={combo} />

        {/* ✅ FIX: Dados ocultos ahora son INTERACTIVOS (comodines) ── */}
        <View style={styles.privateSection}>
          <View style={styles.privateDivider}>
            <View style={styles.divLine} />
            <View style={styles.lockBadge}>
              <Text style={styles.lockText}>🔒  COMODINES OCULTOS</Text>
            </View>
            <View style={styles.divLine} />
          </View>

          <Text style={styles.hiddenTitle}>Dados Secretos</Text>
          <Text style={styles.hiddenSub}>
            ¡Puedes seleccionarlos! Solo tú ves su valor
          </Text>

          <View style={styles.hiddenRow}>
            {hiddenDice.map((die, i) => {
              const realIndex = 9 + i; // índices reales: 9 y 10
              const played    = playedDiceIndices.includes(realIndex);
              const selected  = selectedDiceIndices.includes(realIndex);
              const full      = selectedDiceIndices.length >= 3 && !selected;
              return (
                <DieCard
                  key={realIndex}
                  value={die}
                  index={realIndex}
                  selected={selected}
                  played={played}
                  onSelect={toggleSelectDie}
                  disabled={full || played}
                  isSecret={true}
                />
              );
            })}
          </View>
        </View>

        {/* ── Botón confirmar ── */}
        <TouchableOpacity
          style={[
            styles.confirmBtn,
            !canConfirm && styles.confirmBtnDisabled,
            canConfirm && combo && { backgroundColor: combo.color, shadowColor: combo.color },
          ]}
          onPress={handleConfirm}
          disabled={!canConfirm}
          activeOpacity={0.85}
        >
          <Text style={styles.confirmBtnText}>
            {submitting
              ? '⏳ Enviando...'
              : canConfirm
              ? `Confirmar  ${combo?.emoji ?? ''}  ${combo?.label ?? ''}  (+${combo?.score ?? 0} pts)`
              : `Selecciona ${3 - selectedDiceIndices.length} dado${
                  3 - selectedDiceIndices.length !== 1 ? 's' : ''
                } más`}
          </Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ────────────────────────────────────────────
// Estilos
// ────────────────────────────────────────────
const BG     = '#0F0F1A';
const CARD   = '#1A1A2E';
const BORDER = '#2A2A45';
const TEXT   = '#E2E8F0';
const MUTED  = '#64748B';
const PURPLE = '#7C3AED';
const RED    = '#EF4444';

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: BG },
  root:   { flex: 1, backgroundColor: BG },
  scroll: { paddingHorizontal: 20, paddingTop: 16 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 16,
  },
  roundBadge: { alignItems: 'flex-start' },
  roundLabel: { fontSize: 10, color: MUTED, fontWeight: '700', letterSpacing: 1.5 },
  roundNum:   { fontSize: 26, fontWeight: '900', color: TEXT },
  roundTotal: { fontSize: 16, color: MUTED, fontWeight: '500' },
  phaseRow:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  phaseDot:   { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' },
  phaseText:  { fontSize: 13, color: '#10B981', fontWeight: '600' },
  availBox:   { alignItems: 'center' },
  availLabel: { fontSize: 10, color: MUTED, fontWeight: '700', letterSpacing: 1 },
  availValue: { fontSize: 22, fontWeight: '900', color: TEXT },

  // Tips ronda 1
  tipsBox: {
    backgroundColor: 'rgba(124,58,237,0.1)', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)',
    padding: 12, marginBottom: 16,
  },
  tipsText: { fontSize: 13, color: '#C4B5FD', lineHeight: 20 },
  tipsBold: { fontWeight: '800', color: '#A78BFA' },

  // Sections
  section:    { marginBottom: 20 },
  sectionRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: MUTED,
    letterSpacing: 1.5, textTransform: 'uppercase',
  },
  selCount: { fontSize: 14, color: MUTED, fontWeight: '600' },

  // Dado
  diceGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: 10, justifyContent: 'center',
  },
  die: {
    width: 78, height: 78, borderRadius: 16,
    backgroundColor: CARD, borderWidth: 2, borderColor: BORDER,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 5, elevation: 5,
  },
  // Estados del dado
  dieSelected: {
    backgroundColor: 'rgba(124,58,237,0.2)', borderColor: PURPLE,
    shadowColor: PURPLE, shadowOpacity: 0.6, shadowRadius: 10, elevation: 10,
  },
  diePlayed: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderColor: '#1A2236',
    opacity: 0.45,
  },

  dieSecret: {
    backgroundColor: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.5)',
    shadowColor: RED, shadowOpacity: 0.4, shadowRadius: 8, elevation: 8,
  },
  dieDisabled: { opacity: 0.35 },

  // Número del dado
  dieNum:         { fontSize: 32, fontWeight: '800', color: TEXT },
  dieNumSelected: { color: '#C4B5FD' },
  dieNumPlayed:   { fontSize: 24, color: '#1E293B' },
  dieNumSecret:   { color: '#F87171' },

  dieSelDot: {
    position: 'absolute', top: 6, right: 6,
    width: 8, height: 8, borderRadius: 4, backgroundColor: PURPLE,
  },
  secretBadge: { position: 'absolute', bottom: 4, right: 4 },
  secretBadgeText: { fontSize: 10 },

  // Combo bar
  comboBar: {
    borderRadius: 14, borderWidth: 1.5,
    padding: 14, marginBottom: 20, alignItems: 'center',
  },
  comboHint:  { color: MUTED, fontSize: 14, fontStyle: 'italic' },
  comboContent: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  comboEmoji: { fontSize: 22 },
  comboLabel: { fontSize: 18, fontWeight: '800', letterSpacing: 1 },
  comboScorePill: {
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 4, borderWidth: 1,
  },
  comboScore: { fontSize: 16, fontWeight: '700' },

  // Mini oponentes
  miniBoard: {
    backgroundColor: CARD, borderRadius: 14, borderWidth: 1,
    borderColor: BORDER, padding: 12, width: 180,
  },
  miniBoardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  miniAvatar: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
  },
  miniAvatarText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  miniName:  { fontSize: 13, fontWeight: '700', color: TEXT },
  miniScore: { fontSize: 11, color: MUTED },
  miniGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  miniDie: {
    width: 26, height: 26, backgroundColor: '#0F0F1A',
    borderRadius: 6, borderWidth: 1, borderColor: BORDER,
    alignItems: 'center', justifyContent: 'center',
  },
  miniDieText: { fontSize: 12, fontWeight: '700', color: MUTED },

  // Zona privada
  privateSection: { marginBottom: 24 },
  privateDivider: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10,
  },
  divLine: { flex: 1, height: 1, backgroundColor: BORDER },
  lockBadge: {
    backgroundColor: 'rgba(239,68,68,0.12)', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 5,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
  },
  lockText: { color: '#F87171', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  hiddenTitle: {
    fontSize: 15, fontWeight: '700', color: TEXT,
    textAlign: 'center', marginBottom: 4,
  },
  hiddenSub: { fontSize: 12, color: '#F87171', textAlign: 'center', marginBottom: 14 },
  hiddenRow: { flexDirection: 'row', justifyContent: 'center', gap: 20 },

  // Botón confirmar
  confirmBtn: {
    backgroundColor: PURPLE, borderRadius: 16, paddingVertical: 18,
    alignItems: 'center', shadowColor: PURPLE,
    shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.5,
    shadowRadius: 14, elevation: 10, marginBottom: 12,
  },
  confirmBtnDisabled: { backgroundColor: CARD, shadowOpacity: 0, elevation: 0 },
  confirmBtnText: { fontSize: 15, fontWeight: '700', color: TEXT, textAlign: 'center' },
});
