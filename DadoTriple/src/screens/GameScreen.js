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
  ScrollView, Animated, Alert, Modal, Easing,
  Dimensions
} from 'react-native';

const SCREEN_HEIGHT = Dimensions.get('window').height;
import { SafeAreaView } from 'react-native-safe-area-context';
import socketService from '../services/socketService';
import { playSound } from '../services/soundService';
import useGameStore from '../store/useGameStore';
import MagicBackground from '../components/MagicBackground';
import GameButton from '../components/GameButton';
import DiceFace from '../components/DiceFace';
import { colors, shadows } from '../theme';
import { 
  Check, X, CheckCircle, 
  TrendingUp, Target, Zap, Shield, 
  Activity
} from 'lucide-react-native';

// ─── Colores ──────────────────────────────────────────────────────────────────
const BG     = colors.bg;
const CARD   = colors.card;
const BORDER = colors.border;
const TEXT   = colors.text;
const MUTED  = colors.muted;
const PURPLE = colors.purple;
const GOLD   = colors.gold;
const GREEN  = colors.green;
const BLUE   = colors.blue;
const RED    = colors.red;

const DICE_VALUES = [1, 2, 3, 4, 5, 6];
const VALUE_COLOR = { 1:'#94A3B8', 2:'#60A5FA', 3:'#34D399', 4:'#FBBF24', 5:'#F87171', 6:'#A78BFA' };
const DICE_FACE = { 1: '⚀', 2: '⚁', 3: '⚂', 4: '⚃', 5: '⚄', 6: '⚅' };

const PREDICTION_OPTIONS = [
  { key: 'high', label: 'Más de 10 pts', mark: 'ALTA',  color: '#F87171', desc: '> 10 puntos', icon: TrendingUp },
  { key: 'mid',  label: '7 a 10 pts',    mark: 'MEDIA', color: GOLD,      desc: '7 – 10 puntos', icon: Target },
  { key: 'low',  label: '1 a 6 pts',     mark: 'BAJA',  color: BLUE,      desc: '1 – 6 puntos',  icon: Activity },
  { key: 'zero', label: 'Exactamente 0', mark: 'CERO',  color: MUTED,     desc: '0 puntos → +40', icon: Zap },
];

function getPhaseLabel(gamePhase, yaPresente) {
  if (gamePhase === 'rolling') return 'Tirar';
  if (gamePhase === 'predicting') return 'Predecir';
  if (yaPresente) return 'Esperando';
  if (gamePhase === 'selecting') return 'Elegir';
  return 'Puntuando';
}

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
    playSound('click', 0.65);
    onPredict(selected);
  };

  if (!mounted) return null;

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
                <View style={[styles.predictionMark, {borderColor: opt.color + '66'}]}>
                  <Text style={[styles.predictionMarkText, {color: opt.color}]}>{opt.mark}</Text>
                </View>
                <View style={styles.predictionText}>
                  <Text style={[styles.predictionLabel, { color: selected === opt.key ? opt.color : TEXT }]}>
                    {opt.label}
                  </Text>
                  <Text style={styles.predictionDesc}>{opt.desc}</Text>
                </View>
                {selected === opt.key && (
                  <View style={[styles.predictionCheck, { backgroundColor: opt.color }]}>
                    <Check size={12} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            ))}
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
                    <View style={styles.bsOptionIcon}>
                      {React.createElement(opt.icon, { size: 20, color: selected === opt.key ? opt.color : MUTED })}
                    </View>
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
                        <Check size={14} color="#fff" />
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
                <View style={styles.btnRow}>
                  {selected && <CheckCircle size={20} color="#fff" style={{ marginRight: 8 }} />}
                  <Text style={styles.bsConfirmBtnText}>
                    {selected ? 'Confirmar predicción' : 'Elige una opción'}
                  </Text>
                </View>
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
                    {React.createElement(PREDICTION_OPTIONS.find(o => o.key === selected)?.icon || Target, { size: 16, color: PREDICTION_OPTIONS.find(o => o.key === selected)?.color, style: {marginRight: 6} })}
                    {PREDICTION_OPTIONS.find(o => o.key === selected)?.label}
                  </Text>
                  <TouchableOpacity
                    style={styles.bsConfirmBtnSmall}
                    onPress={handleConfirm}
                    activeOpacity={0.85}
                  >
                    <View style={styles.btnRow}>
                      <CheckCircle size={14} color="#fff" style={{ marginRight: 4 }} />
                      <Text style={styles.bsConfirmBtnText}>Confirmar</Text>
                    </View>
                  </TouchableOpacity>
                </>
              ) : (
                <Text style={styles.bsCollapsedHint}>Toca "Ver predicción" para elegir</Text>
              )}
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
});

