/**
 * ProfileScreen.js
 * Perfil del jugador con estadísticas globales.
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  LogOut, ShieldCheck, Trophy, Medal, Award,
  TrendingUp, BarChart3, Target, Star, Zap,
  Gamepad2, Crown, Lock, BookOpen,
} from 'lucide-react-native';
import useGameStore from '../store/useGameStore';
import { API_URL } from '../services/apiService';
import { playSound } from '../services/soundService';
import MagicBackground from '../components/MagicBackground';
import AnimatedNumber from '../components/AnimatedNumber';
import { colors, shadows } from '../theme';

const BG     = colors.bg;
const CARD   = colors.card;
const BORDER = colors.border;
const TEXT   = colors.text;
const MUTED  = colors.muted;
const PURPLE = colors.purple;
const GOLD   = colors.gold;
const GREEN  = colors.green;
const RED    = colors.red;

const AVATAR_COLORS = ['#7C3AED','#F59E0B','#10B981','#EF4444','#3B82F6','#EC4899'];
function avatarColor(name) {
  if (!name) return PURPLE;
  let h = 0; for (const c of name) h += c.charCodeAt(0);
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ value, label, color, icon: Icon }) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIconWrap, { backgroundColor: (color ?? PURPLE) + '15', borderColor: (color ?? PURPLE) + '30' }]}>
        {Icon && <Icon size={20} color={color ?? PURPLE} />}
      </View>
      <Text style={[styles.statValue, { color: color ?? TEXT }]}>{value ?? 0}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── Badge de insignia ────────────────────────────────────────────────────────
function Badge({ cond, icon: Icon, label, color }) {
  const c = cond ? (color ?? GOLD) : BORDER;
  return (
    <View style={[styles.badge, !cond && styles.badgeLocked]}>
      <View style={[styles.badgeIconWrap, { backgroundColor: c + '18', borderColor: c + '40' }]}>
        <Icon size={20} color={cond ? c : BORDER} />
      </View>
      <Text style={[styles.badgeLabel, !cond && styles.badgeLabelLocked]}>{label}</Text>
    </View>
  );
}

// ─── Barra de tasa ───────────────────────────────────────────────────────────
function RateBar({ label, value, color, icon: Icon }) {
  return (
    <View style={styles.rateItem}>
      <View style={styles.rateRow}>
        <Icon size={14} color={color} style={{ marginRight: 6 }} />
        <Text style={styles.rateLabel}>{label}</Text>
        <Text style={[styles.rateValue, { color }]}>{value}%</Text>
      </View>
      <View style={styles.rateBar}>
        <View style={[styles.rateFill, { width: `${Math.min(value, 100)}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

// ─── Pantalla principal ───────────────────────────────────────────────────────
export default function ProfileScreen({ navigation }) {
  const playerName = useGameStore(s => s.playerName);
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  useEffect(() => { playSound('ambient', 0.25); }, []);

  const fetchStats = async () => {
    if (!playerName) return;
    setLoading(true); setError(null);
    try {
      const resp = await fetch(`${API_URL}/stats/player/${encodeURIComponent(playerName)}`);
      const data = await resp.json();
      if (resp.ok) setStats(data.stats);
      else setError('No se encontró el perfil.');
    } catch { setError('Error al cargar el perfil.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchStats(); }, [playerName]);

  const handleLogout = () => {
    playSound('click', 0.55);
    useGameStore.setState({ playerName: null });
    navigation.navigate('Auth');
  };

  const initial   = playerName?.[0]?.toUpperCase() ?? '?';
  const color     = avatarColor(playerName);
  const winRate   = stats?.gamesPlayed > 0 ? Math.round((stats.wins   / stats.gamesPlayed) * 100) : 0;
  const podiumRate= stats?.gamesPlayed > 0 ? Math.round((stats.podiums / stats.gamesPlayed) * 100) : 0;

  const levelLabel =
    stats?.wins >= 10       ? 'Leyenda'   :
    stats?.wins >= 5        ? 'Experto'   :
    stats?.podiums >= 5     ? 'Veterano'  :
    stats?.gamesPlayed >= 1 ? 'Jugador'   : 'Novato';

  const levelIcon =
    stats?.wins >= 10 ? Crown :
    stats?.wins >= 5  ? Zap   :
    stats?.podiums >= 5 ? Star : Gamepad2;

  const LevelIcon = levelIcon;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <MagicBackground intensity={0.55} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Avatar ── */}
        <View style={styles.avatarSection}>
          <View style={[styles.avatarRing, { borderColor: color + '60' }]}>
            <View style={[styles.avatar, { backgroundColor: color }]}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
          </View>
          <Text style={styles.playerNameText}>{playerName ?? 'Jugador'}</Text>
          {stats && (
            <View style={[styles.levelBadge, { borderColor: color + '50', backgroundColor: color + '15' }]}>
              <LevelIcon size={14} color={color} />
              <Text style={[styles.levelText, { color }]}>{levelLabel}</Text>
            </View>
          )}
        </View>

        {/* ── Loading / Error / Empty ── */}
        {loading && (
          <View style={styles.stateBox}>
            <ActivityIndicator color={PURPLE} size="large" />
            <Text style={styles.stateText}>Cargando perfil...</Text>
          </View>
        )}

        {error && !loading && (
          <View style={[styles.stateBox, styles.errorBox]}>
            <Text style={[styles.stateText, { color: RED }]}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={fetchStats}>
              <Text style={styles.retryBtnText}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        )}

        {!loading && !error && !stats && (
          <View style={styles.stateBox}>
            <View style={styles.noProfileIconWrap}>
              <Trophy size={36} color={GOLD + '60'} />
            </View>
            <Text style={styles.noProfileTitle}>Sin historial aún</Text>
            <Text style={styles.noProfileText}>
              Juega y queda en el podio para acumular puntos en tu perfil.
            </Text>
          </View>
        )}

        {stats && !loading && (
          <>
            {/* ── Puntos totales ── */}
            <View style={[styles.totalScoreCard, { ...shadows.gold }]}>
              <View style={styles.totalScoreHeader}>
                <Trophy size={16} color={GOLD} />
                <Text style={styles.totalScoreLabel}>PUNTOS TOTALES</Text>
              </View>
              <AnimatedNumber
                value={stats.totalScore ?? 0}
                suffix=" pts"
                style={styles.totalScoreValue}
              />
              <Text style={styles.totalScoreSub}>acumulados en todas las partidas</Text>
            </View>

            {/* ── Stats grid ── */}
            <Text style={styles.sectionLabel}>ESTADÍSTICAS</Text>
            <View style={styles.statsGrid}>
              <StatCard value={stats.gamesPlayed} label="partidas"  color={PURPLE} icon={Gamepad2} />
              <StatCard value={stats.podiums}     label="podios"    color={GOLD}   icon={Medal}    />
              <StatCard value={stats.wins}        label="victorias" color={GOLD}   icon={Trophy}   />
              <StatCard value={`${podiumRate}%`}  label="% podio"   color={GREEN}  icon={TrendingUp}/>
            </View>

            {/* ── Tasas ── */}
            <View style={styles.rateCard}>
              <RateBar label="Tasa de victoria" value={winRate}    color={winRate    >= 50 ? GREEN : PURPLE} icon={Target}    />
              <View style={styles.rateDivider} />
              <RateBar label="Tasa de podio"    value={podiumRate} color={podiumRate >= 50 ? GOLD  : PURPLE} icon={BarChart3} />
            </View>

            {/* ── Insignias ── */}
            <Text style={styles.sectionLabel}>INSIGNIAS</Text>
            <View style={styles.badgesGrid}>
              <Badge cond={stats.gamesPlayed >= 1}  icon={Gamepad2}   label="Primera partida"  color={PURPLE} />
              <Badge cond={stats.podiums >= 1}       icon={Medal}      label="Primer podio"     color={GOLD}   />
              <Badge cond={stats.wins >= 1}          icon={Trophy}     label="Primera victoria" color={GOLD}   />
              <Badge cond={stats.wins >= 5}          icon={Zap}        label="5 victorias"      color={RED}    />
              <Badge cond={stats.wins >= 10}         icon={Crown}      label="Leyenda"          color={GOLD}   />
              <Badge cond={stats.gamesPlayed >= 10}  icon={Star}       label="10 partidas"      color={PURPLE} />
              <Badge cond={stats.totalScore >= 100}  icon={TrendingUp} label="100 puntos"       color={GREEN}  />
              <Badge cond={podiumRate >= 75}         icon={Target}     label="Podio constante"  color={GREEN}  />
            </View>

            {/* ── Botones de acción ── */}
            <TouchableOpacity 
              style={[styles.logoutBtn, { marginTop: 20, borderColor: PURPLE + '40', backgroundColor: PURPLE + '10' }]} 
              onPress={() => { playSound('click', 0.55); navigation.navigate('Manual'); }}
            >
              <BookOpen size={18} color={PURPLE} />
              <Text style={[styles.logoutText, { color: PURPLE }]}>Ver Manual de Juego</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
              <LogOut size={18} color={RED} />
              <Text style={styles.logoutText}>Cerrar sesión</Text>
            </TouchableOpacity>
          </>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: BG },
  scroll:  { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: 20, paddingBottom: 20 },

  // Avatar
  avatarSection: { alignItems: 'center', paddingTop: 28, paddingBottom: 24 },
  avatarRing: {
    width: 100, height: 100, borderRadius: 50,
    borderWidth: 2.5, alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
  },
  avatar: {
    width: 88, height: 88, borderRadius: 44,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  avatarText:   { fontSize: 38, fontWeight: '900', color: '#fff' },
  playerNameText: { fontSize: 26, fontWeight: '900', color: TEXT, marginBottom: 10 },
  levelBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 6,
  },
  levelText: { fontSize: 13, fontWeight: '700' },

  // States
  stateBox:    { alignItems: 'center', paddingVertical: 48, gap: 12 },
  stateText:   { color: MUTED, fontSize: 13 },
  errorBox:    { backgroundColor: RED + '10', borderRadius: 14, borderWidth: 1, borderColor: RED + '30' },
  retryBtn:    { backgroundColor: PURPLE, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 8 },
  retryBtnText:{ color: '#fff', fontWeight: '700', fontSize: 13 },
  noProfileIconWrap: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: GOLD + '10', borderWidth: 1, borderColor: GOLD + '30',
    alignItems: 'center', justifyContent: 'center',
  },
  noProfileTitle: { fontSize: 18, fontWeight: '800', color: TEXT },
  noProfileText:  { fontSize: 13, color: MUTED, textAlign: 'center', lineHeight: 20 },

  // Total score
  totalScoreCard: {
    backgroundColor: CARD, borderRadius: 20,
    borderWidth: 1.5, borderColor: GOLD + '40',
    padding: 24, alignItems: 'center', marginBottom: 24,
  },
  totalScoreHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  totalScoreLabel:  { fontSize: 10, fontWeight: '800', color: GOLD, letterSpacing: 2 },
  totalScoreValue:  { fontSize: 54, fontWeight: '900', color: GOLD, lineHeight: 68 },
  totalScoreSub:    { fontSize: 11, color: MUTED },

  sectionLabel: { fontSize: 9, fontWeight: '700', color: MUTED, letterSpacing: 2, marginBottom: 12 },

  // Stats grid
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  statCard: {
    width: '47%', backgroundColor: CARD,
    borderRadius: 16, borderWidth: 1, borderColor: BORDER,
    padding: 16, alignItems: 'center', gap: 6,
    ...shadows.purple,
  },
  statIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
    marginBottom: 2,
  },
  statValue: { fontSize: 26, fontWeight: '900', color: TEXT },
  statLabel: { fontSize: 11, color: MUTED },

  // Rate card
  rateCard: {
    backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: BORDER,
    padding: 16, marginBottom: 24, gap: 14,
    ...shadows.purple,
  },
  rateDivider: { height: 1, backgroundColor: BORDER },
  rateItem:    { gap: 8 },
  rateRow:     { flexDirection: 'row', alignItems: 'center' },
  rateLabel:   { flex: 1, fontSize: 13, fontWeight: '600', color: TEXT },
  rateValue:   { fontSize: 16, fontWeight: '800' },
  rateBar:     { height: 6, backgroundColor: BORDER, borderRadius: 3, overflow: 'hidden' },
  rateFill:    { height: 6, borderRadius: 3 },

  // Badges
  badgesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  badge: {
    width: '22%', backgroundColor: CARD,
    borderRadius: 14, borderWidth: 1, borderColor: BORDER,
    padding: 10, alignItems: 'center', gap: 6,
  },
  badgeLocked: { backgroundColor: BG, borderColor: BORDER + '60' },
  badgeIconWrap: {
    width: 40, height: 40, borderRadius: 12, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  badgeLabel:       { fontSize: 9, fontWeight: '700', color: MUTED, textAlign: 'center', lineHeight: 12 },
  badgeLabelLocked: { color: BORDER },

  // Logout
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 16, borderRadius: 16,
    borderWidth: 1, borderColor: RED + '40', backgroundColor: RED + '10',
  },
  logoutText: { color: RED, fontSize: 15, fontWeight: '700' },
});