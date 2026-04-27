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
import { LogOut, ShieldCheck, Trophy, Award, Medal, TrendingUp, BarChart3, Target } from 'lucide-react-native';
import useGameStore from '../store/useGameStore';
import { API_URL } from '../services/apiService';

const BG     = '#0F0F1A';
const CARD   = '#1A1A2E';
const BORDER = '#2A2A45';
const TEXT   = '#E2E8F0';
const MUTED  = '#64748B';
const PURPLE = '#7C3AED';
const GOLD   = '#F59E0B';
const GREEN  = '#10B981';

const AVATAR_COLORS = [
  '#7C3AED','#F59E0B','#10B981','#EF4444','#3B82F6','#EC4899',
];

function avatarColor(name) {
  if (!name) return PURPLE;
  let h = 0; for (const c of name) h += c.charCodeAt(0);
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function StatCard({ value, label, color = TEXT, emoji }) {
  return (
    <View style={styles.statCard}>
      {emoji && <Text style={styles.statEmoji}>{emoji}</Text>}
      <Text style={[styles.statValue, { color }]}>{value ?? 0}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function ProfileScreen({ navigation }) {
  const playerName  = useGameStore(s => s.playerName);
  const [stats,    setStats]    = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);

  const handleLogout = () => {
    useGameStore.setState({ playerName: null });
    navigation.navigate('Lobby');
  };

  const fetchStats = async () => {
    if (!playerName) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`${API_URL}/stats/player/${encodeURIComponent(playerName)}`);
      const data = await resp.json();
      if (resp.ok) setStats(data.stats);
      else setError('No se encontró el perfil.');
    } catch (e) {
      setError('Error al cargar el perfil.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStats(); }, [playerName]);

  const initial = playerName?.[0]?.toUpperCase() ?? '?';
  const color   = avatarColor(playerName);

  // Calcular tasa de victorias
  const winRate = stats && stats.gamesPlayed > 0
    ? Math.round((stats.wins / stats.gamesPlayed) * 100)
    : 0;
  const podiumRate = stats && stats.gamesPlayed > 0
    ? Math.round((stats.podiums / stats.gamesPlayed) * 100)
    : 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={[styles.avatar, { backgroundColor: color }]}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <Text style={styles.playerName}>{playerName ?? 'Jugador'}</Text>
          {stats && (
            <View style={styles.levelBadge}>
              <Text style={styles.levelText}>
                {stats.wins >= 10 ? '👑 Leyenda'
                 : stats.wins >= 5  ? '🔥 Experto'
                 : stats.podiums >= 5 ? '⭐ Veterano'
                 : stats.gamesPlayed >= 1 ? '🎲 Jugador'
                 : '🌱 Novato'}
              </Text>
            </View>
          )}
        </View>

        {loading && (
          <View style={styles.loading}>
            <ActivityIndicator color={PURPLE} size="large" />
            <Text style={styles.loadingText}>Cargando perfil...</Text>
          </View>
        )}

        {error && !loading && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={fetchStats}>
              <Text style={styles.retryBtnText}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        )}

        {!loading && !error && !stats && (
          <View style={styles.noProfile}>
            <Text style={styles.noProfileEmoji}>🎲</Text>
            <Text style={styles.noProfileTitle}>Sin historial aún</Text>
            <Text style={styles.noProfileText}>
              Juega una partida y queda en el podio para acumular puntos en tu perfil.
            </Text>
          </View>
        )}

        {stats && !loading && (
          <>
            {/* Puntos totales */}
            <View style={styles.totalScoreCard}>
              <Text style={styles.totalScoreLabel}>PUNTOS TOTALES</Text>
              <Text style={styles.totalScoreValue}>{stats.totalScore ?? 0}</Text>
              <Text style={styles.totalScoreSub}>acumulados en todas las partidas</Text>
            </View>

            {/* Grid de stats */}
            <Text style={styles.sectionLabel}>ESTADÍSTICAS</Text>
            <View style={styles.statsGrid}>
              <StatCard value={stats.gamesPlayed} label="partidas" emoji="🎲" />
              <StatCard value={stats.podiums}     label="podios"   emoji="🏅" color={GOLD} />
              <StatCard value={stats.wins}         label="victorias" emoji="🥇" color={GOLD} />
              <StatCard value={`${podiumRate}%`}  label="% podio"  emoji="📈" color={GREEN} />
            </View>

            {/* Tasa de victoria */}
            <View style={styles.rateCard}>
              <View style={styles.rateRow}>
                <Text style={styles.rateLabel}>Tasa de victoria</Text>
                <Text style={[styles.rateValue, { color: winRate >= 50 ? GREEN : MUTED }]}>
                  {winRate}%
                </Text>
              </View>
              <View style={styles.rateBar}>
                <View style={[styles.rateFill, {
                  width: `${Math.min(winRate, 100)}%`,
                  backgroundColor: winRate >= 50 ? GREEN : PURPLE,
                }]} />
              </View>

              <View style={[styles.rateRow, { marginTop: 14 }]}>
                <Text style={styles.rateLabel}>Tasa de podio</Text>
                <Text style={[styles.rateValue, { color: podiumRate >= 50 ? GOLD : MUTED }]}>
                  {podiumRate}%
                </Text>
              </View>
              <View style={styles.rateBar}>
                <View style={[styles.rateFill, {
                  width: `${Math.min(podiumRate, 100)}%`,
                  backgroundColor: podiumRate >= 50 ? GOLD : PURPLE,
                }]} />
              </View>
            </View>

            {/* Insignias */}
            <Text style={styles.sectionLabel}>INSIGNIAS</Text>
            <View style={styles.badgesGrid}>
              {[
                { cond: stats.gamesPlayed >= 1,  emoji: '🎲', label: 'Primera partida' },
                { cond: stats.podiums >= 1,       emoji: '🏅', label: 'Primer podio' },
                { cond: stats.wins >= 1,           emoji: '🥇', label: 'Primera victoria' },
                { cond: stats.wins >= 5,           emoji: '🔥', label: '5 victorias' },
                { cond: stats.wins >= 10,          emoji: '👑', label: 'Leyenda' },
                { cond: stats.gamesPlayed >= 10,  emoji: '⭐', label: '10 partidas' },
                { cond: stats.totalScore >= 100,  emoji: '💯', label: '100 puntos' },
                { cond: podiumRate >= 75,          emoji: '🎯', label: 'Podio constante' },
              ].map((b, i) => (
                <View key={i} style={[styles.badge, !b.cond && styles.badgeLocked]}>
                  <Text style={[styles.badgeEmoji, !b.cond && { opacity: 0.25 }]}>
                    {b.emoji}
                  </Text>
                  <Text style={[styles.badgeLabel, !b.cond && styles.badgeLabelLocked]}>
                    {b.label}
                  </Text>
                </View>
              ))}
            </View>
            {/* Cerrar Sesión */}
            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
              <LogOut size={20} color="#EF4444" />
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
  scroll:  { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 20 },

  // Avatar
  avatarSection: { alignItems: 'center', paddingTop: 28, paddingBottom: 20 },
  avatar: {
    width: 90, height: 90, borderRadius: 45,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
    shadowColor: PURPLE, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4, shadowRadius: 16, elevation: 10,
  },
  avatarText:  { fontSize: 40, fontWeight: '900', color: '#fff' },
  playerName:  { fontSize: 26, fontWeight: '900', color: TEXT, marginBottom: 8 },
  levelBadge: {
    backgroundColor: PURPLE + '20', borderRadius: 12,
    borderWidth: 1, borderColor: PURPLE + '40',
    paddingHorizontal: 14, paddingVertical: 5,
  },
  levelText: { fontSize: 13, fontWeight: '700', color: '#C4B5FD' },

  loading:     { paddingVertical: 40, alignItems: 'center', gap: 12 },
  loadingText: { color: MUTED, fontSize: 13 },

  errorBox: {
    backgroundColor: '#EF444415', borderRadius: 14,
    borderWidth: 1, borderColor: '#EF444440',
    padding: 20, alignItems: 'center', gap: 12, marginTop: 12,
  },
  errorText:    { color: '#EF4444', fontSize: 13, textAlign: 'center' },
  retryBtn:     { backgroundColor: PURPLE, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 8 },
  retryBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  noProfile:      { alignItems: 'center', paddingVertical: 48, gap: 10 },
  noProfileEmoji: { fontSize: 48 },
  noProfileTitle: { fontSize: 18, fontWeight: '800', color: TEXT },
  noProfileText:  { fontSize: 13, color: MUTED, textAlign: 'center', lineHeight: 20 },

  // Total score
  totalScoreCard: {
    backgroundColor: GOLD + '10', borderRadius: 20,
    borderWidth: 1.5, borderColor: GOLD + '40',
    padding: 24, alignItems: 'center', marginBottom: 24,
    shadowColor: GOLD, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2, shadowRadius: 12, elevation: 6,
  },
  totalScoreLabel: { fontSize: 10, fontWeight: '700', color: GOLD + 'AA', letterSpacing: 2 },
  totalScoreValue: { fontSize: 56, fontWeight: '900', color: GOLD, lineHeight: 70 },
  totalScoreSub:   { fontSize: 11, color: MUTED },

  sectionLabel: {
    fontSize: 9, fontWeight: '700', color: MUTED,
    letterSpacing: 2, marginBottom: 12,
  },

  // Stats grid
  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24,
  },
  statCard: {
    width: '47%', backgroundColor: CARD,
    borderRadius: 16, borderWidth: 1, borderColor: BORDER,
    padding: 16, alignItems: 'center',
  },
  statEmoji: { fontSize: 24, marginBottom: 6 },
  statValue: { fontSize: 28, fontWeight: '900', color: TEXT },
  statLabel: { fontSize: 11, color: MUTED, marginTop: 2 },

  // Rate card
  rateCard: {
    backgroundColor: CARD, borderRadius: 16,
    borderWidth: 1, borderColor: BORDER,
    padding: 16, marginBottom: 24,
  },
  rateRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  rateLabel: { fontSize: 13, fontWeight: '600', color: TEXT },
  rateValue: { fontSize: 18, fontWeight: '800' },
  rateBar:  { height: 6, backgroundColor: BORDER, borderRadius: 3, overflow: 'hidden' },
  rateFill: { height: 6, borderRadius: 3 },

  // Badges
  badgesGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
  },
  badge: {
    width: '22%', backgroundColor: CARD,
    borderRadius: 12, borderWidth: 1, borderColor: BORDER,
    padding: 10, alignItems: 'center', gap: 4,
  },
  badgeLocked:      { backgroundColor: BORDER + '30', borderColor: BORDER + '40' },
  badgeEmoji:       { fontSize: 24 },
  badgeLabel:       { fontSize: 9, fontWeight: '700', color: MUTED, textAlign: 'center', lineHeight: 12 },
  badgeLabelLocked: { color: BORDER },
  
  // Logout
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, marginTop: 20, paddingVertical: 16,
    borderWidth: 1, borderColor: '#EF444440', borderRadius: 16,
    backgroundColor: '#EF444410',
  },
  logoutText: { color: '#EF4444', fontSize: 15, fontWeight: '700' },
});