// ─── Badge de predicción activa ───────────────────────────────────────────────
function PredictionBadge({ prediction }) {
  if (!prediction) return null;
  const opt = PREDICTION_OPTIONS.find(o => o.key === prediction);
  if (!opt) return null;
  return (
    <View style={[styles.predBadge, { borderColor: opt.color + '50', backgroundColor: opt.color + '15' }]}>
      <Text style={[styles.predBadgeMark, { color: opt.color }]}>{opt.mark}</Text>
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
function DiceKindBadge({ kind, color }) {
  return (
    <View style={[styles.diceKindBadge, {borderColor: color + '55', backgroundColor: color + '12'}]}>
      <View style={[styles.diceKindDot, {backgroundColor: color}]} />
      <Text style={[styles.diceKindText, {color}]}>{kind}</Text>
    </View>
  );
}

function DiceVisibilityLegend() {
  return (
    <View style={styles.diceLegend}>
      <DiceKindBadge kind="VISIBLE" color={GREEN} />
      <DiceKindBadge kind="OCULTO" color={BLUE} />
    </View>
  );
}

function getOpponentStatus(player, phase) {
  if (player.isConnected === false) {
    return {label: 'Sin conexion', color: MUTED};
  }
  if (phase === 'predicting' && player.hasPredicted) {
    return {label: 'Prediccion lista', color: PURPLE};
  }
  if (phase === 'predicting') {
    return {label: 'Pensando prediccion', color: MUTED};
  }
  if (player.hasSelectedDice) {
    return {label: 'Dados presentados', color: GREEN};
  }
  if (player.hasRolled) {
    return {label: 'Tirada lista', color: GOLD};
  }
  return {label: 'Esperando tirada', color: MUTED};
}

function OpponentStatus({player, phase}) {
  const status = getOpponentStatus(player, phase);
  return (
    <View style={[styles.otherStatusChip, {borderColor: status.color + '55'}]}>
      <View style={[styles.otherStatusDot, {backgroundColor: status.color}]} />
      <Text style={[styles.otherStatusText, {color: status.color}]}>{status.label}</Text>
    </View>
  );
}

function OpponentVisibilityIndicator({player}) {
  if (!player.hasRolled) return null;

  return (
    <View style={styles.otherVisibility}>
      <View style={[styles.otherVisibilityPill, {borderColor: GREEN + '55'}]}>
        <View style={[styles.otherVisibilityDot, {backgroundColor: GREEN}]} />
        <Text style={[styles.otherVisibilityText, {color: GREEN}]}>9 visibles</Text>
      </View>
      <View style={[styles.otherVisibilityPill, {borderColor: BLUE + '55'}]}>
        <View style={[styles.otherVisibilityDot, {backgroundColor: BLUE}]} />
        <Text style={[styles.otherVisibilityText, {color: BLUE}]}>2 ocultos</Text>
      </View>
    </View>
  );
}

function OpponentVisibleDice({player}) {
  const dice = (player.visibleDice ?? []).filter(value => value !== null && value !== undefined);
  if (!dice.length) return null;

  return (
    <View style={styles.otherPresentedDice}>
      <Text style={styles.otherPresentedLabel}>Dados visibles</Text>
      <View style={styles.otherPresentedRow}>
        {dice.map((value, index) => {
          const color = VALUE_COLOR[value] ?? MUTED;
          return (
            <DiceFace
              key={`${player.id}-${index}-${value}`}
              value={value}
              size={18}
              pipColor={color}
              faceColor={CARD}
              borderColor={color + '88'}
            />
          );
        })}
      </View>
    </View>
  );
}

function FallingDie({ value, index, runKey }) {
  const fall = useRef(new Animated.Value(0)).current;
  const color = VALUE_COLOR[value] ?? GOLD;
  const lane = [-96, -46, 8, 58, 104][index % 5];
  const startLane = lane + (index % 2 === 0 ? -70 : 70);

  useEffect(() => {
    fall.stopAnimation();
    fall.setValue(0);
    Animated.sequence([
      Animated.delay(index * 80),
      Animated.timing(fall, {
        toValue: 1,
        duration: 1250,
        easing: Easing.bezier(0.18, 0.72, 0.18, 1),
        useNativeDriver: true,
      }),
    ]).start();
  }, [fall, index, runKey]);

  const translateY = fall.interpolate({
    inputRange: [0, 0.54, 0.68, 0.82, 1],
    outputRange: [-330, 150, 86, 126, 96],
  });
  const translateX = fall.interpolate({
    inputRange: [0, 0.62, 1],
    outputRange: [startLane, lane + (index % 2 ? -16 : 16), lane],
  });
  const rotate = fall.interpolate({
    inputRange: [0, 0.68, 1],
    outputRange: [`${index % 2 ? '-' : ''}620deg`, `${index % 2 ? '-' : ''}80deg`, `${index % 2 ? '-' : ''}14deg`],
  });
  const opacity = fall.interpolate({
    inputRange: [0, 0.06, 0.82, 1],
    outputRange: [0, 1, 1, 0],
  });
  const squash = fall.interpolate({
    inputRange: [0, 0.54, 0.68, 0.82, 1],
    outputRange: [0.74, 1.12, 0.86, 1.03, 0.72],
  });
  const shadowOpacity = fall.interpolate({
    inputRange: [0, 0.36, 0.62, 0.86, 1],
    outputRange: [0, 0.14, 0.38, 0.22, 0],
  });
  const shadowScale = fall.interpolate({
    inputRange: [0, 0.62, 1],
    outputRange: [0.35, 1.24, 0.65],
  });

  return (
    <Animated.View
      style={[
        styles.throwDie,
        {
          opacity,
          transform: [
            {translateX},
            {translateY},
            {rotate},
            {scale: squash},
          ],
        },
      ]}>
      <Animated.View
        style={[
          styles.throwDieShadow,
          {
            opacity: shadowOpacity,
            transform: [{scaleX: shadowScale}],
          },
        ]}
      />
      <DiceFace
        value={value}
        size={54}
        pipColor={color}
        faceColor={colors.white}
        borderColor={color}
      />
    </Animated.View>
  );
}

function DiceThrowAnimation({ visible, runKey }) {
  const table = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    table.setValue(0);
    Animated.sequence([
      Animated.timing(table, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.delay(1450),
      Animated.timing(table, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }),
    ]).start();
  }, [runKey, table, visible]);

  if (!visible) return null;

  const tableScale = table.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1],
  });

  return (
    <View pointerEvents="none" style={styles.throwOverlay}>
      <Animated.View style={[styles.throwTable, {opacity: table, transform: [{scale: tableScale}]}]}>
        <View style={styles.throwTableSurface} />
        <View style={styles.throwTableLip} />
      </Animated.View>
      {[5, 2, 6, 1, 4].map((value, index) => (
        <FallingDie key={`${runKey}-${index}`} value={value} index={index} runKey={runKey} />
      ))}
      <Animated.Text style={[styles.throwText, {opacity: table}]}>TIRANDO</Animated.Text>
    </View>
  );
}

