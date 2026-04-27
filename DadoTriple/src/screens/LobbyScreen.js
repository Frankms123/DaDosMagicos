import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  Animated, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  User, Gamepad2, PlusCircle, LogIn, Eye, 
  ShieldCheck, Wifi, WifiOff, AlertCircle 
} from 'lucide-react-native';
import socketService from '../services/socketService';
import { playSound } from '../services/soundService';
import useGameStore from '../store/useGameStore';
import MagicBackground from '../components/MagicBackground';
import GameButton from '../components/GameButton';
import DiceFace from '../components/DiceFace';
import { colors, shadows } from '../theme';

const BG       = colors.bg;
const CARD     = colors.card;
const BORDER   = colors.border;
const TEXT     = colors.text;
const MUTED    = colors.muted;
const PURPLE   = colors.purple;
const GOLD     = colors.gold;
const SUCCESS  = colors.green;
const DANGER   = colors.red;

function ConnectionDot({ connected }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!connected) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.4, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,   duration: 1000, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [connected]);

  return (
    <View style={styles.dotWrapper}>
      <Animated.View style={[styles.dotOuter, { backgroundColor: (connected ? SUCCESS : DANGER) + '33', transform: [{ scale: pulse }] }]} />
      <View style={[styles.dotInner, { backgroundColor: connected ? SUCCESS : DANGER }]} />
    </View>
  );
}

function Field({ label, value, onChangeText, placeholder, icon: Icon, ...props }) {
  const [focused, setFocused] = useState(false);
  const borderAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(borderAnim, { toValue: focused ? 1 : 0, duration: 200, useNativeDriver: false }).start();
  }, [focused]);

  const borderColor = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [BORDER, PURPLE],
  });

  return (
    <View style={styles.fieldWrapper}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Animated.View style={[styles.fieldBorder, { borderColor }]}>
        {Icon && <Icon size={18} color={focused ? PURPLE : MUTED} style={styles.fieldIcon} />}
        <TextInput
          style={styles.fieldInput}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={MUTED}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...props}
        />
      </Animated.View>
    </View>
  );
}

