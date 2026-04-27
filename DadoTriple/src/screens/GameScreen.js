/**
 * GameScreen.js
 * - 3 lanzamientos × 3 rondas = 9 rondas
 * - Fase predicting: modal de predicción antes de seleccionar
 * - Dados en 6 columnas por valor
 * - Dados ocultos azul y rojo seleccionables
 */
import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Animated, Alert, Modal,
  Dimensions, PanResponder,
} from 'react-native';

const SCREEN_HEIGHT = Dimensions.get('window').height;
import { SafeAreaView } from 'react-native-safe-area-context';
import socketService from '../services/socketService';
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

// ─── Bottom Sheet de Predicción ──────────────────────────────────────────────
const PredictionModal = forwardRef(function PredictionModal({ visible, launchNumber, onPredict, onCollapseChange }, ref) {
  const translateY    = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const [selected, setSelected] = useState(null);
  const [mounted,  setMounted]  = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Altura colapsada: deja visible la barra superior del sheet (~80px desde abajo)
  const COLLAPSED_Y = SCREEN_HEIGHT * 0.82;

  const animateTo = (toValue, cb) => {
    Animated.spring(translateY, {
      toValue, useNativeDriver: true, tension: 65, friction: 11,
    }).start(cb);
  };

  useEffect(() => {
    if (visible) {
      setSelected(null);
      setCollapsed(false);
      onCollapseChange?.(false);
      setMounted(true);
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }),
        Animated.timing(overlayOpacity, { toValue: 0.35, duration: 300, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY,     { toValue: SCREEN_HEIGHT, duration: 280, useNativeDriver: true }),
        Animated.timing(overlayOpacity, { toValue: 0, duration: 280, useNativeDriver: true }),
      ]).start(() => setMounted(false));
    }
  }, [visible]);

  const handleCollapse = () => {
    setCollapsed(true);
    onCollapseChange?.(true);
    animateTo(COLLAPSED_Y);
    Animated.timing(overlayOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start();
  };

  const handleExpand = () => {
    setCollapsed(false);
    onCollapseChange?.(false);
    animateTo(0);
    Animated.timing(overlayOpacity, { toValue: 0.35, duration: 200, useNativeDriver: true }).start();
  };

  // Exponer handleExpand al padre via ref
  useImperativeHandle(ref, () => ({ expand: handleExpand }));

  const handleConfirm = () => {
    if (!selected) return;
    onPredict(selected);
  };

  if (!mounted) return null;

  return (
    <>
      <Animated.View
        style={[styles.bsOverlay, { opacity: overlayOpacity }]}
        pointerEvents="none"
      />

      <Animated.View style={[styles.bsContainer, { transform: [{ translateY }] }]}>
        {/* Handle + botón colapsar/expandir */}
        <View style={styles.bsHandleRow}>
          <View style={styles.bsHandle} />
          <TouchableOpacity
            style={styles.bsCollapseBtn}
            onPress={collapsed ? handleExpand : handleCollapse}
            activeOpacity={0.7}
          >
            <Text style={styles.bsCollapseBtnText}>
              {collapsed ? '🔮 Ver predicción' : '👁 Ver dados'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Contenido — se oculta al colapsar */}
        {!collapsed && (
          <>
            <Text style={styles.bsLaunch}>LANZAMIENTO {launchNumber}</Text>
            <Text style={styles.bsTitle}>¿Cuántos puntos obtendrás?</Text>
            <Text style={styles.bsSub}>Mira tus dados arriba y predice</Text>

            <View style={styles.bsOptions}>
              {PREDICTION_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    styles.bsOption,
                    { borderColor: opt.color + '40' },
                    selected === opt.key && {
                      backgroundColor: opt.color + '20',
                      borderColor: opt.color,
                    },
                  ]}
                  onPress={() => setSelected(opt.key)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.bsOptionEmoji}>{opt.emoji}</Text>
                  <View style={styles.bsOptionText}>
                    <Text style={[styles.bsOptionLabel, {
                      color: selected === opt.key ? opt.color : TEXT,
                    }]}>
                      {opt.label}
                    </Text>
                    <Text style={styles.bsOptionDesc}>{opt.desc}</Text>
                  </View>
                  {selected === opt.key && (
                    <View style={[styles.bsOptionCheck, { backgroundColor: opt.color }]}>
                      <Text style={styles.bsOptionCheckText}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.bsConfirmBtn, !selected && styles.bsConfirmBtnDisabled]}
              onPress={handleConfirm}
              disabled={!selected}
              activeOpacity={0.85}
            >
              <Text style={styles.bsConfirmBtnText}>
                {selected ? '✅ Confirmar predicción' : 'Elige una opción'}
              </Text>
            </TouchableOpacity>
          </>
        )}

        {/* Vista colapsada — solo muestra opción seleccionada si hay una */}
        {collapsed && (
          <View style={styles.bsCollapsedContent}>
            {selected ? (
              <>
                <Text style={styles.bsCollapsedLabel}>Tu predicción:</Text>
                <Text style={[styles.bsCollapsedValue, {
                  color: PREDICTION_OPTIONS.find(o => o.key === selected)?.color ?? TEXT
                }]}>
                  {PREDICTION_OPTIONS.find(o => o.key === selected)?.emoji}{' '}
                  {PREDICTION_OPTIONS.find(o => o.key === selected)?.label}
                </Text>
                <TouchableOpacity
                  style={styles.bsConfirmBtnSmall}
                  onPress={handleConfirm}
                  activeOpacity={0.85}
                >
                  <Text style={styles.bsConfirmBtnText}>✅ Confirmar</Text>
                </TouchableOpacity>
              </>
            ) : (
              <Text style={styles.bsCollapsedHint}>Toca "Ver predicción" para elegir</Text>
            )}
          </View>
        )}
      </Animated.View>
    </>
  );
});

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

