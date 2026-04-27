/**
 * GameScreen.js
 * - 3 lanzamientos × 3 rondas = 9 rondas
 * - Fase predicting: modal de predicción antes de seleccionar
 * - Dados en 6 columnas por valor
 * - Dados ocultos azul y rojo seleccionables
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Animated, Alert, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import socketService from '../services/socketService';
import { playSound } from '../services/soundService';
import useGameStore from '../store/useGameStore';

// ─── Colores ──────────────────────────────────────────────────────────────────
const BG     = '#0F0F1A';
const CARD   = '#1A1A2E';
const BORDER = '#2A2A45';
const TEXT   = '#E2E8F0';
const MUTED  = '#64748B';
const PURPLE = '#7C3AED';
const GOLD   = '#F59E0B';
const GREEN  = '#10B981';
const BLUE   = '#3B82F6';
const RED    = '#EF4444';

const DICE_FACE   = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
const VALUE_COLOR = { 1:'#94A3B8', 2:'#60A5FA', 3:'#34D399', 4:'#FBBF24', 5:'#F87171', 6:'#A78BFA' };

const PREDICTION_OPTIONS = [
  { key: 'high', label: 'Más de 10 pts', emoji: '🔥', color: '#F87171', desc: '> 10 puntos' },
  { key: 'mid',  label: '7 a 10 pts',    emoji: '⚡', color: GOLD,      desc: '7 – 10 puntos' },
  { key: 'low',  label: '1 a 6 pts',     emoji: '🌊', color: BLUE,      desc: '1 – 6 puntos' },
  { key: 'zero', label: 'Exactamente 0', emoji: '💀', color: MUTED,     desc: '0 puntos → +40 bonus' },
];

// ─── Modal de Predicción ──────────────────────────────────────────────────────
function PredictionModal({ visible, launchNumber, onPredict }) {
  const scale   = useRef(new Animated.Value(0.8)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (visible) {
      setSelected(null);
      Animated.parallel([
        Animated.spring(scale,   { toValue: 1, useNativeDriver: true, tension: 70, friction: 8 }),
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const handleConfirm = () => {
    if (!selected) return;
    playSound('click', 0.65);
    onPredict(selected);
  };

  return (
    <Modal visible={visible} transparent animationType="none">
      <View style={styles.modalOverlay}>
        <Animated.View style={[styles.modalCard, { opacity, transform: [{ scale }] }]}>
          <Text style={styles.modalLaunch}>LANZAMIENTO {launchNumber}</Text>
          <Text style={styles.modalTitle}>¿Cuántos puntos obtendrás?</Text>
          <Text style={styles.modalSub}>Predice tus puntos en estas 3 rondas</Text>

          <View style={styles.predictionOptions}>
            {PREDICTION_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.key}
                style={[
                  styles.predictionOption,
                  { borderColor: opt.color + '50' },
                  selected === opt.key && { backgroundColor: opt.color + '20', borderColor: opt.color },
                ]}
                onPress={() => {
                  playSound('click', 0.45);
                  setSelected(opt.key);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.predictionEmoji}>{opt.emoji}</Text>
                <View style={styles.predictionText}>
                  <Text style={[styles.predictionLabel, { color: selected === opt.key ? opt.color : TEXT }]}>
                    {opt.label}
                  </Text>
                  <Text style={styles.predictionDesc}>{opt.desc}</Text>
                </View>
                {selected === opt.key && (
                  <View style={[styles.predictionCheck, { backgroundColor: opt.color }]}>
                    <Text style={styles.predictionCheckText}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.confirmBtn, !selected && styles.confirmBtnDisabled]}
            onPress={handleConfirm}
            disabled={!selected}
            activeOpacity={0.85}
          >
            <Text style={styles.confirmBtnText}>
              {selected ? '✅ Confirmar predicción' : 'Elige una opción'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── Badge de predicción activa ───────────────────────────────────────────────
function PredictionBadge({ prediction }) {
  if (!prediction) return null;
  const opt = PREDICTION_OPTIONS.find(o => o.key === prediction);
  if (!opt) return null;
  return (
    <View style={[styles.predBadge, { borderColor: opt.color + '50', backgroundColor: opt.color + '15' }]}>
      <Text style={styles.predBadgeEmoji}>{opt.emoji}</Text>
      <Text style={[styles.predBadgeText, { color: opt.color }]}>{opt.label}</Text>
    </View>
  );
}

// ─── Countdown de turno ──────────────────────────────────────────────────────
function TurnCountdown({ seconds, total }) {
  const progress = seconds / total;
  const color = seconds <= 5 ? '#EF4444' : seconds <= 15 ? '#F59E0B' : '#10B981';
  return (
    <View style={styles.countdownRow}>
      <View style={styles.countdownTrack}>
        <View style={[styles.countdownFill, {
          width: `${progress * 100}%`,
          backgroundColor: color,
        }]} />
      </View>
      <Text style={[styles.countdownNum, { color }]}>{seconds}s</Text>
    </View>
  );
}

// ─── Dado individual ──────────────────────────────────────────────────────────
function Die({ value, index, selected, used, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;
  const color = VALUE_COLOR[value] ?? MUTED;

  const handlePress = () => {
    if (used) return;
    playSound('click', 0.45);
    Animated.sequence([
      Animated.spring(scale, { toValue: 0.85, useNativeDriver: true, speed: 50 }),
      Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 30 }),
    ]).start();
    onPress && onPress(index);
  };

  return (
    <TouchableOpacity onPress={handlePress} disabled={used || !onPress} activeOpacity={0.8}>
      <Animated.View style={[
        styles.die,
        selected && styles.dieSelected,
        used     && styles.dieUsed,
        { transform: [{ scale }] },
      ]}>
        <Text style={[styles.dieEmoji, { color: used ? MUTED : color }]}>{DICE_FACE[value] || '?'}</Text>
        <Text style={[styles.dieNum,   { color: used ? MUTED + '80' : color }]}>{value}</Text>
        {selected && (
          <View style={styles.selectedBadge}>
            <Text style={styles.selectedBadgeText}>✓</Text>
          </View>
        )}
        {used && (
          <View style={styles.usedOverlay}>
            <Text style={styles.usedText}>✕</Text>
          </View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Dado oculto ──────────────────────────────────────────────────────────────
function HiddenDie({ value, color, label, index, selected, used, onPress, canSelect }) {
  const scale = useRef(new Animated.Value(1)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (value || !canSelect) return;
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.06, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, [value, canSelect]);

  const handlePress = () => {
    if (!canSelect || used) return;
    playSound('click', 0.45);
    Animated.sequence([
      Animated.spring(scale, { toValue: 0.85, useNativeDriver: true, speed: 50 }),
      Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 30 }),
    ]).start();
    onPress && onPress(index);
  };

  const borderColor = color === 'blue' ? BLUE : RED;
  const bgColor     = color === 'blue' ? BLUE + '18' : RED + '18';

  return (
    <TouchableOpacity onPress={handlePress} disabled={!canSelect || used} activeOpacity={0.8}>
      <Animated.View style={[
        styles.hiddenDie,
        { borderColor: selected ? GOLD : borderColor,
          backgroundColor: selected ? GOLD + '18' : bgColor,
          transform: [{ scale: value ? scale : pulse }] },
        selected && { shadowColor: GOLD, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 8, elevation: 6 },
        used && { opacity: 0.4 },
      ]}>
        {value ? (
          <>
            <Text style={[styles.hiddenDieEmoji, { color: selected ? GOLD : borderColor }]}>{DICE_FACE[value]}</Text>
            <Text style={[styles.hiddenDieNum,   { color: selected ? GOLD : borderColor }]}>{value}</Text>
          </>
        ) : (
          <Text style={[styles.hiddenDieQuestion, { color: borderColor }]}>?</Text>
        )}
        <Text style={[styles.hiddenDieLabel, { color: (selected ? GOLD : borderColor) + 'AA' }]}>{label}</Text>
        {selected && (
          <View style={styles.selectedBadge}>
            <Text style={styles.selectedBadgeText}>✓</Text>
          </View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Pantalla principal ───────────────────────────────────────────────────────
export default function GameScreen({ route, navigation }) {
  const { roomCode, playerName } = route.params ?? {};

  const allDice             = useGameStore(s => s.allDice);
  const usedDiceIndices     = useGameStore(s => s.usedDiceIndices);
  const selectedDiceIndices = useGameStore(s => s.selectedDiceIndices);
  const toggleSelectDie     = useGameStore(s => s.toggleSelectDie);
  const markDiceAsUsed      = useGameStore(s => s.markDiceAsUsed);
  const gamePhase           = useGameStore(s => s.gamePhase);
  const roundNumber         = useGameStore(s => s.roundNumber);
  const totalRounds         = useGameStore(s => s.totalRounds);
  const launchNumber        = useGameStore(s => s.launchNumber);
  const prediction          = useGameStore(s => s.prediction);
  const hasPredicted        = useGameStore(s => s.hasPredicted);
  const players             = useGameStore(s => s.players);
  const playerId            = useGameStore(s => s.playerId);
  const isMyTurn            = useGameStore(s => s.isMyTurn);
  const currentTurnPlayerId = useGameStore(s => s.currentTurnPlayerId);
  const turnOrder           = useGameStore(s => s.turnOrder);

  const [presenting, setPresenting]       = useState(false);
  const [waitingOthers, setWaitingOthers] = useState(false);
  const [turnCountdown, setTurnCountdown] = useState(30);
  const countdownRef = useRef(null);

  const headerAnim = useRef(new Animated.Value(0)).current;

  // Resetear estado local cuando cambia la ronda
  useEffect(() => {
    setPresenting(false);
    setWaitingOthers(false);
    Animated.timing(headerAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, [roundNumber]);

  // Countdown de turno
  useEffect(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    if (isMyTurn && gamePhase === 'selecting') {
      setTurnCountdown(30);
      countdownRef.current = setInterval(() => {
        setTurnCountdown(prev => {
          if (prev <= 1) { clearInterval(countdownRef.current); return 0; }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [isMyTurn, gamePhase, currentTurnPlayerId]);

  const visibleDice = allDice.slice(0, 9);
  const hiddenDice  = allDice.slice(9, 11);

  // Agrupar dados visibles por valor (1-6)
  const diceByValue = { 1:[], 2:[], 3:[], 4:[], 5:[], 6:[] };
  visibleDice.forEach((val, i) => {
    if (diceByValue[val]) diceByValue[val].push({ value: val, originalIndex: i });
  });

  const myPlayer = players.find(p => p.id === playerId);
  const yaPresente = myPlayer?.hasSelectedDice || presenting;
  const otrosJugadores = players.filter(p => p.id !== playerId);

  const canSelect = gamePhase === 'selecting' && !yaPresente && isMyTurn;

  const handlePredict = (pred) => {
    socketService.makePrediction(pred);
    // El store se actualiza cuando llega prediction_made del servidor
  };

  const handlePresent = () => {
    playSound('click', 0.55);
    if (selectedDiceIndices.length !== 3) {
      Alert.alert('Selecciona 3 dados', 'Debes elegir exactamente 3 dados para presentar.');
      return;
    }
    const values = selectedDiceIndices.map(i => allDice[i]);
    Alert.alert(
      'Presentar dados',
      `¿Confirmas presentar: ${values.join(', ')}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Presentar',
          onPress: () => {
            playSound('click', 0.7);
            setPresenting(true);
            setWaitingOthers(true);
            markDiceAsUsed(selectedDiceIndices);
            socketService.selectDice(selectedDiceIndices);
          },
        },
      ]
    );
  };

  // Número de ronda dentro del lanzamiento (1, 2 o 3)
  const roundInLaunch = ((roundNumber - 1) % 3) + 1;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>

      {/* Modal de predicción */}
      <PredictionModal
        visible={gamePhase === 'predicting' && !hasPredicted}
        launchNumber={launchNumber}
        onPredict={handlePredict}
      />

      <ScrollView style={styles.root} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Header ── */}
        <Animated.View style={[styles.header, { opacity: headerAnim }]}>
          <View style={styles.headerLeft}>
            <Text style={styles.launchLabel}>LANCE {launchNumber}/3</Text>
            <Text style={styles.roundNum}>
              {roundInLaunch}<Text style={styles.roundTotal}>/3</Text>
            </Text>
          </View>
          <View style={styles.headerCenter}>
            <Text style={styles.roomCode}>{roomCode}</Text>
            <Text style={styles.playerNameLabel}>{playerName}</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.phaseLabel}>
              {gamePhase === 'rolling'    ? '🎲 Tirar'
               : gamePhase === 'predicting' ? '🔮 Predecir'
               : yaPresente               ? '⏳ Esperando'
               : gamePhase === 'selecting' ? '🃏 Elegir'
               : '📊 Puntuando'}
            </Text>
            {/* Ronda global */}
            <Text style={styles.globalRound}>Ronda {roundNumber}/{totalRounds}</Text>
          </View>
        </Animated.View>

        {/* Predicción activa */}
        {hasPredicted && prediction && (
          <PredictionBadge prediction={prediction} />
        )}

        {/* Esperando predicción (ya predije, esperando otros) */}
        {gamePhase === 'predicting' && hasPredicted && (
          <View style={styles.waitingBox}>
            <Text style={styles.waitingText}>⏳ Esperando que los demás predigan...</Text>
          </View>
        )}

        {/* ── Indicador de turno ── */}
        {gamePhase === 'selecting' && currentTurnPlayerId && (
          <View style={[
            styles.turnIndicator,
            isMyTurn ? styles.turnIndicatorMe : styles.turnIndicatorOther,
          ]}>
            <Text style={styles.turnIndicatorEmoji}>{isMyTurn ? '🎯' : '👀'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.turnIndicatorText, isMyTurn && { color: GOLD }]}>
                {isMyTurn
                  ? '¡Es tu turno! Selecciona 3 dados'
                  : `Turno de ${players.find(p => p.id === currentTurnPlayerId)?.name ?? '...'}`}
              </Text>
              {isMyTurn && (
                <TurnCountdown seconds={turnCountdown} total={30} />
              )}
            </View>
          </View>
        )}

        {/* ── Otros jugadores ── */}
        <View style={styles.othersRow}>
          {otrosJugadores.map((p, i) => (
            <View key={p.id} style={[styles.otherPlayer, !p.isConnected && styles.otherPlayerOff]}>
              <Text style={styles.otherPlayerName} numberOfLines={1}>{p.name}</Text>
              <Text style={styles.otherPlayerStatus}>
                {!p.isConnected       ? '⚠'
                 : gamePhase === 'predicting' && p.hasPredicted ? '🔮'
                 : gamePhase === 'predicting' ? '⏳'
                 : p.hasSelectedDice  ? '✅'
                 : p.hasRolled        ? '🎲'
                 : '⏳'}
              </Text>
            </View>
          ))}
        </View>

        {/* ── Dados visibles ── */}
        {allDice.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              DADOS DISPONIBLES
              {canSelect ? `  —  ${selectedDiceIndices.length}/3 seleccionados` : ''}
            </Text>
            <View style={styles.columnsContainer}>
              {[1, 2, 3, 4, 5, 6].map(val => (
                <View key={val} style={styles.column}>
                  <View style={[styles.columnHeader, { borderColor: VALUE_COLOR[val] + '50' }]}>
                    <Text style={[styles.columnHeaderText, { color: VALUE_COLOR[val] }]}>
                      {DICE_FACE[val]}
                    </Text>
                  </View>
                  <View style={styles.columnDice}>
                    {diceByValue[val].length === 0 ? (
                      <View style={styles.emptyColumn}>
                        <Text style={styles.emptyColumnText}>—</Text>
                      </View>
                    ) : (
                      diceByValue[val].map(({ value, originalIndex }) => (
                        <Die
                          key={originalIndex}
                          value={value}
                          index={originalIndex}
                          selected={selectedDiceIndices.includes(originalIndex)}
                          used={usedDiceIndices.includes(originalIndex)}
                          onPress={canSelect ? toggleSelectDie : null}
                        />
                      ))
                    )}
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Dados ocultos ── */}
        {allDice.length > 0 && (
          <View style={styles.hiddenSection}>
            <Text style={styles.sectionLabel}>DADOS OCULTOS</Text>
            <View style={styles.hiddenRow}>
              <HiddenDie
                value={hiddenDice[0]} color="blue" label="Azul" index={9}
                selected={selectedDiceIndices.includes(9)}
                used={usedDiceIndices.includes(9)}
                canSelect={canSelect} onPress={toggleSelectDie}
              />
              <HiddenDie
                value={hiddenDice[1]} color="red" label="Rojo" index={10}
                selected={selectedDiceIndices.includes(10)}
                used={usedDiceIndices.includes(10)}
                canSelect={canSelect} onPress={toggleSelectDie}
              />
            </View>
            {hiddenDice[0] && hiddenDice[1] && hiddenDice[0] === hiddenDice[1] && (
              <View style={styles.bonusTag}>
                <Text style={styles.bonusTagText}>🎁 ¡Bonus! Dados iguales +{hiddenDice[0] * 2} pts</Text>
              </View>
            )}
          </View>
        )}

        {/* ── Preview seleccionados ── */}
        {selectedDiceIndices.length > 0 && !yaPresente && (
          <View style={styles.selectedPreview}>
            <Text style={styles.sectionLabel}>PRESENTANDO</Text>
            <View style={styles.selectedRow}>
              {selectedDiceIndices.map(i => (
                <View key={i} style={styles.selectedPreviewDie}>
                  <Text style={[styles.selectedPreviewEmoji, { color: VALUE_COLOR[allDice[i]] }]}>
                    {DICE_FACE[allDice[i]]}
                  </Text>
                  <Text style={[styles.selectedPreviewNum, { color: VALUE_COLOR[allDice[i]] }]}>
                    {allDice[i]}
                  </Text>
                </View>
              ))}
              {Array.from({ length: 3 - selectedDiceIndices.length }).map((_, i) => (
                <View key={`e-${i}`} style={[styles.selectedPreviewDie, styles.selectedPreviewEmpty]}>
                  <Text style={styles.emptyColumnText}>?</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Acciones ── */}
        <View style={styles.actions}>

          {/* Tirar dados — solo primer lanzamiento de cada lance */}
          {gamePhase === 'rolling' && allDice.length === 0 && (
            <TouchableOpacity
              style={styles.rollBtn}
              onPress={() => {
                playSound('diceRoll', 0.85);
                socketService.rollDice();
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.rollBtnText}>🎲 Tirar dados</Text>
            </TouchableOpacity>
          )}

          {/* Esperando que otros tiren */}
          {gamePhase === 'rolling' && allDice.length > 0 && (
            <View style={styles.waitingBox}>
              <Text style={styles.waitingText}>⏳ Esperando que otros tiren...</Text>
            </View>
          )}

          {/* Presentar */}
          {canSelect && (
            <TouchableOpacity
              style={[styles.presentBtn, selectedDiceIndices.length !== 3 && styles.presentBtnDisabled]}
              onPress={handlePresent}
              disabled={selectedDiceIndices.length !== 3}
              activeOpacity={0.85}
            >
              <Text style={styles.presentBtnText}>
                {selectedDiceIndices.length === 3
                  ? '✅ Presentar dados'
                  : `Selecciona ${3 - selectedDiceIndices.length} dado${3 - selectedDiceIndices.length !== 1 ? 's' : ''} más`}
              </Text>
            </TouchableOpacity>
          )}

          {/* Ya presentó */}
          {yaPresente && gamePhase === 'selecting' && (
            <View style={styles.waitingBox}>
              <Text style={styles.waitingText}>⏳ Esperando que los demás presenten...</Text>
            </View>
          )}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: BG },
  root:   { flex: 1, backgroundColor: BG },
  scroll: { paddingHorizontal: 12, paddingTop: 8 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: CARD, borderRadius: 16,
    borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 16, paddingVertical: 12, marginBottom: 10,
  },
  headerLeft:     { alignItems: 'flex-start' },
  headerCenter:   { alignItems: 'center' },
  headerRight:    { alignItems: 'flex-end' },
  launchLabel:    { fontSize: 9, fontWeight: '700', color: PURPLE, letterSpacing: 2 },
  roundNum:       { fontSize: 28, fontWeight: '900', color: TEXT },
  roundTotal:     { fontSize: 16, fontWeight: '400', color: MUTED },
  roomCode:       { fontSize: 18, fontWeight: '800', color: GOLD, letterSpacing: 4 },
  playerNameLabel:{ fontSize: 11, color: MUTED, marginTop: 2 },
  phaseLabel:     { fontSize: 12, fontWeight: '700', color: PURPLE },
  globalRound:    { fontSize: 10, color: MUTED, marginTop: 2 },

  // Predicción badge
  predBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 8,
    marginBottom: 10, alignSelf: 'center',
  },
  predBadgeEmoji: { fontSize: 16 },
  predBadgeText:  { fontSize: 13, fontWeight: '700' },

  // Otros jugadores
  othersRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  otherPlayer: {
    flex: 1, backgroundColor: CARD, borderRadius: 10,
    borderWidth: 1, borderColor: BORDER,
    paddingVertical: 8, paddingHorizontal: 6, alignItems: 'center',
  },
  otherPlayerOff:    { opacity: 0.4 },
  otherPlayerName:   { fontSize: 11, fontWeight: '700', color: TEXT, marginBottom: 2 },
  otherPlayerStatus: { fontSize: 16 },

  // Sección
  section:      { marginBottom: 16 },
  sectionLabel: { fontSize: 9, fontWeight: '700', color: MUTED, letterSpacing: 2, marginBottom: 10 },

  // Columnas
  columnsContainer: { flexDirection: 'row', gap: 4 },
  column:           { flex: 1, alignItems: 'center' },
  columnHeader: {
    width: '100%', paddingVertical: 6, borderRadius: 8,
    borderWidth: 1, alignItems: 'center', marginBottom: 6, backgroundColor: CARD,
  },
  columnHeaderText: { fontSize: 18, fontWeight: '800' },
  columnDice:   { gap: 6, alignItems: 'center', width: '100%' },
  emptyColumn:  { paddingVertical: 8 },
  emptyColumnText: { color: BORDER, fontSize: 14, textAlign: 'center' },

  // Dado
  die: {
    width: 44, height: 52, backgroundColor: CARD,
    borderRadius: 10, borderWidth: 1.5, borderColor: BORDER,
    alignItems: 'center', justifyContent: 'center', position: 'relative',
  },
  dieSelected: {
    backgroundColor: GOLD + '18', borderColor: GOLD,
    shadowColor: GOLD, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 8, elevation: 6,
  },
  dieUsed: { backgroundColor: BORDER + '30', borderColor: BORDER + '50', opacity: 0.4 },
  dieEmoji: { fontSize: 20, marginBottom: 2 },
  dieNum:   { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  selectedBadge: {
    position: 'absolute', top: -6, right: -6,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center',
  },
  selectedBadgeText: { fontSize: 9, fontWeight: '900', color: '#000' },
  usedOverlay: {
    position: 'absolute', inset: 0, borderRadius: 10,
    backgroundColor: BG + 'AA', alignItems: 'center', justifyContent: 'center',
  },
  usedText: { fontSize: 16, color: MUTED },

  // Dados ocultos
  hiddenSection: { marginBottom: 16 },
  hiddenRow: { flexDirection: 'row', justifyContent: 'center', gap: 20 },
  hiddenDie: {
    width: 72, height: 84, borderRadius: 16, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  hiddenDieEmoji:    { fontSize: 28 },
  hiddenDieNum:      { fontSize: 14, fontWeight: '900', marginTop: 2 },
  hiddenDieQuestion: { fontSize: 32, fontWeight: '900' },
  hiddenDieLabel:    { fontSize: 9, fontWeight: '700', letterSpacing: 1, marginTop: 4 },
  bonusTag: {
    marginTop: 10, backgroundColor: GOLD + '18', borderRadius: 10,
    borderWidth: 1, borderColor: GOLD + '40',
    paddingVertical: 8, paddingHorizontal: 16, alignSelf: 'center',
  },
  bonusTagText: { color: GOLD, fontSize: 12, fontWeight: '700' },

  // Preview seleccionados
  selectedPreview: {
    backgroundColor: CARD, borderRadius: 14,
    borderWidth: 1, borderColor: GOLD + '40',
    padding: 14, marginBottom: 16,
  },
  selectedRow: { flexDirection: 'row', justifyContent: 'center', gap: 16 },
  selectedPreviewDie: {
    width: 56, height: 64, borderRadius: 12,
    backgroundColor: GOLD + '15', borderWidth: 1.5, borderColor: GOLD + '60',
    alignItems: 'center', justifyContent: 'center',
  },
  selectedPreviewEmpty: { backgroundColor: BORDER + '30', borderColor: BORDER },
  selectedPreviewEmoji: { fontSize: 24 },
  selectedPreviewNum:   { fontSize: 12, fontWeight: '900', marginTop: 2 },

  // Acciones
  actions: { gap: 10, marginBottom: 8 },
  rollBtn: {
    backgroundColor: PURPLE, borderRadius: 16, paddingVertical: 18, alignItems: 'center',
    shadowColor: PURPLE, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.5, shadowRadius: 14, elevation: 10,
  },
  rollBtnText: { fontSize: 18, fontWeight: '700', color: '#fff' },
  presentBtn: {
    backgroundColor: GREEN, borderRadius: 16, paddingVertical: 18, alignItems: 'center',
    shadowColor: GREEN, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.5, shadowRadius: 14, elevation: 10,
  },
  presentBtnDisabled: { backgroundColor: CARD, shadowOpacity: 0 },
  presentBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  waitingBox: {
    backgroundColor: CARD, borderRadius: 14, padding: 16,
    alignItems: 'center', borderWidth: 1, borderColor: BORDER,
  },
  waitingText: { color: MUTED, fontSize: 14, fontWeight: '500' },

  // Turno
  turnIndicator: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 14, borderWidth: 1.5,
    padding: 14, marginBottom: 10,
  },
  turnIndicatorMe: {
    backgroundColor: GOLD + '12', borderColor: GOLD + '60',
  },
  turnIndicatorOther: {
    backgroundColor: CARD, borderColor: BORDER,
  },
  turnIndicatorEmoji: { fontSize: 22 },
  turnIndicatorText:  { fontSize: 14, fontWeight: '700', color: TEXT },
  countdownRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  countdownTrack: {
    flex: 1, height: 4, backgroundColor: BORDER, borderRadius: 2, overflow: 'hidden',
  },
  countdownFill: { height: 4, borderRadius: 2 },
  countdownNum:  { fontSize: 12, fontWeight: '800', minWidth: 28, textAlign: 'right' },

  // Modal predicción
  modalOverlay: {
    flex: 1, backgroundColor: '#00000088',
    alignItems: 'center', justifyContent: 'center', padding: 20,
  },
  modalCard: {
    backgroundColor: CARD, borderRadius: 24,
    borderWidth: 1, borderColor: PURPLE + '55',
    padding: 24, width: '100%',
    shadowColor: PURPLE, shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5, shadowRadius: 20, elevation: 20,
  },
  modalLaunch: {
    fontSize: 10, fontWeight: '800', color: PURPLE,
    letterSpacing: 3, textAlign: 'center', marginBottom: 6,
  },
  modalTitle: {
    fontSize: 22, fontWeight: '900', color: TEXT,
    textAlign: 'center', marginBottom: 4,
  },
  modalSub: {
    fontSize: 13, color: MUTED, textAlign: 'center', marginBottom: 20,
  },
  predictionOptions: { gap: 10, marginBottom: 20 },
  predictionOption: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: BG, borderRadius: 14, borderWidth: 1.5,
    padding: 14, gap: 12,
  },
  predictionEmoji: { fontSize: 24, width: 32, textAlign: 'center' },
  predictionText:  { flex: 1 },
  predictionLabel: { fontSize: 15, fontWeight: '700' },
  predictionDesc:  { fontSize: 11, color: MUTED, marginTop: 2 },
  predictionCheck: {
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  predictionCheckText: { fontSize: 12, fontWeight: '900', color: '#000' },
  confirmBtn: {
    backgroundColor: PURPLE, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
  },
  confirmBtnDisabled: { backgroundColor: BORDER },
  confirmBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
