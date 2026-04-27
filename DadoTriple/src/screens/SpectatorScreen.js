/**
 * SpectatorScreen.js
 * Pantalla para espectadores — se actualiza en tiempo real.
 * Muestra dados disponibles, turno activo, countdown, resumen de predicciones
 * y ronda dentro del lanzamiento.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  Animated, TouchableOpacity, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import socketService from '../services/socketService';
import useGameStore from '../store/useGameStore';
import { playSound } from '../services/soundService';
import MagicBackground from '../components/MagicBackground';
import DiceFace from '../components/DiceFace';
import { colors, shadows } from '../theme';
import { 
  ArrowLeft, Eye, Trophy, Activity, 
  Cpu, Target, Zap, Dices, Timer, 
  AlertCircle, RefreshCw, TrendingUp, BarChart3
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

const VALUE_COLOR = { 1:'#94A3B8', 2:'#60A5FA', 3:'#34D399', 4:'#FBBF24', 5:'#F87171', 6:'#A78BFA' };
const AVATAR_COLORS = ['#7C3AED','#F59E0B','#10B981','#EF4444','#3B82F6','#EC4899'];

const HAND_COLOR = {
  'Trío':     '#A78BFA',
  'Escalera': '#34D399',
  'Par':      '#60A5FA',
  'Nada':     '#64748B',
};
function getHandColor(name) {
  if (!name) return MUTED;
  for (const [k, v] of Object.entries(HAND_COLOR))
    if (name.startsWith(k)) return v;
  return MUTED;
}

// ─── Dado estático ────────────────────────────────────────────────────────────
function Die({ value }) {
  const color = VALUE_COLOR[value] ?? MUTED;
  const hidden = value === null || value === undefined;
  return (
    <View style={[styles.die, hidden && styles.dieHidden, { borderColor: color + '70' }]}>
      <DiceFace
        value={value}
        hidden={hidden}
        size={32}
        pipColor={color}
        faceColor={hidden ? colors.bg2 : BG}
        borderColor={hidden ? BLUE + '80' : color + '70'}
      />
      <Text style={[styles.dieNum, { color: hidden ? BLUE : color }]}>
        {hidden ? 'OCULTO' : value}
      </Text>
    </View>
  );
}

// ─── Componente: Countdown del turno ─────────────────────────────────────────
function TurnCountdown({ seconds, total }) {
  const pct = Math.max(0, Math.min(100, (seconds / total) * 100));
  const color = seconds <= 5 ? RED : GOLD;
  return (
    <View style={styles.countdownRow}>
      <View style={styles.countdownTrack}>
        <View style={[styles.countdownFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.countdownNum, { color }]}>{seconds}s</Text>
    </View>
  );
}

// ─── Componente: Dados disponibles ───────────────────────────────────────────
function AvailableDice({ allDice, usedDiceIndices }) {
  const counts = {};
  for (let i = 1; i <= 6; i++) counts[i] = 0;
  
  allDice.forEach((val, i) => {
    if (!usedDiceIndices.includes(i)) counts[val]++;
  });

  const available = Object.entries(counts).filter(([_, c]) => c > 0);

  if (available.length === 0) return <Text style={styles.noDice}>Sin dados</Text>;

  return (
    <View style={styles.availableRow}>
      {available.map(([val, count]) => {
        const color = VALUE_COLOR[Number(val)] ?? MUTED;
        return (
          <View key={val} style={[styles.diceChip, { borderColor: color + '50' }]}>
            <Text style={[styles.diceChipCount, { color }]}>{count}x </Text>
            <DiceFace value={Number(val)} size={12} pipColor={color} faceColor={BG} />
          </View>
        );
      })}
    </View>
  );
}

// ─── Tarjeta de jugador ───────────────────────────────────────────────────────
function PlayerCard({ player, index, roundPhase, roundSnapshot, currentTurnPlayerId, turnCountdown }) {
  const pulse = useRef(new Animated.Value(1)).current;
  const isTheirTurn = player.id === currentTurnPlayerId && roundPhase === 'selecting';

  useEffect(() => {
    if (player.hasSelectedDice) {
      Animated.sequence([
        Animated.spring(pulse, { toValue: 1.03, useNativeDriver: true, speed: 40 }),
        Animated.spring(pulse, { toValue: 1,    useNativeDriver: true, speed: 20 }),
      ]).start();
    }
  }, [player.hasSelectedDice]);

  const avatarColor = AVATAR_COLORS[index % AVATAR_COLORS.length];
  const initial     = player.name?.[0]?.toUpperCase() ?? '?';
  const connected   = player.isConnected !== false;

  const snapPlayer  = roundSnapshot?.players?.find(p => p.id === player.id);
  const dice        = snapPlayer?.presentedDice ?? (player.hasSelectedDice ? player.presentedDice : []);
  const hand        = snapPlayer?.hand ?? (player.hasSelectedDice ? player.hand : null);
  const hColor      = getHandColor(hand?.name);

  // Estado del jugador
  const statusLabel = !connected          ? 'Desconectado'
    : roundPhase === 'rolling' && !player.hasRolled ? 'Tirando...'
    : roundPhase === 'rolling' && player.hasRolled  ? 'Tiró'
    : player.hasSelectedDice                         ? hand?.name ?? 'Presentó'
    : 'Eligiendo...';
  const statusColor = !connected ? MUTED
    : player.hasSelectedDice ? hColor
    : roundPhase === 'rolling' && player.hasRolled ? GOLD
    : BLUE;

  return (
    <Animated.View style={[
      styles.playerCard,
      !connected && styles.playerCardOff,
      player.hasSelectedDice && styles.playerCardDone,
      isTheirTurn && styles.playerCardTurn,
      { transform: [{ scale: pulse }] },
    ]}>
      {/* Header */}
      <View style={styles.playerHeader}>
        <View style={[styles.avatar, { backgroundColor: connected ? avatarColor : MUTED }]}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <View style={styles.playerMeta}>
          <Text style={styles.playerName} numberOfLines={1}>{player.name ?? '?'}</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, {backgroundColor: statusColor}]} />
            <Text style={[styles.statusLabel, player.hasSelectedDice && { color: hColor }]}>
              {statusLabel}
            </Text>
          </View>
        </View>
        <View style={styles.scoreBox}>
          <Text style={styles.scoreValue}>{player.totalPoints ?? 0}</Text>
          <Text style={styles.scoreUnit}>pts</Text>
        </View>
      </View>

      {/* Countdown cuando es su turno */}
      {isTheirTurn && turnCountdown !== null && (
        <TurnCountdown seconds={turnCountdown} total={30} />
      )}

      {/* Dados presentados */}
      {dice.length > 0 && (
        <View style={styles.diceRow}>
          {dice.map((val, i) => <Die key={i} value={val} />)}
          {hand && (
            <View style={[styles.handTag, { backgroundColor: hColor + '18', borderColor: hColor + '50' }]}>
              <Text style={[styles.handTagText, { color: hColor }]}>{hand.name}</Text>
            </View>
          )}
        </View>
      )}

      {/* Dados disponibles — cuando no ha presentado */}
      {!player.hasSelectedDice && (roundPhase === 'predicting' || roundPhase === 'selecting') &&
        player.allDice?.length > 0 && (
        <AvailableDice
          allDice={player.allDice}
          usedDiceIndices={player.usedDiceIndices ?? []}
        />
      )}

      {/* Puntos de ronda */}
      {snapPlayer && (
        <View style={styles.roundPtsRow}>
          <Text style={styles.roundPtsLabel}>Esta ronda:</Text>
          <Text style={[styles.roundPtsValue, { color: snapPlayer.roundPoints > 0 ? GOLD : MUTED }]}>
            +{snapPlayer.roundPoints ?? 0} pts
          </Text>
        </View>
      )}
    </Animated.View>
  );
}

