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
import useGameStore from '../store/useGameStore';

// ─── Constantes de diseño ─────────────────────────────────────────────────────
const BG = '#0F0F1A';
const CARD = '#1A1A2E';
const BORDER = '#2A2A45';
const TEXT = '#E2E8F0';
const MUTED = '#64748B';
const PURPLE = '#7C3AED';
const GOLD = '#F59E0B';
const SUCCESS = '#10B981';
const DANGER = '#EF4444';

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

  const handleCreate = () => {
    const finalName = playerName || localName;
    if (!finalName.trim()) { shakeError(); return; }
    setLoading(true);
    socketService.createRoom(finalName.trim(), 4);
    setTimeout(() => setLoading(false), 5000);
  };

  const handleJoin = () => {
    const finalName = playerName || localName;
    if (!finalName.trim() || roomCode.length < 4) { shakeError(); return; }
    setLoading(true);
    socketService.joinRoom(roomCode.trim().toUpperCase(), finalName.trim());
    setTimeout(() => setLoading(false), 5000);
  };

  const handleSpectator = () => {
    if (roomCode.length < 4) { shakeError(); return; }
    setLoading(true);
    const finalName = playerName || localName || 'Espectador';
    socketService.joinAsSpectator(roomCode.trim().toUpperCase(), finalName);
    setTimeout(() => setLoading(false), 5000);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateX: shakeAnim }] }]}>
          
          <View style={styles.header}>
            <View style={styles.logoCircle}>
              <Dices size={48} color={GOLD} strokeWidth={2.5} />
            </View>
            <Text style={styles.title}>Dado Triple</Text>
            <Text style={styles.subtitle}>EL PLAN DEL DIABLO</Text>
            
            <View style={styles.connectionBadge}>
              <ConnectionDot connected={isConnected} />
              <Text style={[styles.connectionText, { color: isConnected ? SUCCESS : MUTED }]}>
                {isConnected ? 'En Línea' : 'Desconectado'}
              </Text>
            </View>
          </View>

          <View style={styles.tabContainer}>
            {[
              { id: 'create', label: 'Crear', icon: PlusCircle },
              { id: 'join', label: 'Unirse', icon: Key },
              { id: 'spectator', label: 'Ver', icon: Eye },
            ].map((t) => (
              <TouchableOpacity 
                key={t.id}
                style={[styles.tab, tab === t.id && styles.tabActive]}
                onPress={() => setTab(t.id)}
              >
                <t.icon size={16} color={tab === t.id ? TEXT : MUTED} style={styles.tabIcon} />
                <Text style={[styles.tabText, tab === t.id && styles.tabTextActive]}>{t.label}</Text>
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
          </View>

          <View style={styles.footerInfo}>
            <Share2 size={16} color={PURPLE} style={{ marginBottom: 6 }} />
            <Text style={styles.footer}>Invita a tus amigos compartiendo el código</Text>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  flex: { flex: 1 },
  content: { flex: 1, padding: 24, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 40 },
  logoCircle: { 
    width: 100, height: 100, borderRadius: 50, 
    backgroundColor: CARD, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: BORDER, marginBottom: 16
  },
  title: { fontSize: 32, fontWeight: '900', color: TEXT, letterSpacing: 1 },
  subtitle: { fontSize: 12, color: MUTED, marginTop: 4, letterSpacing: 4, fontWeight: '700' },
  connectionBadge: { 
    flexDirection: 'row', alignItems: 'center', backgroundColor: CARD, 
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginTop: 16,
    borderWidth: 1, borderColor: BORDER
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