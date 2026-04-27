/**
 * SpectatorScreen.js
 * Pantalla única para espectadores — se actualiza en tiempo real.
 * Muestra dados presentados de todos, estado de ronda y marcador.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  Animated, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import socketService from '../services/socketService';
import { playSound } from '../services/soundService';
import useGameStore from '../store/useGameStore';
import MagicBackground from '../components/MagicBackground';
import DiceFace from '../components/DiceFace';
import {colors, shadows} from '../theme';

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
  for (const [k, v] of Object.entries(HAND_COLOR)) {
    if (name.startsWith(k)) return v;
  }
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

// ─── Tarjeta de jugador ───────────────────────────────────────────────────────
function PlayerCard({ player, index, roundPhase, roundSnapshot }) {
  const pulse = useRef(new Animated.Value(1)).current;

  // Pulsar cuando el jugador acaba de presentar
  useEffect(() => {
    if (player.hasSelectedDice) {
      Animated.sequence([
        Animated.spring(pulse, { toValue: 1.04, useNativeDriver: true, speed: 40 }),
        Animated.spring(pulse, { toValue: 1,    useNativeDriver: true, speed: 20 }),
      ]).start();
    }
  }, [player.hasSelectedDice]);

  const avatarColor = AVATAR_COLORS[index % AVATAR_COLORS.length];
  const initial     = player.name?.[0]?.toUpperCase() ?? '?';
  const connected   = player.isConnected !== false;

  // Buscar resultado en el snapshot de la ronda si existe
  const snapPlayer = roundSnapshot?.players?.find(p => p.id === player.id);
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
      { transform: [{ scale: pulse }] },
    ]}>
      {/* Avatar + nombre */}
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

      {/* Puntos de ronda si terminó */}
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

// ─── Pantalla principal ───────────────────────────────────────────────────────
export default function SpectatorScreen({ route, navigation }) {
  const { roomCode } = route.params ?? {};

  const players       = useGameStore(s => s.players);
  const spectators    = useGameStore(s => s.spectators);
  const gamePhase     = useGameStore(s => s.gamePhase);
  const roundNumber   = useGameStore(s => s.roundNumber);
  const totalRounds   = useGameStore(s => s.totalRounds);
  const roomState     = useGameStore(s => s.roomState);
  const roundSnapshot = useGameStore(s => s.roundSnapshot);
  const gameOver      = useGameStore(s => s.gameOver);

  const [phase, setPhase] = useState('waiting'); // waiting | playing | finished
  const [log, setLog]     = useState([]);

  const headerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(headerAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [roundNumber, gamePhase]);

  // Log de eventos en tiempo real
  const addLog = (msg) => {
    setLog(prev => [{ msg, time: new Date().toLocaleTimeString('es-CR', { hour12: false }) }, ...prev].slice(0, 8));
  };

  useEffect(() => {
    const listeners = [
      socketService.on('round_started',      (p) => {
        addLog(`Ronda ${p.round} iniciada`);
        setPhase('playing');
      }),
      socketService.on('dice_rolled',        (p) => addLog('Un jugador tiró sus dados')),
      socketService.on('dice_selected',      (p) => addLog(`${p.handName}`)),
      socketService.on('auto_selected',      (p) => addLog(`Auto: ${p.playerName} → ${p.hand}`)),
      socketService.on('round_ended',        (p) => addLog(`Ronda ${p.round} terminada`)),
      socketService.on('game_over',          (p) => {
        addLog(`Ganador: ${p.winner?.name}`);
        setPhase('finished');
      }),
      socketService.on('player_disconnected',(p) => addLog(`${p.disconnectedPlayerName} se desconectó`)),
      socketService.on('player_reconnected', (p) => addLog(`${p.reconnectedPlayerName} volvió`)),
    ];
    return () => listeners.forEach(off => off());
  }, []);

  const handleExit = () => {
    playSound('click', 0.55);
    socketService.disconnect();
    useGameStore.getState().resetGame();
    navigation.navigate('Lobby');
  };

  // Marcador ordenado
  const scoreboard = [...players].sort((a, b) => (b.totalPoints ?? 0) - (a.totalPoints ?? 0));

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
          <Text style={styles.exitBtnText}>← Salir</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerCode}>{roomCode}</Text>
          <Text style={styles.headerPhase}>{phaseLabel}</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.eyeMark} />
          <Text style={styles.specCount}>{spectators.length}</Text>
        </View>
      </View>

      {/* Barra de ronda */}
      {roundNumber > 0 && (
        <Animated.View style={[styles.roundBar, { opacity: headerAnim }]}>
          <Text style={styles.roundBarText}>
            RONDA {roundNumber} / {totalRounds}
          </Text>
          <View style={styles.roundProgress}>
            {Array.from({ length: totalRounds }).map((_, i) => (
              <View
                key={i}
                style={[styles.roundDot, i < roundNumber && styles.roundDotActive]}
              />
            ))}
          </View>
        </Animated.View>
      )}

      <ScrollView style={styles.root} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

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
                  roundPhase={roomState?.roundPhase}
                  roundSnapshot={roundSnapshot}
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

        {/* ── Log de eventos ── */}
        {log.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>ACTIVIDAD</Text>
            <View style={styles.logContainer}>
              {log.map((entry, i) => (
                <View key={i} style={[styles.logRow, i === 0 && styles.logRowNew]}>
                  <Text style={styles.logTime}>{entry.time}</Text>
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
  exitBtn: { width: 60 },
  exitBtnText: { color: MUTED, fontSize: 14, fontWeight: '600' },
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
    backgroundColor: PURPLE + '18',
    paddingHorizontal: 16, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: PURPLE + '30',
    gap: 12,
  },
  roundBarText: { fontSize: 11, fontWeight: '700', color: PURPLE, letterSpacing: 1 },
  roundProgress: { flexDirection: 'row', gap: 6 },
  roundDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: BORDER,
  },
  roundDotActive: { backgroundColor: PURPLE },

  root:   { flex: 1, backgroundColor: 'transparent' },
  scroll: { paddingHorizontal: 14, paddingTop: 14 },

  // Sección
  section: { marginBottom: 20 },
  sectionLabel: {
    fontSize: 9, fontWeight: '700', color: MUTED,
    letterSpacing: 2, marginBottom: 10,
  },

  // Lista jugadores
  playersList: { gap: 10 },
  playerCard: {
    backgroundColor: CARD, borderRadius: 16,
    borderWidth: 1, borderColor: BORDER, padding: 14,
    ...shadows.purple,
  },
  playerCardOff:  { opacity: 0.45 },
  playerCardDone: { borderColor: GREEN + '40' },

  playerHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '800', color: '#fff' },
  playerMeta: { flex: 1 },
  playerName: { fontSize: 15, fontWeight: '700', color: TEXT },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusLabel: { fontSize: 11, color: MUTED, fontWeight: '600' },
  scoreBox: { alignItems: 'flex-end' },
  scoreValue: { fontSize: 20, fontWeight: '900', color: GOLD },
  scoreUnit: { fontSize: 10, color: MUTED },

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

  roundPtsRow: {
    flexDirection: 'row', justifyContent: 'flex-end',
    alignItems: 'center', gap: 6, marginTop: 8,
  },
  roundPtsLabel: { fontSize: 11, color: MUTED },
  roundPtsValue: { fontSize: 14, fontWeight: '800' },

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
  logTime: { fontSize: 10, color: MUTED, fontFamily: 'monospace', paddingTop: 1 },
  logMsg:  { flex: 1, fontSize: 12, color: TEXT, fontWeight: '500' },
});
