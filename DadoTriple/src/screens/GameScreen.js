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
  ScrollView, Animated, Alert, Dimensions, Easing,
} from 'react-native';

const SCREEN_HEIGHT = Dimensions.get('window').height;
import { SafeAreaView } from 'react-native-safe-area-context';
import socketService from '../services/socketService';
import { playSound } from '../services/soundService';
import useGameStore from '../store/useGameStore';
import MagicBackground from '../components/MagicBackground';
import GameButton from '../components/GameButton';
import DiceFace from '../components/DiceFace';
import {colors, shadows} from '../theme';
import { green } from 'react-native-reanimated/lib/typescript/reanimated2/Colors';

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

const PREDICTION_OPTIONS = [
  { key: 'high', label: 'Más de 10 pts', mark: 'ALTA',  color: '#F87171', desc: '> 10 puntos' },
  { key: 'mid',  label: '7 a 10 pts',    mark: 'MEDIA', color: GOLD,      desc: '7 – 10 puntos' },
  { key: 'low',  label: '1 a 6 pts',     mark: 'BAJA',  color: BLUE,      desc: '1 – 6 puntos' },
  { key: 'zero', label: 'Exactamente 0', mark: 'CERO',  color: MUTED,     desc: '0 puntos → +40 bonus' },
];

function getPhaseLabel(gamePhase, yaPresente) {
  if (gamePhase === 'rolling') return 'Tirar';
  if (gamePhase === 'predicting') return 'Predecir';
  if (yaPresente) return 'Esperando';
  if (gamePhase === 'selecting') return 'Elegir';
  return 'Puntuando';
}

