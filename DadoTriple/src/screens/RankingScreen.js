/**
 * RankingScreen.js
 * Top 10 del día y de la semana.
 * Si el jugador no está en top lo muestra al final con su posición real.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Animated, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useGameStore from '../store/useGameStore';
import { API_URL } from '../services/apiService';

const BG     = '#0F0F1A';
const CARD   = '#1A1A2E';
const BORDER = '#2A2A45';
const TEXT   = '#E2E8F0';
const MUTED  = '#64748B';
const PURPLE = '#7C3AED';
const GOLD   = '#F59E0B';
const SILVER = '#94A3B8';
const BRONZE = '#CD7C3E';

const MONTHS = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const DAYS   = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

function getPeriodLabels() {
  const now = new Date();
  const dayLabel = `${DAYS[now.getDay()]} ${now.getDate()} ${MONTHS[now.getMonth()]}`;
  const daysFromMon = now.getDay() === 0 ? 6 : now.getDay() - 1;
  const mon = new Date(now); mon.setDate(now.getDate() - daysFromMon);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  const weekLabel = `${mon.getDate()} ${MONTHS[mon.getMonth()]} – ${sun.getDate()} ${MONTHS[sun.getMonth()]}`;
  return { dayLabel, weekLabel };
}

// ─── Fila de ranking ──────────────────────────────────────────────────────────
function RankRow({ player, position, isMe, isOutsideTop, delay = 0 }) {
  const slide = useRef(new Animated.Value(40)).current;
  const fade  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade,  { toValue: 1, duration: 350, delay, useNativeDriver: true }),
      Animated.spring(slide, { toValue: 0, delay, useNativeDriver: true, tension: 70, friction: 11 }),
    ]).start();
  }, []);

  const MEDALS = ['🥇', '🥈', '🥉'];
  const medal  = MEDALS[position - 1] ?? null;
  const posColors = [GOLD, SILVER, BRONZE];
  const posColor  = posColors[position - 1] ?? MUTED;

  return (
    <Animated.View style={[
      styles.row,
      isMe && styles.rowMe,
      isOutsideTop && styles.rowOutside,
      position === 1 && styles.rowFirst,
      position === 2 && styles.rowSecond,
      position === 3 && styles.rowThird,
      { opacity: fade, transform: [{ translateX: slide }] },
    ]}>
      {/* Posición */}
      <View style={[styles.posBox, position <= 3 && { borderColor: posColor + '60', backgroundColor: posColor + '15' }]}>
        {medal
          ? <Text style={styles.medal}>{medal}</Text>
          : <Text style={[styles.posNum, { color: isMe ? PURPLE : posColor }]}>{position}</Text>}
      </View>

      {/* Nombre */}
      <Text style={[styles.name, isMe && styles.nameMe]} numberOfLines={1}>
        {player.name}{isMe ? '  (tú)' : ''}
      </Text>

      {/* Puntos */}
      <View style={styles.rightCol}>
        <Text style={[styles.score, position === 1 && { color: GOLD }, isMe && !medal && { color: PURPLE }]}>
          {(player.periodScore ?? player.totalScore ?? 0)} pts
        </Text>
        {(player.games ?? 0) > 0 && (
          <Text style={styles.games}>{player.games} partida{player.games !== 1 ? 's' : ''}</Text>
        )}
      </View>
    </Animated.View>
  );
}