// ─── Resumen de predicciones al final del lanzamiento ────────────────────────
function LaunchSummary({ snapshot }) {
  if (!snapshot?.isLastRoundOfLaunch) return null;
  const players = snapshot.players ?? [];
  const hasPredictions = players.some(p => p.prediction);
  if (!hasPredictions) return null;

  return (
    <View style={styles.launchSummary}>
      <Text style={styles.launchSummaryTitle}>📊 Resultado del lanzamiento</Text>
      {players.map(p => {
        const hit     = p.predictionHit;
        const bonus   = p.bonusPoints ?? 0;
        const PRED_LABELS = {
          high: 'Más de 10 pts 🔥',
          mid:  '7 a 10 pts ⚡',
          low:  '1 a 6 pts 🌊',
          zero: 'Exactamente 0 💀',
        };
        return (
          <View key={p.id} style={[
            styles.summaryRow,
            hit === true  && styles.summaryRowHit,
            hit === false && styles.summaryRowMiss,
          ]}>
            <Text style={styles.summaryName} numberOfLines={1}>{p.name}</Text>
            <View style={{ flex: 1 }}>
              {p.prediction && (
                <Text style={styles.summaryPred}>{PRED_LABELS[p.prediction] ?? p.prediction}</Text>
              )}
              <Text style={[styles.summaryResult, { color: hit ? GREEN : hit === false ? RED : MUTED }]}>
                {hit === true  ? `✅ Acertó  +${bonus > 0 ? bonus : 0} bonus` :
                 hit === false ? '❌ Falló' :
                 '—'}
              </Text>
            </View>
            <Text style={[styles.summaryPts, { color: GOLD }]}>{p.launchPoints} pts</Text>
          </View>
        );
      })}
    </View>
  );
}