export default function LobbyScreen() {
  const storedName = useGameStore(s => s.playerName);
  const isConnected = useGameStore(s => s.isConnected);

  const [tab, setTab] = useState('create');
  const [guestName, setGuestName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();
    socketService.connect();
    
    const offError = socketService.on('error', (p) => { setError(p.message); setLoading(false); shake(); });
    const offCreated = socketService.on('room_created', (payload) => {
      setLoading(false);
      socketService.saveReconnectData(payload.playerId, payload.roomCode);
    });
    const offJoined = socketService.on('room_joined', (payload) => {
      setLoading(false);
      socketService.saveReconnectData(payload.playerId, payload.roomCode);
    });

    return () => {
      offError();
      offCreated();
      offJoined();
    };
  }, []);

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const getFinalName = () => (storedName || guestName || '').trim();

  const handleAction = (type) => {
    const name = getFinalName();
    if (!name) { setError('Ingresa tu nombre'); shake(); return; }
    if (type !== 'create' && roomCode.length < 4) { setError('Código inválido'); shake(); return; }

    setError(null);
    setLoading(true);
    useGameStore.setState({ playerName: name });

    socketService.clearReconnectData();

    if (type === 'create') socketService.createRoom(name, 4);
    else if (type === 'join') socketService.joinRoom(roomCode.toUpperCase(), name);
    else socketService.joinAsSpectator(roomCode.toUpperCase(), name);

    setTimeout(() => setLoading(false), 5000);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <MagicBackground intensity={1.2} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.root}>
        
        <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
          <View style={styles.logoContainer}>
            <DiceFace value={3} size={50} pipColor={GOLD} faceColor={CARD} />
          </View>
          <Text style={styles.title}>Dado Triple</Text>
          <View style={styles.connRow}>
            <ConnectionDot connected={isConnected} />
            <Text style={[styles.connText, { color: isConnected ? SUCCESS : MUTED }]}>
              {isConnected ? 'EN LÍNEA' : 'CONECTANDO...'}
            </Text>
          </View>
        </Animated.View>

        <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
          <View style={styles.tabs}>
            {['create', 'join', 'spectator'].map(t => (
              <TouchableOpacity key={t} onPress={() => { setTab(t); setError(null); playSound('click'); }} 
                style={[styles.tab, tab === t && styles.tabActive]}>
                {t === 'create' && <PlusCircle size={14} color={tab === t ? TEXT : MUTED} style={{marginRight: 6}} />}
                {t === 'join' && <LogIn size={14} color={tab === t ? TEXT : MUTED} style={{marginRight: 6}} />}
                {t === 'spectator' && <Eye size={14} color={tab === t ? TEXT : MUTED} style={{marginRight: 6}} />}
                <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                  {t === 'create' ? 'Crear' : t === 'join' ? 'Unirse' : 'Ver'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {storedName ? (
            /* Nombre fijo - No editable */
            <View style={styles.welcomeBox}>
              <View style={styles.avatar}>
                <ShieldCheck size={20} color={PURPLE} />
              </View>
              <View>
                <Text style={styles.welcomeLabel}>IDENTIDAD VERIFICADA</Text>
                <Text style={styles.welcomeName}>{storedName}</Text>
              </View>
            </View>
          ) : (
            /* Solo se muestra si es la primera vez (creando "cuenta" / invitado) */
            <Field 
              label="TU NOMBRE DE JUGADOR" 
              value={guestName} 
              onChangeText={setGuestName} 
              placeholder="Ej. Frank Mora" 
              icon={User} 
              autoCapitalize="words" 
              maxLength={18}
            />
          )}

          {(tab === 'join' || tab === 'spectator') && (
            <Field label="CÓDIGO DE SALA" value={roomCode} onChangeText={t => setRoomCode(t.toUpperCase())}
              placeholder="ABCD" maxLength={4} icon={Gamepad2} autoCapitalize="characters" 
              inputStyle={styles.codeInput} />
          )}

          {error && (
            <Animated.View style={[styles.errorBox, { transform: [{ translateX: shakeAnim }] }]}>
              <AlertCircle size={14} color={DANGER} />
              <Text style={styles.errorText}>{error}</Text>
            </Animated.View>
          )}

          <TouchableOpacity style={[styles.mainBtn, (!isConnected || loading) && styles.btnDisabled, 
            tab === 'create' ? styles.btnCreate : tab === 'join' ? styles.btnJoin : styles.btnSpec]}
            onPress={() => handleAction(tab)} disabled={!isConnected || loading}>
            {loading ? <ActivityIndicator color="#fff" /> : (
              <View style={styles.btnContent}>
                {tab === 'create' ? <PlusCircle size={20} color="#fff" /> : tab === 'join' ? <LogIn size={20} color="#fff" /> : <Eye size={20} color="#fff" />}
                <Text style={styles.btnText}>
                  {tab === 'create' ? 'CREAR SALA' : tab === 'join' ? 'UNIRSE AHORA' : 'ENTRAR A VER'}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>

        <Text style={styles.footer}>Dado Triple v1.2 · El Plan del Diablo</Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  root: { flex: 1, paddingHorizontal: 24, justifyContent: 'center', alignItems: 'center' },
  header: { alignItems: 'center', marginBottom: 30 },
  logoContainer: { padding: 12, backgroundColor: CARD, borderRadius: 20, borderWidth: 1, borderColor: BORDER, ...shadows.purple },
  title: { fontSize: 32, fontWeight: '900', color: TEXT, marginTop: 12, letterSpacing: 1 },
  connRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 6 },
  connText: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  dotWrapper: { width: 12, height: 12, justifyContent: 'center', alignItems: 'center' },
  dotOuter: { position: 'absolute', width: 12, height: 12, borderRadius: 6 },
  dotInner: { width: 6, height: 6, borderRadius: 3 },
  card: { width: '100%', backgroundColor: CARD, borderRadius: 28, padding: 24, borderWidth: 1, borderColor: BORDER, ...shadows.purple },
  tabs: { flexDirection: 'row', backgroundColor: BG, borderRadius: 16, padding: 4, marginBottom: 20, borderWidth: 1, borderColor: BORDER },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 12 },
  tabActive: { backgroundColor: BORDER },
  tabText: { fontSize: 13, fontWeight: '700', color: MUTED },
  tabTextActive: { color: TEXT },
  fieldWrapper: { marginBottom: 18, width: '100%' },
  fieldLabel: { fontSize: 10, fontWeight: '800', color: MUTED, marginBottom: 8, marginLeft: 4, letterSpacing: 1 },
  fieldBorder: { flexDirection: 'row', alignItems: 'center', backgroundColor: BG, borderRadius: 16, borderWidth: 1.5, paddingHorizontal: 16 },
  fieldIcon: { marginRight: 12 },
  fieldInput: { flex: 1, height: 54, fontSize: 16, color: TEXT, fontWeight: '600' },
  codeInput: { textAlign: 'center', letterSpacing: 8, fontSize: 22, fontWeight: '900', color: GOLD },
  welcomeBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: BG, padding: 16, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: BORDER },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: BORDER, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  welcomeLabel: { fontSize: 9, fontWeight: '800', color: MUTED, letterSpacing: 1 },
  welcomeName: { fontSize: 18, fontWeight: '700', color: TEXT },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: DANGER + '15', padding: 12, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: DANGER + '30' },
  errorText: { color: DANGER, fontSize: 12, fontWeight: '600' },
  mainBtn: { borderRadius: 18, paddingVertical: 18, alignItems: 'center', marginTop: 10, ...shadows.purple },
  btnDisabled: { opacity: 0.5 },
  btnContent: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '900', letterSpacing: 1 },
  btnCreate: { backgroundColor: PURPLE },
  btnJoin: { backgroundColor: SUCCESS, shadowColor: SUCCESS },
  btnSpec: { backgroundColor: GOLD, shadowColor: GOLD },
  footer: { marginTop: 30, fontSize: 11, color: MUTED, opacity: 0.7 },
});