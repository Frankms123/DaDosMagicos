import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  Animated, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  Dices, PlusCircle, Key, Eye, AlertCircle, 
  Gamepad2, User, ShieldCheck, Share2
} from 'lucide-react-native';
import socketService from '../services/socketService';
import { playSound } from '../services/soundService';
import useGameStore from '../store/useGameStore';
import MagicBackground from '../components/MagicBackground';
import GameButton from '../components/GameButton';
import DiceFace from '../components/DiceFace';
import {colors, shadows} from '../theme';

// ─── Constantes de diseño ─────────────────────────────────────────────────────
const BG       = colors.bg;
const CARD     = colors.card;
const BORDER   = colors.border;
const TEXT     = colors.text;
const MUTED    = colors.muted;
const PURPLE   = colors.purple;
const GOLD     = colors.gold;
const SUCCESS  = colors.green;
const DANGER   = colors.red;

// ─── Componente: Indicador de conexión ───────────────────────────────────────
function ConnectionDot({ connected }) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!connected) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.5, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [connected]);

  return (
    <View style={styles.dotWrapper}>
      <Animated.View
        style={[
          styles.dotOuter,
          { backgroundColor: (connected ? SUCCESS : DANGER) + '33',
            transform: [{ scale: pulse }] },
        ]}
      />
      <View style={[styles.dotInner, { backgroundColor: connected ? SUCCESS : DANGER }]} />
    </View>
  );
}

// ─── Componente: Campo de entrada ────────────────────────────────────────────
function Field({ label, value, onChangeText, placeholder, keyboardType, autoCapitalize, maxLength, style, inputStyle, icon: IconComponent }) {
  const [focused, setFocused] = useState(false);
  const borderAnim = useRef(new Animated.Value(0)).current;

  const handleFocus = () => {
    setFocused(true);
    Animated.timing(borderAnim, { toValue: 1, duration: 200, useNativeDriver: false }).start();
  };
  const handleBlur = () => {
    setFocused(false);
    Animated.timing(borderAnim, { toValue: 0, duration: 200, useNativeDriver: false }).start();
  };

  const borderColor = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [BORDER, PURPLE],
  });

  return (
    <View style={[styles.fieldWrapper, style]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Animated.View style={[styles.fieldBorder, { borderColor }]}>
        {IconComponent && (
          <View style={styles.fieldIcon}>
            <IconComponent size={18} color={focused ? PURPLE : MUTED} />
          </View>
        )}
        <TextInput
          style={[styles.fieldInput, inputStyle]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={MUTED}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize || 'none'}
          autoCorrect={false}
          maxLength={maxLength}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
      </Animated.View>
    </View>
  );
}