// ─── Pantalla principal ───────────────────────────────────────────────────────
export default function SpectatorScreen({ route, navigation }) {
  const { roomCode } = route.params ?? {};

  const players       = useGameStore(s => s.players);
  const spectators    = useGameStore(s => s.spectators);
  const gamePhase     = useGameStore(s => s.gamePhase);
  const roundNumber   = useGameStore(s => s.roundNumber);
  const totalRounds   = useGameStore(s => s.totalRounds);
  const launchNumber  = useGameStore(s => s.launchNumber);
  const roomState     = useGameStore(s => s.roomState);
  const roundSnapshot = useGameStore(s => s.roundSnapshot);
  const gameOver      = useGameStore(s => s.gameOver);
  const currentTurnPlayerId = useGameStore(s => s.currentTurnPlayerId);

  const [log,            setLog]            = useState([]);
  const [turnCountdown,  setTurnCountdown]  = useState(null);
  const [refreshing,     setRefreshing]     = useState(false);
  const [lastSummary,    setLastSummary]    = useState(null);
  const countdownRef = useRef(null);

  const headerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(headerAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [roundNumber, gamePhase]);

  // Guardar último resumen de lanzamiento
  useEffect(() => {
    if (roundSnapshot?.isLastRoundOfLaunch) setLastSummary(roundSnapshot);
  }, [roundSnapshot]);

  // Countdown de turno activo
  useEffect(() => {
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
    if (currentTurnPlayerId && gamePhase === 'selecting') {
      setTurnCountdown(30);
      countdownRef.current = setInterval(() => {
        setTurnCountdown(prev => {
          if (prev === null || prev <= 1) { clearInterval(countdownRef.current); return 0; }
          return prev - 1;
        });
      }, 1000);
    } else {
      setTurnCountdown(null);
    }
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [currentTurnPlayerId, gamePhase]);

  const addLog = (msg, icon = 'Activity') => {
    setLog(prev => [
      { msg, icon, time: new Date().toLocaleTimeString('es-CR', { hour12: false }) },
      ...prev,
    ].slice(0, 10));
  };

  useEffect(() => {
    const offs = [
      socketService.on('round_started',       (p) => { addLog(`Ronda ${p.round} iniciada`, 'Dices'); }),
      socketService.on('dice_rolled',         ()  => { addLog(`Un jugador tiró sus dados`, 'Zap'); }),
      socketService.on('turn_started',        (p) => { addLog(`Turno de ${p.playerName}`, 'Timer'); }),
      socketService.on('dice_selected',       (p) => { if (p.handName) addLog(`Mano: ${p.handName}`, 'Target'); }),
      socketService.on('auto_selected',       (p) => { addLog(`Auto: ${p.playerName} → ${p.hand}`, 'Cpu'); }),
      socketService.on('prediction_made',     (p) => { addLog(`${p.playerName} predijo`, 'TrendingUp'); }),
      socketService.on('round_ended',         (p) => { addLog(`Ronda ${p.round} terminada`, 'BarChart3'); }),
      socketService.on('game_over',           (p) => { addLog(`Ganador: ${p.winner?.name}`, 'Trophy'); }),
      socketService.on('player_disconnected', (p) => { addLog(`${p.disconnectedPlayerName} se desconectó`, 'AlertCircle'); }),
      socketService.on('player_reconnected',  (p) => { addLog(`${p.reconnectedPlayerName} volvió`, 'RefreshCw'); }),
    ];
    return () => offs.forEach(off => off());
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  const handleExit = () => {
    playSound('click', 0.55);
    socketService.disconnect();
    useGameStore.getState().resetGame();
    navigation.navigate('Lobby');
  };

  const scoreboard = [...players].sort((a, b) => (b.totalPoints ?? 0) - (a.totalPoints ?? 0));

  // Ronda dentro del lanzamiento
  const roundInLaunch = roundNumber > 0 ? ((roundNumber - 1) % 3) + 1 : 0;

  const phaseLabel = {
    waiting:   'Esperando jugadores',
    rolling:   'Tirando dados',
    selecting: 'Eligiendo dados',
    scoring:   'Calculando',
    finished:  'Fin de partida',
  }[gamePhase] ?? 'Esperando';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <MagicBackground intensity={0.55} />
      {/* ── Header fijo ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleExit} style={styles.exitBtn} activeOpacity={0.7}>
          <ArrowLeft size={20} color={MUTED} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerCode}>{roomCode}</Text>
          <Text style={styles.headerPhase}>{phaseLabel}</Text>
        </View>
        <View style={styles.headerRight}>
          <Eye size={18} color={GOLD} />
          <Text style={styles.specCount}>{spectators.length}</Text>
        </View>
      </View>

      {/* ── Barra de progreso ── */}
      {roundNumber > 0 && (
        <Animated.View style={[styles.progressBar, { opacity: headerAnim }]}>
          {/* Lanzamiento + ronda */}
          <View style={styles.progressLeft}>
            <Text style={styles.progressLaunch}>LANCE {launchNumber}/3</Text>
            <Text style={styles.progressRound}>
              Ronda <Text style={styles.progressRoundBold}>{roundInLaunch}</Text>/3
            </Text>
          </View>

          {/* Dots de 9 rondas */}
          <View style={styles.dotsRow}>
            {Array.from({ length: 9 }).map((_, i) => {
              const isCurrentLaunch = Math.floor(i / 3) + 1 === launchNumber;
              const isPlayed = i < roundNumber - 1;
              const isCurrent = i === roundNumber - 1;
              return (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    isPlayed  && styles.dotPlayed,
                    isCurrent && styles.dotCurrent,
                    i % 3 === 2 && i < 8 && styles.dotSpacer,
                  ]}
                />
              );
            })}
          </View>

          <Text style={styles.progressTotal}>R{roundNumber}/{totalRounds}</Text>
        </Animated.View>
      )}

      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={PURPLE}
          />
        }
      >
        {/* ── Jugadores ── */}
        {players.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>JUGADORES</Text>
            <View style={styles.playersList}>
              {players.map((p, i) => (
                <PlayerCard
                  key={p.id}
                  player={p}
                  index={i}
                  roundPhase={roomState?.roundPhase ?? gamePhase}
                  roundSnapshot={roundSnapshot}
                  currentTurnPlayerId={currentTurnPlayerId}
                  turnCountdown={p.id === currentTurnPlayerId ? turnCountdown : null}
                />
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyMark} />
            <Text style={styles.emptyTitle}>Observando sala {roomCode}</Text>
            <Text style={styles.emptyText}>Esperando que la partida comience...</Text>
          </View>
        )}

        {/* ── Resumen del último lanzamiento ── */}
        {lastSummary && gamePhase !== 'rolling' && (
          <LaunchSummary snapshot={lastSummary} />
        )}

        {/* ── Marcador ── */}
        {scoreboard.length > 0 && roundNumber > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>MARCADOR</Text>
            <View style={styles.scoreBoard}>
              {scoreboard.map((p, i) => (
                <View key={p.id} style={[styles.scoreRow, i === 0 && styles.scoreRowFirst]}>
                  <Text style={styles.scoreMedal}>
                    {`${i + 1}°`}
                  </Text>
                  <Text style={styles.scoreName} numberOfLines={1}>{p.name ?? '?'}</Text>
                  <Text style={[styles.scoreTotal, i === 0 && { color: GOLD }]}>
                    {p.totalPoints ?? 0} pts
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Game Over ── */}
        {gameOver && (
          <View style={styles.gameOverCard}>
            <View style={styles.gameOverMark} />
            <Text style={styles.gameOverLabel}>GANADOR</Text>
            <Text style={styles.gameOverName}>{gameOver.winner?.name}</Text>
            <Text style={styles.gameOverScore}>{gameOver.winner?.totalPoints} pts</Text>
          </View>
        )}

        {/* ── Log de actividad ── */}
        {log.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>ACTIVIDAD</Text>
            <View style={styles.logContainer}>
              {log.map((entry, i) => (
                <View key={i} style={[styles.logRow, i === 0 && styles.logRowNew]}>
                  <Text style={styles.logTime}>{entry.time}</Text>
                  <View style={styles.logIconContainer}>
                    {/* Render dinámico del ícono basado en el string guardado */}
                    {(() => {
                      const IconComp = {
                        Dices, Zap, Timer, Target, Cpu, TrendingUp, 
                        BarChart3, Trophy, AlertCircle, RefreshCw, Activity
                      }[entry.icon] || Activity;
                      return <IconComp size={12} color={PURPLE} />;
                    })()}
                  </View>
                  <Text style={styles.logMsg}>{entry.msg}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: CARD, borderBottomWidth: 1,
    borderBottomColor: BORDER, paddingHorizontal: 16,
    paddingVertical: 12,
    ...shadows.purple,
  },
  exitBtn:      { width: 60 },
  exitBtnText:  { color: MUTED, fontSize: 14, fontWeight: '600' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerCode: { fontSize: 20, fontWeight: '900', color: GOLD, letterSpacing: 4 },
  headerPhase: { fontSize: 11, color: PURPLE, fontWeight: '700', marginTop: 2 },
  headerRight: { width: 60, alignItems: 'flex-end' },
  eyeMark: {
    width: 18, height: 10, borderRadius: 999, borderWidth: 1.5,
    borderColor: GOLD, backgroundColor: GOLD + '18', marginBottom: 3,
  },
  specCount: { fontSize: 11, color: MUTED },

  // Barra de ronda
  roundBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: PURPLE + '15',
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: PURPLE + '30',
    gap: 12,
  },
  progressLeft: { alignItems: 'flex-start', minWidth: 64 },
  progressLaunch: { fontSize: 9, fontWeight: '800', color: PURPLE, letterSpacing: 2 },
  progressRound:  { fontSize: 12, color: MUTED, marginTop: 1 },
  progressRoundBold: { fontWeight: '800', color: TEXT },
  dotsRow:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  dot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: BORDER,
  },
  dotPlayed:  { backgroundColor: PURPLE + '70' },
  dotCurrent: { backgroundColor: PURPLE, width: 10, height: 10, borderRadius: 5 },
  dotSpacer:  { marginRight: 6 },
  progressTotal: { fontSize: 11, color: MUTED, fontWeight: '600', minWidth: 40, textAlign: 'right' },

  root:   { flex: 1, backgroundColor: 'transparent' },
  scroll: { paddingHorizontal: 14, paddingTop: 14 },

  section:      { marginBottom: 20 },
  sectionLabel: { fontSize: 9, fontWeight: '700', color: MUTED, letterSpacing: 2, marginBottom: 10 },

  // Tarjeta jugador
  playersList: { gap: 10 },
  playerCard: {
    backgroundColor: CARD, borderRadius: 16,
    borderWidth: 1, borderColor: BORDER, padding: 14,
    ...shadows.purple,
  },
  playerCardOff:  { opacity: 0.45 },
  playerCardDone: { borderColor: GREEN + '40' },
  playerCardTurn: { borderColor: GOLD + '80', backgroundColor: GOLD + '08' },

  playerHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText:   { fontSize: 18, fontWeight: '800', color: '#fff' },
  playerMeta:   { flex: 1 },
  playerName:   { fontSize: 15, fontWeight: '700', color: TEXT },
  statusRow:    { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  statusEmoji:  { fontSize: 12 },
  statusDot:    { width: 7, height: 7, borderRadius: 4 },
  statusLabel:  { fontSize: 11, color: MUTED, fontWeight: '600' },
  scoreBox:     { alignItems: 'flex-end' },
  scoreValue:   { fontSize: 20, fontWeight: '900', color: GOLD },
  scoreUnit:    { fontSize: 10, color: MUTED },

  // Countdown
  countdownRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  countdownTrack: {
    flex: 1, height: 4, backgroundColor: BORDER, borderRadius: 2, overflow: 'hidden',
  },
  countdownFill: { height: 4, borderRadius: 2 },
  countdownNum:  { fontSize: 11, fontWeight: '800', minWidth: 26, textAlign: 'right' },

  // Dados
  diceRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 8, marginTop: 12, flexWrap: 'wrap',
  },
  die: {
    width: 46, height: 56, borderRadius: 10,
    backgroundColor: BG, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  dieHidden: {
    borderStyle: 'dashed',
    backgroundColor: BLUE + '10',
  },
  dieEmoji: { fontSize: 17 },
  dieNum:   { fontSize: 8, fontWeight: '900', marginTop: 2, letterSpacing: 0.4 },

  handTag: {
    borderRadius: 8, borderWidth: 1,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  handTagText: { fontSize: 11, fontWeight: '700' },

  // Dados disponibles
  availableRow: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: 5, marginTop: 10,
  },
  diceChip: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: BG, borderRadius: 8, borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 7, paddingVertical: 3,
  },
  diceChipEmoji: { fontSize: 13 },
  diceChipCount: { fontSize: 9, fontWeight: '800' },
  noDice: { fontSize: 10, color: MUTED, fontStyle: 'italic', marginTop: 6 },

  roundPtsRow: {
    flexDirection: 'row', justifyContent: 'flex-end',
    alignItems: 'center', gap: 6, marginTop: 10,
  },
  roundPtsLabel: { fontSize: 11, color: MUTED },
  roundPtsValue: { fontSize: 14, fontWeight: '800' },

  // Resumen lanzamiento
  launchSummary: {
    backgroundColor: CARD, borderRadius: 16,
    borderWidth: 1.5, borderColor: PURPLE + '40',
    padding: 14, marginBottom: 20,
  },
  launchSummaryTitle: {
    fontSize: 11, fontWeight: '800', color: PURPLE,
    letterSpacing: 1, marginBottom: 10,
  },
  summaryRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 10, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  summaryRowHit:  { backgroundColor: GREEN  + '08' },
  summaryRowMiss: { backgroundColor: RED    + '08' },
  summaryName:    { fontSize: 13, fontWeight: '700', color: TEXT, width: 80 },
  summaryPred:    { fontSize: 10, color: MUTED },
  summaryResult:  { fontSize: 11, fontWeight: '700', marginTop: 2 },
  summaryPts:     { fontSize: 16, fontWeight: '900', marginLeft: 'auto' },

  // Estado vacío
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyMark: {
    width: 62, height: 38, borderRadius: 999, borderWidth: 2,
    borderColor: GOLD + '70', backgroundColor: GOLD + '12',
  },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: TEXT },
  emptyText:  { fontSize: 14, color: MUTED },

  // Marcador
  scoreBoard: {
    backgroundColor: CARD, borderRadius: 14,
    borderWidth: 1, borderColor: BORDER, overflow: 'hidden',
  },
  scoreRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    gap: 12, borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  scoreRowFirst: { backgroundColor: GOLD + '08' },
  scoreMedal: { fontSize: 13, width: 28, color: MUTED, fontWeight: '900' },
  scoreName:  { flex: 1, fontSize: 14, fontWeight: '700', color: TEXT },
  scoreTotal: { fontSize: 16, fontWeight: '800', color: MUTED },

  // Game over
  gameOverCard: {
    backgroundColor: GOLD + '12', borderRadius: 20,
    borderWidth: 1.5, borderColor: GOLD + '50',
    padding: 24, alignItems: 'center',
    marginBottom: 20, gap: 4,
    ...shadows.gold,
  },
  gameOverMark: {
    width: 64, height: 12, borderRadius: 999,
    backgroundColor: GOLD, marginBottom: 10,
  },
  gameOverLabel: { fontSize: 10, fontWeight: '700', color: GOLD, letterSpacing: 2 },
  gameOverName:  { fontSize: 28, fontWeight: '900', color: TEXT },
  gameOverScore: { fontSize: 36, fontWeight: '900', color: GOLD },

  // Log
  logContainer: {
    backgroundColor: CARD, borderRadius: 14,
    borderWidth: 1, borderColor: BORDER, overflow: 'hidden',
  },
  logRow: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  logRowNew: { backgroundColor: PURPLE + '0D' },
  logTime: { fontSize: 10, color: MUTED, fontFamily: 'monospace', paddingTop: 2, width: 45 },
  logIconContainer: { width: 20, alignItems: 'center', justifyContent: 'center' },
  logMsg:  { flex: 1, fontSize: 12, color: TEXT, fontWeight: '500' },
});