// ─── Bottom Sheet de Predicción ──────────────────────────────────────────────
const PredictionModal = forwardRef(function PredictionModal(
  { visible, launchNumber, onPredict, onCollapseChange }, ref
) {
  const translateY     = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const [selected,  setSelected]  = useState(null);
  const [mounted,   setMounted]   = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const COLLAPSED_Y = SCREEN_HEIGHT * 0.82;

  const animateTo = (toValue) =>
    Animated.spring(translateY, { toValue, useNativeDriver: true, tension: 65, friction: 11 }).start();

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
        Animated.timing(translateY, { toValue: SCREEN_HEIGHT, duration: 280, useNativeDriver: true }),
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

  useImperativeHandle(ref, () => ({ expand: handleExpand }));

  const handleConfirm = () => {
    if (!selected) return;
    playSound('click', 0.65);
    onPredict(selected);
  };

  if (!mounted) return null;

  return (
    <>
      <Animated.View style={[styles.bsOverlay, { opacity: overlayOpacity }]} pointerEvents="none" />
      <Animated.View style={[styles.bsContainer, { transform: [{ translateY }] }]}>
        {/* Handle + botón colapsar */}
        <View style={styles.bsHandleRow}>
          <View style={styles.bsHandle} />
          <TouchableOpacity
            style={styles.bsCollapseBtn}
            onPress={collapsed ? handleExpand : handleCollapse}
            activeOpacity={0.7}
          >
            <Text style={styles.bsCollapseBtnText}>
              {collapsed ? 'Ver prediccion' : 'Ver dados'}
            </Text>
          </TouchableOpacity>
        </View>

        {!collapsed && (
          <>
            <Text style={styles.bsLaunch}>LANZAMIENTO {launchNumber}</Text>
            <Text style={styles.bsTitle}>Cuantos puntos obtendrás?</Text>
            <Text style={styles.bsSub}>Mira tus dados y predice</Text>

            <View style={styles.bsOptions}>
              {PREDICTION_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    styles.bsOption,
                    { borderColor: opt.color + '40' },
                    selected === opt.key && { backgroundColor: opt.color + '20', borderColor: opt.color },
                  ]}
                  onPress={() => { playSound('click', 0.45); setSelected(opt.key); }}
                  activeOpacity={0.8}
                >
                  <View style={[styles.predictionMark, { borderColor: opt.color + '66' }]}>
                    <Text style={[styles.predictionMarkText, { color: opt.color }]}>{opt.mark}</Text>
                  </View>
                  <View style={styles.bsOptionText}>
                    <Text style={[styles.bsOptionLabel, { color: selected === opt.key ? opt.color : TEXT }]}>
                      {opt.label}
                    </Text>
                    <Text style={styles.bsOptionDesc}>{opt.desc}</Text>
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
                {selected ? 'Confirmar prediccion' : 'Elige una opcion'}
              </Text>
            </TouchableOpacity>
          </>
        )}

        {collapsed && (
          <View style={styles.bsCollapsedContent}>
            {selected ? (
              <>
                <Text style={styles.bsCollapsedLabel}>Tu prediccion:</Text>
                <Text style={[styles.bsCollapsedValue, {
                  color: PREDICTION_OPTIONS.find(o => o.key === selected)?.color ?? TEXT
                }]}>
                  {PREDICTION_OPTIONS.find(o => o.key === selected)?.mark}{' '}
                  {PREDICTION_OPTIONS.find(o => o.key === selected)?.label}
                </Text>
                <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm} activeOpacity={0.85}>
                  <Text style={styles.confirmBtnText}>Confirmar</Text>
                </TouchableOpacity>
              </>
            ) : (
              <Text style={styles.bsCollapsedHint}>Toca "Ver prediccion" para elegir</Text>
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
            <Text style={styles.selectedBadgeText}>✓</Text>
          </View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Modal de confirmación de presentación ────────────────────────────────────
function ConfirmPresentModal({ visible, values, indices, onConfirm, onCancel }) {
  const translateY = useRef(new Animated.Value(400)).current;
  const overlay    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }),
        Animated.timing(overlay,    { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: 400, duration: 220, useNativeDriver: true }),
        Animated.timing(overlay,    { toValue: 0,   duration: 220, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!visible && !values) return null;

  const vals = values ?? [];

  // Evaluar la mano para mostrar en el preview
  const HAND_RANK = { TRIO: 3, ESCALERA: 2, PAR: 1, NADA: 0 };
  function evalHand(dice) {
    if (dice.length !== 3) return null;
    const sorted = [...dice].sort((a, b) => a - b);
    const counts = {};
    for (const d of sorted) counts[d] = (counts[d] || 0) + 1;
    const entries = Object.entries(counts);
    if (entries.some(([, c]) => c === 3)) return `Trio de ${sorted[0]}`;
    if (sorted[1] === sorted[0]+1 && sorted[2] === sorted[1]+1) return `Escalera ${sorted.join('-')}`;
    if (entries.some(([, c]) => c === 2)) {
      const parVal = entries.find(([, c]) => c === 2)[0];
      return `Par de ${parVal}`;
    }
    return `Nada (${sorted.join('-')})`;
  }

  const handName = vals.length === 3 ? evalHand(vals) : null;
  const handColor =
    handName?.startsWith('Trio')     ? '#A78BFA' :
    handName?.startsWith('Escalera') ? '#34D399' :
    handName?.startsWith('Par')      ? '#60A5FA' : '#64748B';

  return (
    <>
      {/* Overlay */}
      <Animated.View
        style={[styles.confirmOverlay, { opacity: overlay }]}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        <TouchableOpacity style={{ flex: 1 }} onPress={onCancel} activeOpacity={1} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View style={[styles.confirmSheet, { transform: [{ translateY }] }]}>
        <View style={styles.confirmHandle} />

        <Text style={styles.confirmTitle}>Confirmar presentacion</Text>
        <Text style={styles.confirmSub}>Estos 3 dados seran presentados a todos</Text>

        {/* Preview de dados */}
        <View style={styles.confirmDiceRow}>
          {vals.map((val, i) => {
            const isHidden  = indices ? indices[i] >= 9 : false;
            const hiddenColor = indices && indices[i] === 9 ? '#3B82F6' : '#EF4444';
            const dieColor  = isHidden ? hiddenColor : (VALUE_COLOR[val] ?? '#64748B');
            return (
              <View key={i} style={styles.confirmDieWrap}>
                <DiceFace
                  value={val}
                  size={52}
                  pipColor={dieColor}
                  faceColor={'#1A1A2E'}
                  borderColor={dieColor + '99'}
                />
                <Text style={[styles.confirmDieNum, { color: dieColor }]}>
                  {isHidden ? (indices[i] === 9 ? 'Azul' : 'Rojo') : val}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Nombre de la mano */}
        {handName && (
          <View style={[styles.confirmHandBadge, { borderColor: handColor + '55', backgroundColor: handColor + '15' }]}>
            <Text style={[styles.confirmHandText, { color: handColor }]}>{handName}</Text>
          </View>
        )}

        {/* Botones */}
        <View style={styles.confirmBtns}>
          <TouchableOpacity style={styles.confirmCancelBtn} onPress={onCancel} activeOpacity={0.8}>
            <Text style={styles.confirmCancelText}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.confirmOkBtn} onPress={onConfirm} activeOpacity={0.85}>
            <Text style={styles.confirmOkText}>Presentar</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </>
  );
}

// ─── Dados disponibles de otro jugador ────────────────────────────────────────
function OtherAvailableDice({ allDice, usedDiceIndices }) {
  const visibleDice = allDice.slice(0, 9);
  const diceByValue = {};
  visibleDice.forEach((val, i) => {
    if (usedDiceIndices.includes(i) || val === null) return;
    diceByValue[val] = (diceByValue[val] ?? 0) + 1;
  });
  const hidden0Used = usedDiceIndices.includes(9);
  const hidden1Used = usedDiceIndices.includes(10);
  const groups = Object.entries(diceByValue).sort((a, b) => Number(a[0]) - Number(b[0]));

  return (
    <View style={styles.otherAvailableRow}>
      {groups.map(([val, count]) => (
        <View key={val} style={styles.otherAvailableChip}>
          <DiceFace value={Number(val)} size={14} pipColor={VALUE_COLOR[Number(val)] ?? MUTED} faceColor={CARD} borderColor={(VALUE_COLOR[Number(val)] ?? MUTED) + '60'} />
          <Text style={[styles.otherAvailableCount, { color: VALUE_COLOR[Number(val)] ?? MUTED }]}>x{count}</Text>
        </View>
      ))}
      {!hidden0Used && (
        <View style={[styles.otherAvailableChip, { borderColor: BLUE + '50', backgroundColor: BLUE + '12' }]}>
          <Text style={[styles.otherAvailableCount, { color: BLUE }]}>Azul</Text>
        </View>
      )}
      {!hidden1Used && (
        <View style={[styles.otherAvailableChip, { borderColor: RED + '50', backgroundColor: RED + '12' }]}>
          <Text style={[styles.otherAvailableCount, { color: RED }]}>Rojo</Text>
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

  const [presenting, setPresenting]         = useState(false);
  const [waitingOthers, setWaitingOthers]   = useState(false);
  const [turnCountdown, setTurnCountdown]   = useState(30);
  const [throwVisible, setThrowVisible]     = useState(false);
  const [throwKey, setThrowKey]             = useState(0);
  const [sheetCollapsed, setSheetCollapsed]     = useState(false);
  const [confirmVisible, setConfirmVisible]     = useState(false);
  const [pendingPresent, setPendingPresent]     = useState(null); // {indices, values}
  const countdownRef       = useRef(null);
  const throwTimerRef      = useRef(null);
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
    if (selectedDiceIndices.length !== 3) return;
    const values = selectedDiceIndices.map(i => allDice[i]);
    setPendingPresent({ indices: selectedDiceIndices, values });
    setConfirmVisible(true);
  };

  const confirmPresent = () => {
    if (!pendingPresent) return;
    playSound('click', 0.7);
    setConfirmVisible(false);
    setPresenting(true);
    setWaitingOthers(true);
    markDiceAsUsed(pendingPresent.indices);
    socketService.selectDice(pendingPresent.indices);
    setPendingPresent(null);
  };

  const cancelPresent = () => {
    setConfirmVisible(false);
    setPendingPresent(null);
  };

  // Número de ronda dentro del lanzamiento (1, 2 o 3)
  const roundInLaunch = ((roundNumber - 1) % 3) + 1;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <MagicBackground intensity={0.7} />

      {/* Bottom sheet de prediccion */}
      <PredictionModal
        ref={predictionSheetRef}
        visible={gamePhase === 'predicting' && !hasPredicted}
        launchNumber={launchNumber}
        onPredict={handlePredict}
        onCollapseChange={setSheetCollapsed}
      />

      {/* Boton flotante cuando el sheet esta colapsado */}
      {gamePhase === 'predicting' && !hasPredicted && sheetCollapsed && (
        <TouchableOpacity
          style={styles.floatingPredBtn}
          onPress={() => predictionSheetRef.current?.expand()}
          activeOpacity={0.85}
        >
          <Text style={styles.floatingPredBtnText}>Predecir</Text>
        </TouchableOpacity>
      )}

      <DiceThrowAnimation visible={throwVisible} runKey={throwKey} />

      {/* Modal de confirmacion de presentacion */}
      <ConfirmPresentModal
        visible={confirmVisible}
        values={pendingPresent?.values}
        indices={pendingPresent?.indices}
        onConfirm={confirmPresent}
        onCancel={cancelPresent}
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

        {/* ── Grid de todos los jugadores (incluye al propio) ── */}
        <View style={styles.othersGrid}>
          {players.map((p) => {
            const isMe        = p.id === playerId;
            const isTheirTurn = p.id === currentTurnPlayerId && gamePhase === 'selecting';
            const presented   = isMe
              ? (myPlayer?.hasSelectedDice ? (p.presentedDice ?? []) : [])
              : (p.presentedDice ?? []);
            const hasDice     = presented.length > 0;

            // Dados propios: usar allDice del store (más fresco que el de players)
            const diceSource    = isMe ? allDice : (p.allDice ?? []);
            const usedSource    = isMe ? usedDiceIndices : (p.usedDiceIndices ?? []);

            return (
              <View key={p.id} style={[
                styles.otherCard,
                isMe           && styles.otherCardMe,
                !p.isConnected && styles.otherCardOff,
                isTheirTurn    && styles.otherCardActive,
                hasDice        && styles.otherCardDone,
              ]}>
                {/* Nombre del jugador */}
                <View style={[styles.otherCardHeader, { flexDirection: 'column' }]}>
                  {isMe ? 
                    <Text style={[styles.otherCardName, isMe && { color: PURPLE }]} numberOfLines={1}>
                      {p.name}{isMe ? ' (yo)' : ''}
                    </Text> : 
                    <Text style={[styles.otherPlayerName, { color: GOLD }]} numberOfLines={1}>{p.name}</Text>
                  }
                  {!isMe && <OpponentStatus player={p} phase={gamePhase} />}
                  {isMe && isTheirTurn && (
                    <View style={[styles.otherStatusChip, { borderColor: GOLD + '55' }]}>
                      <View style={[styles.otherStatusDot, { backgroundColor: GOLD }]} />
                      <Text style={[styles.otherStatusText, { color: GOLD }]}>Tu turno</Text>
                    </View>
                  )}
                </View>

                {/* Dados presentados */}
                {hasDice && (
                  <>
                    <View style={styles.otherPresentedRow2}>
                      {presented.map((val, di) => {
                        const isHidden = val === null;
                        const color    = isHidden ? MUTED : (VALUE_COLOR[val] ?? MUTED);
                        return (
                          <DiceFace
                            key={di}
                            value={isHidden ? null : val}
                            hidden={isHidden}
                            size={24}
                            pipColor={color}
                            faceColor={CARD}
                            borderColor={color + '88'}
                          />
                        );
                      })}
                    </View>
                    {p.hand && !presented.includes(null) && (
                      <Text style={[styles.otherHandName, {
                        color: p.hand.name?.startsWith('Trio')     ? '#A78BFA'
                             : p.hand.name?.startsWith('Escalera') ? '#34D399'
                             : p.hand.name?.startsWith('Par')      ? '#60A5FA'
                             : MUTED,
                      }]} numberOfLines={1}>
                        {p.hand.name}
                      </Text>
                    )}
                  </>
                )}

                {/* Dados disponibles */}
                {!hasDice && (gamePhase === 'predicting' || gamePhase === 'selecting') && diceSource.length > 0 && (
                  <OtherAvailableDice allDice={diceSource} usedDiceIndices={usedSource} />
                )}

                {/* Indicador turno activo */}
                {isTheirTurn && !hasDice && !isMe && (
                  <Text style={styles.otherTurnLabel}>Seleccionando...</Text>
                )}
                {isMe && isTheirTurn && !hasDice && (
                  <Text style={[styles.otherTurnLabel, { color: GOLD }]}>Selecciona 3 dados arriba</Text>
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
  safe:   { flex: 1, backgroundColor: BG, position: 'relative' },
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
  otherPlayer: {
    flex: 1, backgroundColor: CARD, borderRadius: 10,
    borderWidth: 1, borderColor: BORDER,
    paddingVertical: 8, paddingHorizontal: 6, alignItems: 'center',
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

  // Otros jugadores grid
  othersGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  otherCard: {
    width: '47%', backgroundColor: CARD,
    borderRadius: 12, borderWidth: 1, borderColor: BORDER, padding: 10,
  },
  otherCardOff:    { opacity: 0.4 },
  otherCardActive: { borderColor: GOLD + '80', backgroundColor: GOLD + '08' },
  otherCardDone:   { borderColor: GREEN + '40' },
  otherCardHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 6,
  },
  otherCardName:   { fontSize: 12, fontWeight: '700', color: TEXT, flex: 1 },
  otherPresentedRow2: { flexDirection: 'row', gap: 4, marginBottom: 4, flexWrap: 'wrap' },
  otherHandName:   { fontSize: 10, fontWeight: '700', color: MUTED, marginTop: 2 },
  otherTurnLabel:  { fontSize: 9, color: GOLD, fontStyle: 'italic', marginTop: 4 },

  // Dados disponibles otros jugadores
  otherAvailableRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  otherAvailableChip: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: CARD, borderRadius: 6, borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 5, paddingVertical: 2,
  },
  otherAvailableCount: { fontSize: 9, fontWeight: '800' },

  // Bottom sheet prediccion
  bsOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    zIndex: 49,
  },
  bsContainer: {
    position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 50,
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
  bsHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: BORDER },
  bsCollapseBtn: {
    position: 'absolute', right: 0,
    backgroundColor: PURPLE + '25', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: PURPLE + '50',
  },
  bsCollapseBtnText: { fontSize: 11, fontWeight: '700', color: PURPLE },
  bsLaunch: {
    fontSize: 10, fontWeight: '800', color: PURPLE,
    letterSpacing: 3, textAlign: 'center', marginBottom: 4,
  },
  bsTitle: { fontSize: 20, fontWeight: '900', color: TEXT, textAlign: 'center', marginBottom: 2 },
  bsSub:   { fontSize: 12, color: MUTED, textAlign: 'center', marginBottom: 16 },
  bsOptions: { gap: 8, marginBottom: 16 },
  bsOption: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: BG, borderRadius: 12, borderWidth: 1.5,
    paddingHorizontal: 14, paddingVertical: 11, gap: 10,
  },
  bsOptionText:  { flex: 1 },
  bsOptionLabel: { fontSize: 14, fontWeight: '700' },
  bsOptionDesc:  { fontSize: 10, color: MUTED, marginTop: 1 },
  bsCollapsedContent: { alignItems: 'center', paddingVertical: 8, gap: 6 },
  bsCollapsedLabel:   { fontSize: 11, color: MUTED },
  bsCollapsedValue:   { fontSize: 16, fontWeight: '800' },
  bsCollapsedHint:    { fontSize: 12, color: MUTED, fontStyle: 'italic' },

  // Tarjeta propia en grid
  otherCardMe: {
    borderColor: PURPLE + '55',
    backgroundColor: PURPLE + '08',
  },

  // Modal de confirmacion de presentacion
  confirmOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000CC',
    zIndex: 60,
  },
  confirmSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 61,
    backgroundColor: CARD,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderColor: GREEN + '40',
    paddingHorizontal: 24, paddingBottom: 36, paddingTop: 14,
    shadowColor: GREEN, shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.3, shadowRadius: 20, elevation: 35,
  },
  confirmHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: BORDER, alignSelf: 'center', marginBottom: 20,
  },
  confirmTitle: {
    fontSize: 20, fontWeight: '900', color: TEXT,
    textAlign: 'center', marginBottom: 4,
  },
  confirmSub: {
    fontSize: 12, color: MUTED, textAlign: 'center', marginBottom: 24,
  },
  confirmDiceRow: {
    flexDirection: 'row', justifyContent: 'center', gap: 16, marginBottom: 24,
  },
  confirmDie: {
    alignItems: 'center', borderRadius: 16, borderWidth: 1.5,
    padding: 10, gap: 6,
  },
  confirmDieTag: {
    fontSize: 9, fontWeight: '800', letterSpacing: 1,
  },
  confirmDivider: {
    height: 1, backgroundColor: BORDER, marginBottom: 20,
  },
  confirmBtns: {
    flexDirection: 'row', gap: 12,
  },
  confirmCancelBtn: {
    flex: 1, paddingVertical: 16, borderRadius: 14,
    backgroundColor: BORDER + '50', borderWidth: 1, borderColor: BORDER,
    alignItems: 'center',
  },
  confirmCancelText: { fontSize: 15, fontWeight: '700', color: MUTED },
  confirmOkBtn: {
    flex: 2, paddingVertical: 16, borderRadius: 14,
    backgroundColor: GREEN,
    alignItems: 'center',
    shadowColor: GREEN, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5, shadowRadius: 10, elevation: 8,
  },
  confirmOkText: { fontSize: 16, fontWeight: '900', color: '#fff', letterSpacing: 0.5 },

  // Boton flotante prediccion
  floatingPredBtn: {
    position: 'absolute', bottom: 24, right: 20, zIndex: 100,
    backgroundColor: PURPLE, borderRadius: 24,
    paddingVertical: 12, paddingHorizontal: 20,
    shadowColor: PURPLE, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6, shadowRadius: 12, elevation: 20,
  },
  floatingPredBtnText: { fontSize: 14, fontWeight: '800', color: '#fff' },

  // Confirm present modal
  confirmOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000CC',
    zIndex: 60,
  },
  confirmSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 61,
    backgroundColor: '#1A1A2E',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderWidth: 1, borderColor: '#2A2A45',
    paddingHorizontal: 24, paddingBottom: 36, paddingTop: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.5, shadowRadius: 24, elevation: 40,
    alignItems: 'center',
  },
  confirmHandle: {
    width: 44, height: 4, borderRadius: 2,
    backgroundColor: '#2A2A45', marginBottom: 20,
  },
  confirmTitle: {
    fontSize: 20, fontWeight: '900', color: '#E2E8F0',
    textAlign: 'center', marginBottom: 4,
  },
  confirmSub: {
    fontSize: 12, color: '#64748B', textAlign: 'center', marginBottom: 24,
  },
  confirmDiceRow: {
    flexDirection: 'row', gap: 16, justifyContent: 'center', marginBottom: 16,
  },
  confirmDieWrap: { alignItems: 'center', gap: 6 },
  confirmDieNum:  { fontSize: 16, fontWeight: '900' },
  confirmHandBadge: {
    borderRadius: 12, borderWidth: 1.5,
    paddingHorizontal: 20, paddingVertical: 8,
    marginBottom: 24,
  },
  confirmHandText: { fontSize: 16, fontWeight: '800' },
  confirmBtns: {
    flexDirection: 'row', gap: 12, width: '100%',
  },
  confirmCancelBtn: {
    flex: 1, backgroundColor: '#2A2A45', borderRadius: 16,
    paddingVertical: 16, alignItems: 'center',
    borderWidth: 1, borderColor: '#2A2A45',
  },
  confirmCancelText: { fontSize: 15, fontWeight: '700', color: '#64748B' },
  confirmOkBtn: {
    flex: 2, backgroundColor: '#7C3AED', borderRadius: 16,
    paddingVertical: 16, alignItems: 'center',
    shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5, shadowRadius: 12, elevation: 10,
  },
  confirmOkText: { fontSize: 15, fontWeight: '800', color: '#fff' },

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
  predictionCheckText: { fontSize: 12, fontWeight: '900', color: '#000' },
  confirmBtn: {
    backgroundColor: PURPLE, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
  },
  confirmBtnDisabled: { backgroundColor: BORDER },
  confirmBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});