export default function LobbyScreen() {
  const playerName = useGameStore(s => s.playerName);
  const isConnected = useGameStore(s => s.isConnected);

  const [tab, setTab] = useState('create');
  const [localName, setLocalName] = useState(playerName || '');
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();
    if (!isConnected) socketService.connect();
  }, []);

  const shakeError = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const switchTab = (t) => {
    playSound('click', 0.55);
    setTab(t);
    setError(null);
    const targets = { create: 0, join: 1, spectator: 2 };
    Animated.spring(tabIndicator, {
      toValue: targets[t],
      useNativeDriver: false,
      tension: 80, friction: 12,
    }).start();
  };

  const validate = () => {
    if (!playerName.trim()) {
      setError('Ingresa tu nombre para continuar');
      shakeError();
      return false;
    }
    if (playerName.trim().length < 2) {
      setError('El nombre debe tener al menos 2 caracteres');
      shakeError();
      return false;
    }
    if ((tab === 'join' || tab === 'spectator') && roomCode.trim().length < 4) {
      setError('El código de sala debe tener 4 caracteres');
      shakeError();
      return false;
    }
    return true;
  };

  const handleCreate = () => {
    playSound('click', 0.65);
    if (!validate()) return;
    setError(null);
    setLoading(true);
    socketService.createRoom(finalName.trim(), 4);
    setTimeout(() => setLoading(false), 5000);
  };

  const handleJoin = () => {
    playSound('click', 0.65);
    if (!validate()) return;
    setError(null);
    setLoading(true);
    socketService.joinRoom(roomCode.trim().toUpperCase(), finalName.trim());
    setTimeout(() => setLoading(false), 5000);
  };

  const handleSpectator = () => {
    playSound('click', 0.65);
    if (!validate()) return;
    setError(null);
    setLoading(true);
    const finalName = playerName || localName || 'Espectador';
    socketService.joinAsSpectator(roomCode.trim().toUpperCase(), finalName);
    setTimeout(() => setLoading(false), 5000);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <MagicBackground intensity={1.1} />
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* ── Header ── */}
        <Animated.View style={[styles.header, { transform: [{ scale: logoAnim }], opacity: logoAnim }]}>
          <View style={styles.logoMark}>
            <DiceFace value={3} size={62} pipColor={GOLD} faceColor={CARD} borderColor={GOLD + '88'} />
          </View>
          <Text style={styles.title}>Dado Triple</Text>
          <Text style={styles.subtitle}>El Plan del Diablo</Text>

          {/* Indicador de conexión */}
          <View style={styles.connectionRow}>
            <ConnectionDot connected={isConnected} />
            <Text style={[styles.connectionText, { color: isConnected ? SUCCESS : MUTED }]}>
              {isConnected ? 'En Línea' : 'Desconectado'}
            </Text>
          </View>

        {/* ── Card principal ── */}
        <Animated.View
          style={[
            styles.card,
            { opacity: cardOpacity, transform: [{ translateY: cardAnim }] },
          ]}
        >
          {/* Tabs */}
          <View style={styles.tabs}>
            <Animated.View style={[styles.tabIndicator, { left: indicatorLeft, width: `${tabWidth}%` }]} />
            {['create', 'join', 'spectator'].map((t) => (
              <TouchableOpacity key={t} style={styles.tab} onPress={() => switchTab(t)} activeOpacity={0.7}>
                <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                  {t === 'create' ? '+ Crear' : t === 'join' ? '→ Unirse' : 'Ver'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.card}>
            {!playerName ? (
              <Field 
                label="TU NOMBRE"
                value={localName}
                onChangeText={setLocalName}
                placeholder="Ej. Frank Mora"
                icon={User}
                style={{ marginBottom: 20 }}
              />
            ) : (
              <View style={styles.greetingBox}>
                <View style={styles.userAvatar}><ShieldCheck size={20} color={PURPLE} /></View>
                <View>
                  <Text style={styles.greetingLabel}>JUGANDO COMO</Text>
                  <Text style={styles.greetingName}>{playerName}</Text>
                </View>
              </View>
            )}

            {(tab === 'join' || tab === 'spectator') && (
              <Field 
                label="CÓDIGO DE SALA"
                value={roomCode}
                onChangeText={(t) => setRoomCode(t.toUpperCase())}
                placeholder="ABCD"
                maxLength={4}
                autoCapitalize="characters"
                icon={Gamepad2}
                inputStyle={styles.codeInputStyle}
              />
            )}

            <View style={styles.actions}>
              {loading ? (
                <ActivityIndicator color={PURPLE} size="large" />
              ) : (
                <TouchableOpacity 
                  style={[
                    styles.actionBtn,
                    tab === 'create' ? styles.actionBtnCreate : 
                    tab === 'join' ? styles.actionBtnJoin : styles.actionBtnSpectator,
                    (!isConnected) && styles.actionBtnDisabled
                  ]}
                  onPress={tab === 'create' ? handleCreate : tab === 'join' ? handleJoin : handleSpectator}
                  disabled={!isConnected}
                >
                  <Text style={styles.actionBtnText}>
                    {tab === 'create' ? 'CREAR PARTIDA' : tab === 'join' ? 'ENTRAR A LA SALA' : 'VER PARTIDA'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Error */}
          {error && (
            <Animated.View style={[styles.errorBox, { transform: [{ translateX: errorShake }] }]}>
              <Text style={styles.errorText}>{error}</Text>
            </Animated.View>
          )}

          {/* Botón de acción */}
          <GameButton
            style={[
              styles.actionBtn,
              tab === 'join'      && styles.actionBtnJoin,
              tab === 'spectator' && styles.actionBtnSpectator,
              loading && styles.actionBtnDisabled,
            ]}
            onPress={tab === 'create' ? handleCreate : tab === 'join' ? handleJoin : handleSpectator}
            disabled={loading}
            sound={null}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.actionBtnText}>
                {tab === 'create'    ? 'Crear sala'
                 : tab === 'join'    ? 'Unirse'
                 : 'Entrar como espectador'}
              </Text>
            )}
          </GameButton>
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  root: {
    flex: 1, backgroundColor: 'transparent',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 24,
  },

  // Header
  header: { alignItems: 'center', marginBottom: 32 },
  logoMark: {
    width: 74, height: 74, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    backgroundColor: GOLD + '10', borderWidth: 1, borderColor: GOLD + '40', marginBottom: 10,
  },
  title: { fontSize: 32, fontWeight: '900', color: TEXT, letterSpacing: 1 },
  subtitle: { fontSize: 13, color: MUTED, marginTop: 4, letterSpacing: 0.5 },
  connectionRow: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 14, gap: 8,
  },
  dotWrapper: { width: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  dotOuter: { position: 'absolute', width: 16, height: 16, borderRadius: 8 },
  dotInner: { width: 8, height: 8, borderRadius: 4 },
  connectionText: { fontSize: 12, fontWeight: '600' },

  // Card
  card: {
    width: '100%', backgroundColor: CARD,
    borderRadius: 24, borderWidth: 1, borderColor: BORDER,
    padding: 22,
    ...shadows.purple,
  },
  dotWrapper: { width: 14, height: 14, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  dotOuter: { position: 'absolute', width: 14, height: 14, borderRadius: 7 },
  dotInner: { width: 6, height: 6, borderRadius: 3 },
  connectionText: { fontSize: 10, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  tabContainer: { 
    flexDirection: 'row', backgroundColor: CARD, borderRadius: 16, 
    padding: 6, marginBottom: 20, borderWidth: 1, borderColor: BORDER 
  },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 12, gap: 8 },
  tabActive: { backgroundColor: BORDER },
  tabIcon: { opacity: 0.8 },
  tabText: { fontSize: 13, fontWeight: '700', color: MUTED },
  tabTextActive: { color: TEXT },
  card: { backgroundColor: CARD, borderRadius: 24, padding: 24, borderWidth: 1, borderColor: BORDER },
  greetingBox: { 
    flexDirection: 'row', alignItems: 'center', backgroundColor: BG, 
    padding: 16, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: BORDER 
  },
  errorText: { fontSize: 13, color: DANGER, fontWeight: '600' },

  // Botón
  actionBtn: {
    backgroundColor: PURPLE, borderRadius: 14,
    paddingVertical: 17, alignItems: 'center',
    shadowColor: PURPLE, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5, shadowRadius: 12, elevation: 8,
  },
  actionBtnJoin:      { backgroundColor: SUCCESS, shadowColor: SUCCESS },
  actionBtnSpectator: { backgroundColor: GOLD,    shadowColor: GOLD },
  actionBtnDisabled:  { opacity: 0.55 },
  actionBtnText: { fontSize: 16, fontWeight: '700', color: '#fff', letterSpacing: 0.3 },

  footer: { marginTop: 28, fontSize: 11, color: BORDER },
});
  userAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: BORDER, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  greetingLabel: { fontSize: 10, fontWeight: '800', color: MUTED, letterSpacing: 1 },
  greetingName: { fontSize: 18, fontWeight: '700', color: TEXT },
  fieldWrapper: { width: '100%' },
  fieldLabel: { fontSize: 11, fontWeight: '800', color: MUTED, marginBottom: 8, marginLeft: 4, letterSpacing: 1 },
  fieldBorder: { flexDirection: 'row', alignItems: 'center', backgroundColor: BG, borderRadius: 16, borderWidth: 1.5, paddingHorizontal: 16 },
  fieldIcon: { marginRight: 12 },
  fieldInput: { flex: 1, height: 56, fontSize: 16, color: TEXT, fontWeight: '600' },
  codeInputStyle: { fontSize: 24, letterSpacing: 8, textAlign: 'center', fontWeight: '900', color: GOLD },
  actions: { marginTop: 24 },
  actionBtn: { borderRadius: 18, paddingVertical: 18, alignItems: 'center' },
  actionBtnCreate: { backgroundColor: PURPLE },
  actionBtnJoin: { backgroundColor: SUCCESS },
  actionBtnSpectator: { backgroundColor: GOLD },
  actionBtnDisabled: { opacity: 0.5 },
  actionBtnText: { fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  footerInfo: { alignItems: 'center', marginTop: 32 },
  footer: { fontSize: 12, color: MUTED, textAlign: 'center' },
});