// ─── Dados de otro jugador (agrupados por valor) ──────────────────────────────
function OtherPlayerDice({ allDice, usedDiceIndices, isMe }) {
  const visibleDice = allDice.slice(0, 9);
  const diceByValue = {};
  visibleDice.forEach((val, i) => {
    if (usedDiceIndices.includes(i)) return;
    if (val === null) return;
    if (!diceByValue[val]) diceByValue[val] = [];
    diceByValue[val].push(val);
  });

  const BLUE = '#3B82F6';
  const RED  = '#EF4444';

  // Dados ocultos
  const hidden0 = allDice[9];
  const hidden1 = allDice[10];
  const hidden0Used = usedDiceIndices.includes(9);
  const hidden1Used = usedDiceIndices.includes(10);

  const groups = Object.entries(diceByValue).sort((a, b) => Number(a[0]) - Number(b[0]));
  const hasAnything = groups.length > 0 || (!hidden0Used && hidden0 !== undefined) || (!hidden1Used && hidden1 !== undefined);

  if (!hasAnything) {
    return <Text style={styles.otherWaiting}>sin dados disponibles</Text>;
  }

  return (
    <View style={styles.otherAvailableDice}>
      {groups.map(([val, arr]) => (
        <View key={val} style={styles.otherDiceGroup}>
          <Text style={[styles.otherDiceGroupEmoji, { color: VALUE_COLOR[Number(val)] ?? MUTED }]}>
            {DICE_FACE[Number(val)]}
          </Text>
          <Text style={[styles.otherDiceGroupCount, { color: VALUE_COLOR[Number(val)] ?? MUTED }]}>
            ×{arr.length}
          </Text>
        </View>
      ))}

      {/* Dado oculto azul */}
      {!hidden0Used && hidden0 !== undefined && (
        <View style={[styles.otherDiceGroup, { borderColor: BLUE + '40', backgroundColor: BLUE + '10' }]}>
          {isMe && hidden0 ? (
            <>
              <Text style={[styles.otherDiceGroupEmoji, { color: BLUE }]}>{DICE_FACE[hidden0] || '?'}</Text>
              <Text style={[styles.otherDiceGroupCount, { color: BLUE }]}>{hidden0}</Text>
            </>
          ) : (
            <Text style={[styles.otherDiceGroupEmoji, { color: BLUE }]}>🔵</Text>
          )}
        </View>
      )}

      {/* Dado oculto rojo */}
      {!hidden1Used && hidden1 !== undefined && (
        <View style={[styles.otherDiceGroup, { borderColor: RED + '40', backgroundColor: RED + '10' }]}>
          {isMe && hidden1 ? (
            <>
              <Text style={[styles.otherDiceGroupEmoji, { color: RED }]}>{DICE_FACE[hidden1] || '?'}</Text>
              <Text style={[styles.otherDiceGroupCount, { color: RED }]}>{hidden1}</Text>
            </>
          ) : (
            <Text style={[styles.otherDiceGroupEmoji, { color: RED }]}>🔴</Text>
          )}
        </View>
      )}
    </View>
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
  const [sheetCollapsed, setSheetCollapsed] = useState(false);
  const countdownRef = useRef(null);
  const predictionSheetRef = useRef(null);

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
        ref={predictionSheetRef}
        visible={gamePhase === 'predicting' && !hasPredicted}
        launchNumber={launchNumber}
        onPredict={handlePredict}
        onCollapseChange={setSheetCollapsed}
      />

      {/* Botón flotante cuando el sheet está colapsado */}
      {gamePhase === 'predicting' && !hasPredicted && sheetCollapsed && (
        <TouchableOpacity
          style={styles.floatingPredBtn}
          onPress={() => predictionSheetRef.current?.expand()}
          activeOpacity={0.85}
        >
          <Text style={styles.floatingPredBtnText}>🔮 Predecir</Text>
        </TouchableOpacity>
      )}

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

        {/* ── Todos los jugadores (incluido yo) ── */}
        <View style={styles.othersGrid}>
          {players.map((p, i) => {
            const isMe = p.id === playerId;
            const isTheirTurn = p.id === currentTurnPlayerId && gamePhase === 'selecting';
            const dice = p.presentedDice ?? [];
            const hasDice = dice.length > 0;
            return (
              <View key={p.id} style={[
                styles.otherCard,
                isMe && styles.otherCardMe,
                !p.isConnected && styles.otherCardOff,
                isTheirTurn && styles.otherCardActive,
                hasDice && !isMe && styles.otherCardDone,
                hasDice && isMe && yaPresente && styles.otherCardDone,
              ]}>
                {/* Header */}
                <View style={styles.otherCardHeader}>
                  <Text style={styles.otherPlayerName} numberOfLines={1}>{p.name}</Text>
                  <Text style={styles.otherPlayerStatus}>
                    {!p.isConnected              ? '⚠️'
                     : gamePhase === 'predicting' && p.hasPredicted ? '🔮'
                     : gamePhase === 'predicting' ? '⏳'
                     : isTheirTurn               ? '🎯'
                     : hasDice                   ? '✅'
                     : p.hasRolled               ? '🎲'
                     : '⏳'}
                  </Text>
                </View>

                {/* Dados presentados en esta ronda */}
                {hasDice && (
                  <View style={styles.otherDiceRow}>
                    {dice.map((val, di) => {
                      const isHidden = val === null;
                      const color = isHidden ? MUTED : (VALUE_COLOR[val] ?? MUTED);
                      return (
                        <View key={di} style={[styles.otherDie, { borderColor: color + '60' }]}>
                          <Text style={[styles.otherDieEmoji, { color }]}>
                            {isHidden ? '?' : (DICE_FACE[val] || val)}
                          </Text>
                          <Text style={[styles.otherDieNum, { color }]}>
                            {isHidden ? '?' : val}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* Nombre de la mano */}
                {hasDice && p.hand && !dice.includes(null) && (
                  <Text style={[styles.otherHandName, {
                    color: p.hand.name?.startsWith('Trío')     ? '#A78BFA'
                         : p.hand.name?.startsWith('Escalera') ? '#34D399'
                         : p.hand.name?.startsWith('Par')      ? '#60A5FA'
                         : MUTED
                  }]} numberOfLines={1}>
                    {p.hand.name}
                  </Text>
                )}

                {/* Dados disponibles */}
                {!hasDice && (gamePhase === 'predicting' || gamePhase === 'selecting') && (isMe ? allDice : p.allDice)?.length > 0 && (
                  <OtherPlayerDice
                    allDice={isMe ? allDice : p.allDice}
                    usedDiceIndices={isMe ? usedDiceIndices : (p.usedDiceIndices ?? [])}
                    isMe={isMe}
                  />
                )}

                {/* Esperando turno */}
                {!hasDice && gamePhase === 'selecting' && !isTheirTurn && !isMe && (p.allDice?.length > 0) && (
                  <Text style={styles.otherWaiting}>esperando turno...</Text>
                )}

                {/* Mi turno — recordatorio */}
                {isMe && isTheirTurn && !hasDice && (
                  <Text style={[styles.otherWaiting, { color: GOLD }]}>¡selecciona 3 dados arriba!</Text>
                )}
              </View>
            );
          })}
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
            <TouchableOpacity style={styles.rollBtn} onPress={() => socketService.rollDice()} activeOpacity={0.85}>
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
  safe:   { flex: 1, backgroundColor: BG, position: 'relative' },
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
  // Otros jugadores — grid expandido
  othersGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  otherCard: {
    width: '47%', backgroundColor: CARD,
    borderRadius: 12, borderWidth: 1, borderColor: BORDER,
    padding: 10,
  },
  otherCardOff:    { opacity: 0.4 },
  otherCardActive: { borderColor: GOLD + '80', backgroundColor: GOLD + '08' },
  otherCardDone:   { borderColor: GREEN + '40' },
  otherCardMe:     { borderColor: PURPLE + '55', backgroundColor: PURPLE + '08' },
  otherCardHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 6,
  },
  otherPlayerName:   { fontSize: 12, fontWeight: '700', color: TEXT, flex: 1 },
  otherPlayerStatus: { fontSize: 14 },
  otherDiceRow:  { flexDirection: 'row', gap: 4, marginBottom: 4 },
  otherDie: {
    width: 30, height: 36, backgroundColor: BG,
    borderRadius: 7, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  otherDieEmoji: { fontSize: 14 },
  otherDieNum:   { fontSize: 8, fontWeight: '800', marginTop: 1 },
  otherHandName: { fontSize: 10, fontWeight: '700', marginTop: 2 },
  otherWaiting:  { fontSize: 9, color: MUTED, fontStyle: 'italic' },
  otherAvailableDice: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4,
  },
  otherDiceGroup: {
    flexDirection: 'row', alignItems: 'center', gap: 1,
    backgroundColor: BG, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2,
  },
  otherDiceGroupEmoji: { fontSize: 12 },
  otherDiceGroupCount: { fontSize: 9, fontWeight: '800' },
  // legado (por si alguna referencia queda)
  otherPlayer:   { flex: 1 },
  otherPlayerOff:{ opacity: 0.4 },

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

  // Botón flotante predicción
  floatingPredBtn: {
    position: 'absolute', bottom: 24, right: 20,
    backgroundColor: PURPLE,
    borderRadius: 24, paddingVertical: 12, paddingHorizontal: 20,
    shadowColor: PURPLE, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6, shadowRadius: 12, elevation: 20,
    zIndex: 100,
  },
  floatingPredBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },

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

  // Bottom Sheet predicción
  bsOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    zIndex: 49,
  },
  bsContainer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    zIndex: 50,
    backgroundColor: CARD,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderColor: PURPLE + '40',
    paddingHorizontal: 20, paddingBottom: 32, paddingTop: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.4, shadowRadius: 20, elevation: 30,
  },
  bsHandleRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', marginBottom: 12, position: 'relative',
  },
  bsHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: BORDER,
  },
  bsCollapseBtn: {
    position: 'absolute', right: 0,
    backgroundColor: PURPLE + '25', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: PURPLE + '50',
  },
  bsCollapseBtnText: { fontSize: 11, fontWeight: '700', color: PURPLE },
  bsCollapsedContent: { alignItems: 'center', paddingVertical: 8, gap: 6 },
  bsCollapsedLabel: { fontSize: 11, color: MUTED },
  bsCollapsedValue: { fontSize: 16, fontWeight: '800' },
  bsCollapsedHint: { fontSize: 12, color: MUTED, fontStyle: 'italic' },
  bsConfirmBtnSmall: {
    backgroundColor: PURPLE, borderRadius: 12,
    paddingVertical: 10, paddingHorizontal: 24, alignItems: 'center', marginTop: 4,
  },
  bsLaunch: {
    fontSize: 10, fontWeight: '800', color: PURPLE,
    letterSpacing: 3, textAlign: 'center', marginBottom: 4,
  },
  bsTitle: {
    fontSize: 20, fontWeight: '900', color: TEXT,
    textAlign: 'center', marginBottom: 2,
  },
  bsSub: {
    fontSize: 12, color: MUTED, textAlign: 'center', marginBottom: 16,
  },
  bsOptions: { gap: 8, marginBottom: 16 },
  bsOption: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: BG, borderRadius: 12, borderWidth: 1.5,
    paddingHorizontal: 14, paddingVertical: 11, gap: 12,
  },
  bsOptionEmoji: { fontSize: 22, width: 28, textAlign: 'center' },
  bsOptionText:  { flex: 1 },
  bsOptionLabel: { fontSize: 14, fontWeight: '700' },
  bsOptionDesc:  { fontSize: 10, color: MUTED, marginTop: 1 },
  bsOptionCheck: {
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  bsOptionCheckText: { fontSize: 10, fontWeight: '900', color: '#000' },
  bsConfirmBtn: {
    backgroundColor: PURPLE, borderRadius: 14,
    paddingVertical: 15, alignItems: 'center',
  },
  bsConfirmBtnDisabled: { backgroundColor: BORDER },
  bsConfirmBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});