// ─── Pantalla principal ───────────────────────────────────────────────────────
export default function RankingScreen() {
  const playerName = useGameStore(s => s.playerName);
  const [tab,     setTab]     = useState('daily');
  const [ranking, setRanking] = useState([]);
  const [myPos,   setMyPos]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const tabAnim = useRef(new Animated.Value(0)).current;
  const { dayLabel, weekLabel } = getPeriodLabels();

  const fetchRanking = async (period, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const name = encodeURIComponent(playerName || '');
      const url  = `${API_URL}/stats/ranking/${period}?name=${name}`;
      const resp = await fetch(url);
      const data = await resp.json();
      setRanking(data.ranking ?? []);
      setMyPos(data.myPosition ?? null);
    } catch (e) {
      setRanking([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchRanking(tab); }, [tab]);

  const switchTab = (t) => {
    setTab(t);
    Animated.spring(tabAnim, {
      toValue: t === 'daily' ? 0 : 1,
      useNativeDriver: false, tension: 80, friction: 12,
    }).start();
  };

  const myInTop = playerName && ranking.some(p => p.name === playerName);

  const indicatorLeft = tabAnim.interpolate({
    inputRange: [0, 1], outputRange: ['0%', '50%'],
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🏆 Ranking</Text>
        <Text style={styles.headerSub}>
          {tab === 'daily' ? dayLabel : weekLabel}
        </Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabsWrapper}>
        <View style={styles.tabs}>
          <Animated.View style={[styles.tabIndicator, { left: indicatorLeft }]} />
          <TouchableOpacity style={styles.tab} onPress={() => switchTab('daily')} activeOpacity={0.7}>
            <Text style={[styles.tabText, tab === 'daily' && styles.tabTextActive]}>📅 Hoy</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tab} onPress={() => switchTab('weekly')} activeOpacity={0.7}>
            <Text style={[styles.tabText, tab === 'weekly' && styles.tabTextActive]}>📆 Esta semana</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchRanking(tab, true)}
            tintColor={PURPLE}
          />
        }
      >
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={PURPLE} size="large" />
            <Text style={styles.loadingText}>Cargando ranking...</Text>
          </View>
        ) : ranking.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🎲</Text>
            <Text style={styles.emptyTitle}>
              {tab === 'daily' ? 'Sin partidas hoy' : 'Sin partidas esta semana'}
            </Text>
            <Text style={styles.emptyText}>
              ¡Juega una partida para aparecer aquí!
            </Text>
          </View>
        ) : (
          <>
            {/* Top 10 */}
            <Text style={styles.sectionLabel}>TOP 10</Text>
            {ranking.map((p, i) => (
              <RankRow
                key={p.name}
                player={p}
                position={i + 1}
                isMe={p.name === playerName}
                delay={i * 60}
              />
            ))}

            {/* Jugador fuera del top */}
            {!myInTop && myPos && playerName && (
              <>
                <View style={styles.separator}>
                  <View style={styles.separatorLine} />
                  <Text style={styles.separatorText}>· · ·</Text>
                  <View style={styles.separatorLine} />
                </View>
                <Text style={styles.myPosNote}>
                  Tu posición actual
                </Text>
                <RankRow
                  player={{ name: playerName, periodScore: myPos.score, games: 0 }}
                  position={myPos.position}
                  isMe={true}
                  isOutsideTop={true}
                />
                <Text style={styles.totalNote}>
                  Posición {myPos.position} de {myPos.total} jugadores
                </Text>
              </>
            )}

            {!myInTop && !myPos && playerName && (
              <View style={styles.notRankedBox}>
                <Text style={styles.notRankedText}>
                  Aún no tienes puntos {tab === 'daily' ? 'hoy' : 'esta semana'}.
                  {'\n'}¡Juega para aparecer en el ranking!
                </Text>
              </View>
            )}
          </>
        )}
        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: BG },

  header: {
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8,
    alignItems: 'center',
  },
  headerTitle: { fontSize: 24, fontWeight: '900', color: TEXT },
  headerSub:   { fontSize: 12, color: MUTED, marginTop: 2, fontStyle: 'italic' },

  tabsWrapper: { paddingHorizontal: 20, marginBottom: 8 },
  tabs: {
    flexDirection: 'row', backgroundColor: CARD,
    borderRadius: 14, padding: 3,
    position: 'relative', overflow: 'hidden',
    borderWidth: 1, borderColor: BORDER,
  },
  tabIndicator: {
    position: 'absolute', top: 3, bottom: 3, width: '50%',
    backgroundColor: PURPLE, borderRadius: 11,
  },
  tab:          { flex: 1, paddingVertical: 12, alignItems: 'center', zIndex: 1 },
  tabText:      { fontSize: 13, fontWeight: '700', color: MUTED },
  tabTextActive:{ color: TEXT },

  scroll:  { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 16 },

  sectionLabel: {
    fontSize: 9, fontWeight: '700', color: MUTED,
    letterSpacing: 2, marginBottom: 10, marginTop: 4,
  },

  // Fila
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: CARD, borderRadius: 14,
    borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 14, paddingVertical: 12,
    marginBottom: 8, gap: 12,
  },
  rowMe: {
    borderColor: PURPLE,
    backgroundColor: PURPLE + '0D',
  },
  rowFirst:  { borderColor: GOLD   + '55', backgroundColor: GOLD   + '08' },
  rowSecond: { borderColor: SILVER + '40', backgroundColor: SILVER + '06' },
  rowThird:  { borderColor: BRONZE + '40', backgroundColor: BRONZE + '06' },
  rowOutside:{ borderStyle: 'dashed', borderColor: PURPLE },

  posBox: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: CARD, borderWidth: 1, borderColor: BORDER,
    alignItems: 'center', justifyContent: 'center',
  },
  medal:  { fontSize: 20 },
  posNum: { fontSize: 15, fontWeight: '800' },
  name:   { flex: 1, fontSize: 15, fontWeight: '700', color: TEXT },
  nameMe: { color: '#C4B5FD' },
  rightCol: { alignItems: 'flex-end' },
  score:  { fontSize: 18, fontWeight: '800', color: MUTED },
  games:  { fontSize: 10, color: MUTED, marginTop: 1 },

  // Separador
  separator: {
    flexDirection: 'row', alignItems: 'center',
    gap: 8, marginVertical: 8,
  },
  separatorLine: { flex: 1, height: 1, backgroundColor: BORDER },
  separatorText: { color: BORDER, fontSize: 14, letterSpacing: 4 },

  myPosNote: {
    fontSize: 9, fontWeight: '700', color: PURPLE,
    letterSpacing: 2, marginBottom: 6, textAlign: 'center',
  },
  totalNote: {
    textAlign: 'center', color: MUTED,
    fontSize: 11, fontStyle: 'italic', marginTop: 4,
  },

  notRankedBox: {
    backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: BORDER,
    padding: 20, alignItems: 'center', marginTop: 8,
  },
  notRankedText: { color: MUTED, fontSize: 13, textAlign: 'center', lineHeight: 20 },

  loading: { paddingVertical: 60, alignItems: 'center', gap: 12 },
  loadingText: { color: MUTED, fontSize: 13 },
  empty:   { paddingVertical: 60, alignItems: 'center', gap: 10 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: TEXT },
  emptyText:  { fontSize: 13, color: MUTED, textAlign: 'center' },
});