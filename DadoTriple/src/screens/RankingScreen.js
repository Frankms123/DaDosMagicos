/**
 * RankingScreen.js
 * Top 10 del día y de la semana.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Animated, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Trophy, Medal, Award, Calendar, CalendarDays, TrendingUp, Star } from 'lucide-react-native';
import useGameStore from '../store/useGameStore';
import { API_URL } from '../services/apiService';
import { playSound } from '../services/soundService';
import MagicBackground from '../components/MagicBackground';
import { colors, shadows } from '../theme';

const BG     = colors.bg;
const CARD   = colors.card;
const BORDER = colors.border;
const TEXT   = colors.text;
const MUTED  = colors.muted;
const PURPLE = colors.purple;
const GOLD   = colors.gold;
const SILVER = colors.silver ?? '#94A3B8';
const BRONZE = colors.bronze ?? '#CD7C3E';
const GREEN  = colors.green;

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

  const posColors = [GOLD, SILVER, BRONZE];
  const posColor  = posColors[position - 1] ?? MUTED;

  const RankIcon = position === 1 ? Trophy : position === 2 ? Medal : position === 3 ? Award : null;

  return (
    <Animated.View style={[
      styles.row,
      isMe         && styles.rowMe,
      isOutsideTop && styles.rowOutside,
      position === 1 && styles.rowFirst,
      position === 2 && styles.rowSecond,
      position === 3 && styles.rowThird,
      { opacity: fade, transform: [{ translateX: slide }] },
    ]}>
      <View style={[styles.posBox, position <= 3 && { borderColor: posColor + '60', backgroundColor: posColor + '15' }]}>
        {RankIcon
          ? <RankIcon size={16} color={posColor} />
          : <Text style={[styles.posNum, { color: isMe ? PURPLE : posColor }]}>{position}</Text>}
      </View>

      <Text style={[styles.name, isMe && styles.nameMe]} numberOfLines={1}>
        {player.name}{isMe ? '  (tú)' : ''}
      </Text>

      <View style={styles.rightCol}>
        <Text style={[styles.score, position === 1 && { color: GOLD }, isMe && !RankIcon && { color: PURPLE }]}>
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
  const [tab,       setTab]       = useState('daily');
  const [ranking,   setRanking]   = useState([]);
  const [myPos,     setMyPos]     = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [refreshing,setRefreshing]= useState(false);
  const tabAnim = useRef(new Animated.Value(0)).current;
  const { dayLabel, weekLabel } = getPeriodLabels();

  useEffect(() => {
    playSound('ambient', 0.3);
  }, []);

  const fetchRanking = async (period, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const name = encodeURIComponent(playerName || '');
      const resp = await fetch(`${API_URL}/stats/ranking/${period}?name=${name}`);
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
    if (t === tab) return;
    playSound('click', 0.45);
    setTab(t);
    Animated.spring(tabAnim, {
      toValue: t === 'daily' ? 0 : 1,
      useNativeDriver: false, tension: 80, friction: 12,
    }).start();
  };

  const myInTop = playerName && ranking.some(p => p.name === playerName);
  const indicatorLeft = tabAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '50%'] });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <MagicBackground intensity={0.6} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerIconWrap}>
          <Trophy size={22} color={GOLD} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Ranking</Text>
          <Text style={styles.headerSub}>{tab === 'daily' ? dayLabel : weekLabel}</Text>
        </View>
        <TrendingUp size={18} color={PURPLE} />
      </View>

      {/* Tabs */}
      <View style={styles.tabsWrapper}>
        <View style={styles.tabs}>
          <Animated.View style={[styles.tabIndicator, { left: indicatorLeft }]} />
          <TouchableOpacity style={styles.tab} onPress={() => switchTab('daily')} activeOpacity={0.7}>
            <Calendar size={14} color={tab === 'daily' ? TEXT : MUTED} style={{ marginRight: 6 }} />
            <Text style={[styles.tabText, tab === 'daily' && styles.tabTextActive]}>Hoy</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tab} onPress={() => switchTab('weekly')} activeOpacity={0.7}>
            <CalendarDays size={14} color={tab === 'weekly' ? TEXT : MUTED} style={{ marginRight: 6 }} />
            <Text style={[styles.tabText, tab === 'weekly' && styles.tabTextActive]}>Esta semana</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { playSound('click', 0.3); fetchRanking(tab, true); }} tintColor={PURPLE} />}
      >
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={PURPLE} size="large" />
            <Text style={styles.loadingText}>Cargando ranking...</Text>
          </View>
        ) : ranking.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIconWrap}>
              <Trophy size={40} color={GOLD + '60'} />
            </View>
            <Text style={styles.emptyTitle}>
              {tab === 'daily' ? 'Sin partidas hoy' : 'Sin partidas esta semana'}
            </Text>
            <Text style={styles.emptyText}>Juega una partida para aparecer aquí</Text>
          </View>
        ) : (
          <>
            <Text style={styles.sectionLabel}>TOP 10</Text>
            {ranking.map((p, i) => (
              <RankRow key={p.name} player={p} position={i + 1} isMe={p.name === playerName} delay={i * 60} />
            ))}

            {!myInTop && myPos && playerName && (
              <>
                <View style={styles.separator}>
                  <View style={styles.separatorLine} />
                  <Text style={styles.separatorText}>· · ·</Text>
                  <View style={styles.separatorLine} />
                </View>
                <Text style={styles.myPosNote}>Tu posición actual</Text>
                <RankRow
                  player={{ name: playerName, periodScore: myPos.score, games: 0 }}
                  position={myPos.position} isMe isOutsideTop
                />
                <Text style={styles.totalNote}>Posición {myPos.position} de {myPos.total} jugadores</Text>
              </>
            )}

            {!myInTop && !myPos && playerName && (
              <View style={styles.notRankedBox}>
                <Star size={22} color={MUTED} style={{ marginBottom: 8 }} />
                <Text style={styles.notRankedText}>
                  Aún no tienes puntos {tab === 'daily' ? 'hoy' : 'esta semana'}.{'\n'}
                  Juega para aparecer en el ranking.
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
  safe:  { flex: 1, backgroundColor: BG },

  header: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: CARD, borderBottomWidth: 1, borderBottomColor: BORDER,
    paddingHorizontal: 20, paddingVertical: 14, gap: 12,
    ...shadows.purple,
  },
  headerIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: GOLD + '15', borderWidth: 1, borderColor: GOLD + '40',
    alignItems: 'center', justifyContent: 'center',
  },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: '900', color: TEXT },
  headerSub:   { fontSize: 11, color: MUTED, marginTop: 2, fontStyle: 'italic' },

  tabsWrapper: { paddingHorizontal: 16, paddingVertical: 10 },
  tabs: {
    flexDirection: 'row', backgroundColor: CARD,
    borderRadius: 14, padding: 3,
    position: 'relative', overflow: 'hidden',
    borderWidth: 1, borderColor: BORDER,
    ...shadows.purple,
  },
  tabIndicator: {
    position: 'absolute', top: 3, bottom: 3, width: '50%',
    backgroundColor: PURPLE, borderRadius: 11,
  },
  tab:          { flex: 1, flexDirection: 'row', paddingVertical: 11, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  tabText:      { fontSize: 13, fontWeight: '700', color: MUTED },
  tabTextActive:{ color: TEXT },

  scroll:  { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: 16, paddingBottom: 16 },

  sectionLabel: {
    fontSize: 9, fontWeight: '700', color: MUTED,
    letterSpacing: 2, marginBottom: 10, marginTop: 4,
  },

  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: CARD, borderRadius: 14,
    borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 14, paddingVertical: 12,
    marginBottom: 8, gap: 12,
  },
  rowMe:     { borderColor: PURPLE, backgroundColor: PURPLE + '0D' },
  rowFirst:  { borderColor: GOLD   + '55', backgroundColor: GOLD   + '08', ...shadows.gold },
  rowSecond: { borderColor: SILVER + '40', backgroundColor: SILVER + '06' },
  rowThird:  { borderColor: BRONZE + '40', backgroundColor: BRONZE + '06' },
  rowOutside:{ borderStyle: 'dashed', borderColor: PURPLE },

  posBox: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: CARD, borderWidth: 1, borderColor: BORDER,
    alignItems: 'center', justifyContent: 'center',
  },
  posNum:  { fontSize: 15, fontWeight: '800' },
  name:    { flex: 1, fontSize: 15, fontWeight: '700', color: TEXT },
  nameMe:  { color: '#C4B5FD' },
  rightCol:{ alignItems: 'flex-end' },
  score:   { fontSize: 18, fontWeight: '800', color: MUTED },
  games:   { fontSize: 10, color: MUTED, marginTop: 1 },

  separator: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 8 },
  separatorLine: { flex: 1, height: 1, backgroundColor: BORDER },
  separatorText: { color: BORDER, fontSize: 14, letterSpacing: 4 },

  myPosNote: { fontSize: 9, fontWeight: '700', color: PURPLE, letterSpacing: 2, marginBottom: 6, textAlign: 'center' },
  totalNote: { textAlign: 'center', color: MUTED, fontSize: 11, fontStyle: 'italic', marginTop: 4 },

  notRankedBox: {
    backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: BORDER,
    padding: 24, alignItems: 'center', marginTop: 8,
  },
  notRankedText: { color: MUTED, fontSize: 13, textAlign: 'center', lineHeight: 20 },

  loading: { paddingVertical: 60, alignItems: 'center', gap: 12 },
  loadingText: { color: MUTED, fontSize: 13 },
  empty:   { paddingVertical: 60, alignItems: 'center', gap: 10 },
  emptyIconWrap: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: GOLD + '10', borderWidth: 1, borderColor: GOLD + '30',
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: TEXT },
  emptyText:  { fontSize: 13, color: MUTED, textAlign: 'center' },
});