function Die({ value, index, selected, used, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;
  const lift = useRef(new Animated.Value(selected ? 1 : 0)).current;
  const roll = useRef(new Animated.Value(0)).current;
  const rollScale = useRef(new Animated.Value(1)).current;
  const color = VALUE_COLOR[value] ?? MUTED;

  useEffect(() => {
    Animated.spring(lift, {
      toValue: selected ? 1 : 0,
      useNativeDriver: true,
      speed: 24,
      bounciness: 8,
    }).start();
  }, [lift, selected]);

  const translateY = lift.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -7],
  });

  useEffect(() => {
    roll.stopAnimation();
    roll.setValue(0);
    rollScale.setValue(0.72);

    Animated.parallel([
      Animated.timing(roll, {
        toValue: 1,
        duration: 620 + index * 28,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.spring(rollScale, {
          toValue: 1.18,
          useNativeDriver: true,
          speed: 34,
          bounciness: 12,
        }),
        Animated.spring(rollScale, {
          toValue: 1,
          useNativeDriver: true,
          speed: 28,
          bounciness: 8,
        }),
      ]),
    ]).start();
  }, [index, roll, rollScale, value]);

  const rollHop = roll.interpolate({
    inputRange: [0, 0.45, 1],
    outputRange: [-18, 10, 0],
  });
  const rollRotate = roll.interpolate({
    inputRange: [0, 1],
    outputRange: [`${index % 2 === 0 ? '' : '-'}280deg`, '0deg'],
  });

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
        { transform: [{ translateY: rollHop }, { translateY }, { rotate: rollRotate }, { scale: rollScale }, { scale }] },
      ]}>
        <DiceFace
          value={value}
          size={34}
          pipColor={used ? MUTED : color}
          faceColor={used ? BORDER + '35' : colors.cardRaised}
          borderColor={used ? BORDER : color + '88'}
          muted={used}
        />
        {selected && (
          <View style={styles.selectedBadge}>
            <Check size={10} color="#fff" />
          </View>
        )}
        {used && (
          <View style={styles.usedOverlay}>
            <X size={16} color={MUTED} />
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
  const lift = useRef(new Animated.Value(selected ? 1 : 0)).current;
  const reveal = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (value || !canSelect) return;
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.06, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, [value, canSelect]);

  useEffect(() => {
    Animated.spring(lift, {
      toValue: selected ? 1 : 0,
      useNativeDriver: true,
      speed: 24,
      bounciness: 8,
    }).start();
  }, [lift, selected]);

  useEffect(() => {
    if (!value) {
      reveal.setValue(1);
      return;
    }
    reveal.setValue(0);
    Animated.spring(reveal, {
      toValue: 1,
      useNativeDriver: true,
      tension: 70,
      friction: 7,
    }).start();
  }, [reveal, value]);

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
  const translateY = lift.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -8],
  });
  const revealScale = reveal.interpolate({
    inputRange: [0, 1],
    outputRange: [0.65, 1],
  });
  const revealRotate = reveal.interpolate({
    inputRange: [0, 1],
    outputRange: [`${color === 'blue' ? '' : '-'}220deg`, '0deg'],
  });
  const currentScale = value ? scale : pulse;

  return (
    <TouchableOpacity onPress={handlePress} disabled={!canSelect || used} activeOpacity={0.8}>
      <Animated.View style={[
        styles.hiddenDie,
        { borderColor: selected ? GOLD : borderColor,
          backgroundColor: selected ? GOLD + '18' : bgColor,
          transform: [{ translateY }, { rotate: revealRotate }, { scale: revealScale }, { scale: currentScale }] },
        selected && { shadowColor: GOLD, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 8, elevation: 6 },
        used && { opacity: 0.4 },
      ]}>
        {value ? (
          <>
            <DiceFace
              value={value}
              size={46}
              pipColor={selected ? GOLD : borderColor}
              faceColor={selected ? GOLD + '18' : CARD}
              borderColor={selected ? GOLD : borderColor + 'AA'}
            />
          </>
        ) : (
          <DiceFace
            hidden
            size={46}
            pipColor={borderColor}
            faceColor={CARD}
            borderColor={borderColor}
          />
        )}
        <Text style={[styles.hiddenDieLabel, { color: (selected ? GOLD : borderColor) + 'AA' }]}>{label}</Text>
        {selected && (
          <View style={styles.selectedBadge}>
            <Check size={12} color="#fff" />
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
            <Shield size={16} color={BLUE} />
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
            <Shield size={16} color={RED} />
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
  const [throwVisible, setThrowVisible]   = useState(false);
  const [throwKey, setThrowKey]           = useState(0);
  const countdownRef = useRef(null);
  const throwTimerRef = useRef(null);
  const [sheetCollapsed, setSheetCollapsed] = useState(false);
  const predictionSheetRef = useRef(null);

  const headerAnim = useRef(new Animated.Value(0)).current;
  const diceBoardAnim = useRef(new Animated.Value(0)).current;

  // Resetear estado local cuando cambia la ronda
  useEffect(() => {
    setPresenting(false);
    setWaitingOthers(false);
    Animated.timing(headerAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, [roundNumber]);

  useEffect(() => {
    if (allDice.length === 0) {
      diceBoardAnim.setValue(0);
      return;
    }
    Animated.spring(diceBoardAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 70,
      friction: 8,
    }).start();
  }, [allDice.length, diceBoardAnim]);

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

  useEffect(() => () => {
    if (throwTimerRef.current) clearTimeout(throwTimerRef.current);
  }, []);

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

  const handleRollDice = () => {
    if (throwVisible) return;
    if (throwTimerRef.current) clearTimeout(throwTimerRef.current);
    setThrowKey(k => k + 1);
    setThrowVisible(true);
    playSound('diceRoll', 0.9);
    socketService.rollDice();
    throwTimerRef.current = setTimeout(() => {
      setThrowVisible(false);
    }, 1900);
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
      <MagicBackground intensity={0.7} />

      {/* Modal de predicción */}
      <PredictionModal
        ref={predictionSheetRef}
        visible={gamePhase === 'predicting' && !hasPredicted}
        launchNumber={launchNumber}
        onPredict={handlePredict}
        onCollapseChange={setSheetCollapsed}
      />
      <DiceThrowAnimation visible={throwVisible} runKey={throwKey} />

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
              {getPhaseLabel(gamePhase, yaPresente)}
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
            <Text style={styles.waitingText}>Esperando que los demás predigan...</Text>
          </View>
        )}

        {/* ── Indicador de turno ── */}
        {gamePhase === 'selecting' && currentTurnPlayerId && (
          <View style={[
            styles.turnIndicator,
            isMyTurn ? styles.turnIndicatorMe : styles.turnIndicatorOther,
          ]}>
            <View style={[
              styles.turnIndicatorMark,
              isMyTurn ? styles.turnIndicatorMarkMe : styles.turnIndicatorMarkOther,
            ]} />
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
          <Animated.View
            style={[
              styles.section,
              {
                opacity: diceBoardAnim,
                transform: [
                  {
                    translateY: diceBoardAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [22, 0],
                    }),
                  },
                ],
              },
            ]}>
            <Text style={styles.sectionLabel}>
              DADOS DISPONIBLES
              {canSelect ? `  —  ${selectedDiceIndices.length}/3 seleccionados` : ''}
            </Text>
            <DiceVisibilityLegend />
            <View style={styles.columnsContainer}>
              {DICE_VALUES.map(val => (
                <View key={val} style={styles.column}>
                  <View style={[styles.columnHeader, { borderColor: VALUE_COLOR[val] + '50' }]}>
                    <DiceFace
                      value={val}
                      size={28}
                      pipColor={VALUE_COLOR[val]}
                      faceColor={CARD}
                      borderColor={VALUE_COLOR[val] + '70'}
                    />
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
          </Animated.View>
        )}

        {/* ── Dados ocultos ── */}
        {allDice.length > 0 && (
          <Animated.View
            style={[
              styles.hiddenSection,
              {
                opacity: diceBoardAnim,
                transform: [
                  {
                    scale: diceBoardAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.96, 1],
                    }),
                  },
                ],
              },
            ]}>
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
                <Text style={styles.bonusTagText}>Bonus: dados iguales +{hiddenDice[0] * 2} pts</Text>
              </View>
            )}
          </Animated.View>
        )}

        {/* ── Preview seleccionados ── */}
        {selectedDiceIndices.length > 0 && !yaPresente && (
          <View style={styles.selectedPreview}>
            <Text style={styles.sectionLabel}>PRESENTANDO</Text>
            <View style={styles.selectedRow}>
              {selectedDiceIndices.map(i => (
                <View key={i} style={styles.selectedPreviewDie}>
                  <DiceFace
                    value={allDice[i]}
                    size={38}
                    pipColor={VALUE_COLOR[allDice[i]]}
                    faceColor={GOLD + '12'}
                    borderColor={GOLD + '70'}
                  />
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
            <GameButton
              style={[styles.rollBtn, throwVisible && styles.rollBtnDisabled]}
              onPress={handleRollDice}
              disabled={throwVisible}
              sound={null}
            >
              <Text style={styles.rollBtnText}>
                {throwVisible ? 'Rodando...' : 'Tirar dados'}
              </Text>
            </GameButton>
          )}

          {/* Esperando que otros tiren */}
          {gamePhase === 'rolling' && allDice.length > 0 && (
            <View style={styles.waitingBox}>
              <Text style={styles.waitingText}>Esperando que otros tiren...</Text>
            </View>
          )}

          {/* Presentar */}
          {canSelect && (
            <GameButton
              style={[styles.presentBtn, selectedDiceIndices.length !== 3 && styles.presentBtnDisabled]}
              onPress={handlePresent}
              disabled={selectedDiceIndices.length !== 3}
              sound={null}
            >
              <Text style={styles.presentBtnText}>
                {selectedDiceIndices.length === 3
                  ? 'Presentar dados'
                  : `Selecciona ${3 - selectedDiceIndices.length} dado${3 - selectedDiceIndices.length !== 1 ? 's' : ''} más`}
              </Text>
            </GameButton>
          )}

          {/* Ya presentó */}
          {yaPresente && gamePhase === 'selecting' && (
            <View style={styles.waitingBox}>
              <Text style={styles.waitingText}>Esperando que los demás presenten...</Text>
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
  root:   { flex: 1, backgroundColor: 'transparent' },
  scroll: { paddingHorizontal: 12, paddingTop: 8 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: CARD, borderRadius: 16,
    borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 16, paddingVertical: 12, marginBottom: 10,
    ...shadows.purple,
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
  predBadgeMark: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
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
  otherPlayerOff:    { opacity: 0.4 },
  otherPlayerName:   { fontSize: 11, fontWeight: '700', color: TEXT, marginBottom: 2 },
  otherPlayerStatus: { display: 'none' },
  otherStatusChip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, borderWidth: 1, borderRadius: 999,
    paddingHorizontal: 7, paddingVertical: 4,
    marginTop: 4, backgroundColor: BG + '66',
    width: '100%',
  },
  otherStatusDot: { width: 5, height: 5, borderRadius: 3 },
  otherStatusText: { fontSize: 9, fontWeight: '900', textAlign: 'center' },
  otherVisibility: {
    width: '100%', flexDirection: 'row', gap: 4, marginTop: 6,
  },
  otherVisibilityPill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, borderWidth: 1, borderRadius: 7,
    paddingHorizontal: 4, paddingVertical: 4,
    backgroundColor: BG + '66',
  },
  otherVisibilityDot: { width: 5, height: 5, borderRadius: 3 },
  otherVisibilityText: { fontSize: 8, fontWeight: '900', textAlign: 'center' },
  otherPresentedDice: {
    width: '100%', marginTop: 7, alignItems: 'center', gap: 4,
  },
  otherPresentedLabel: {
    color: MUTED, fontSize: 8, fontWeight: '800', letterSpacing: 0.8,
  },
  otherPresentedRow: {
    flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 4,
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
  diceLegend: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  diceKindBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 999, borderWidth: 1,
    paddingHorizontal: 9, paddingVertical: 5,
  },
  diceKindDot: { width: 6, height: 6, borderRadius: 3 },
  diceKindText: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },

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
    ...shadows.gold,
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
    ...shadows.purple,
  },
  rollBtnDisabled: {
    opacity: 0.72,
  },
  rollBtnText: { fontSize: 18, fontWeight: '700', color: '#fff' },
  presentBtn: {
    backgroundColor: GREEN, borderRadius: 16, paddingVertical: 18, alignItems: 'center',
    ...shadows.green,
  },
  presentBtnDisabled: { backgroundColor: CARD, shadowOpacity: 0 },
  presentBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  waitingBox: {
    backgroundColor: CARD, borderRadius: 14, padding: 16,
    alignItems: 'center', borderWidth: 1, borderColor: BORDER,
  },
  waitingText: { color: MUTED, fontSize: 14, fontWeight: '500' },

  // Tirada sobre mesa
  throwOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  throwTable: {
    position: 'absolute',
    width: 260,
    height: 112,
    top: '47%',
    borderRadius: 26,
    backgroundColor: '#182431',
    borderWidth: 1.5,
    borderColor: GOLD + '55',
    ...shadows.gold,
  },
  throwTableSurface: {
    flex: 1,
    margin: 10,
    borderRadius: 18,
    backgroundColor: '#122D2E',
    borderWidth: 1,
    borderColor: GREEN + '45',
  },
  throwTableLip: {
    height: 10,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    backgroundColor: GOLD + '55',
  },
  throwDie: {
    position: 'absolute',
    top: '26%',
  },
  throwDieShadow: {
    position: 'absolute',
    width: 42,
    height: 12,
    borderRadius: 999,
    backgroundColor: '#000000',
    top: 60,
    left: 6,
  },
  throwText: {
    position: 'absolute',
    top: '64%',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 3,
    color: GOLD,
  },
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
  turnIndicatorMark: { width: 13, height: 30, borderRadius: 999 },
  turnIndicatorMarkMe: { backgroundColor: GOLD },
  turnIndicatorMarkOther: { backgroundColor: MUTED },
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
    backgroundColor: BG, borderRadius: 14, borderWidth: 1.5,
    padding: 14, gap: 12,
  },
  predictionMark: {
    width: 48, height: 28, borderRadius: 9, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', backgroundColor: CARD,
  },
  predictionMarkText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  predictionText:  { flex: 1 },
  predictionLabel: { fontSize: 15, fontWeight: '700' },
  predictionDesc:  { fontSize: 11, color: MUTED, marginTop: 2 },
  predictionCheck: {
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  bsOptionCheckText: { fontSize: 10, fontWeight: '900', color: '#000' },
  bsConfirmBtn: {
    backgroundColor: PURPLE, borderRadius: 14,
    paddingVertical: 15, alignItems: 'center',
  },
  bsConfirmBtnDisabled: { backgroundColor: BORDER },
  bsConfirmBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  btnRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  bsOptionIcon: { width: 32, alignItems: 'center', justifyContent: 'center' },
});
