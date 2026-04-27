/**
 * LobbyScreen.js
 * Pantalla de entrada: crear sala o unirse con código.
 * Conectada al servidor WebSocket real.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  Animated, Easing, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
        Animated.timing(pulse, { toValue: 1,   duration: 800, useNativeDriver: true }),
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
function Field({ label, value, onChangeText, placeholder, keyboardType, autoCapitalize, maxLength, style, inputStyle }) {
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

// ─── Pantalla principal ───────────────────────────────────────────────────────
export default function LobbyScreen() {
  const storedName = useGameStore.getState().playerName ?? '';
  const [tab, setTab]             = useState('create'); // 'create' | 'join' | 'spectator'
  const [playerName, setPlayerName] = useState(storedName);
  const [roomCode, setRoomCode]   = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);

  const isConnected = useGameStore(s => s.isConnected);
  const setPlayerNameStore = (name) => useGameStore.setState({ playerName: name });

  // Animaciones
  const logoAnim   = useRef(new Animated.Value(0)).current;
  const cardAnim   = useRef(new Animated.Value(40)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const tabIndicator = useRef(new Animated.Value(0)).current;
  const errorShake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Resetear estado local al montar (viene de GameOver o de otra pantalla)
    setLoading(false);
    setError(null);

    // Conectar al servidor
    socketService.connect();

    socketService.on('__connected', () => {
      useGameStore.setState({ isConnected: true });
    });
    socketService.on('__disconnected', () => {
      useGameStore.setState({ isConnected: false });
    });

    // Escuchar error del servidor
    socketService.on('error', (payload) => {
      setError(payload.message);
      setLoading(false);
      shakeError();
    });

    // Cancelar loading si room_created llega (navegación ya ocurrió via useWebSocket)
    socketService.on('room_created', () => setLoading(false));
    socketService.on('room_joined',  () => setLoading(false));

    // Animación de entrada
    Animated.parallel([
      Animated.spring(logoAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 8 }),
      Animated.sequence([
        Animated.delay(200),
        Animated.parallel([
          Animated.spring(cardAnim, { toValue: 0, useNativeDriver: true, tension: 70, friction: 10 }),
          Animated.timing(cardOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        ]),
      ]),
    ]).start();

    return () => {
      socketService.offAll('error');
      socketService.offAll('__connected');
      socketService.offAll('__disconnected');
    };
  }, []);

  const shakeError = () => {
    Animated.sequence([
      Animated.timing(errorShake, { toValue: 10,  duration: 60, useNativeDriver: true }),
      Animated.timing(errorShake, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(errorShake, { toValue: 6,   duration: 60, useNativeDriver: true }),
      Animated.timing(errorShake, { toValue: 0,   duration: 60, useNativeDriver: true }),
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
    useGameStore.setState({ playerName: playerName.trim() });

    // El servidor responderá con room_created → useWebSocket lo manejará
    socketService.createRoom(playerName.trim(), 4);

    // Timeout de seguridad
    setTimeout(() => {
      if (loading) {
        setLoading(false);
        setError('Sin respuesta del servidor. ¿Está corriendo?');
      }
    }, 8000);
  };

  const handleJoin = () => {
    playSound('click', 0.65);
    if (!validate()) return;
    setError(null);
    setLoading(true);
    useGameStore.setState({ playerName: playerName.trim() });
    socketService.joinRoom(roomCode.trim().toUpperCase(), playerName.trim());

    setTimeout(() => {
      if (loading) {
        setLoading(false);
        setError('Sala no encontrada o el servidor no responde');
      }
    }, 8000);
  };

  const handleSpectator = () => {
    playSound('click', 0.65);
    if (!validate()) return;
    setError(null);
    setLoading(true);
    useGameStore.setState({ playerName: playerName.trim() });
    socketService.joinAsSpectator(roomCode.trim().toUpperCase(), playerName.trim());

    setTimeout(() => {
      if (loading) {
        setLoading(false);
        setError('Sala no encontrada');
      }
    }, 8000);
  };

  const tabWidth = 100 / 3;
  const indicatorLeft = tabIndicator.interpolate({
    inputRange: [0, 1, 2],
    outputRange: ['0%', `${tabWidth}%`, `${tabWidth * 2}%`],
  });

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
              {isConnected ? 'Servidor conectado' : 'Conectando...'}
            </Text>
          </View>
        </Animated.View>

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

          {/* Campo nombre */}
          <Field
            label="TU NOMBRE"
            value={playerName}
            onChangeText={setPlayerName}
            placeholder="Ej: Alice"
            autoCapitalize="words"
            maxLength={16}
          />

          {/* Campo código (join y spectator) */}
          {(tab === 'join' || tab === 'spectator') && (
            <Field
              label="CÓDIGO DE SALA"
              value={roomCode}
              onChangeText={(t) => setRoomCode(t.toUpperCase())}
              placeholder="AB3K"
              autoCapitalize="characters"
              maxLength={4}
              inputStyle={styles.codeInputStyle}
            />
          )}

          {/* Info según tab */}
          {tab === 'create' && (
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                Se creará una sala y recibirás un código de 4 letras para compartir con hasta 3 amigos.
              </Text>
            </View>
          )}
          {tab === 'spectator' && (
            <View style={[styles.infoBox, styles.infoBoxGold]}>
              <Text style={[styles.infoText, { color: GOLD }]}>
                Como espectador verás la partida en tiempo real sin participar en el juego.
              </Text>
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

        <Text style={styles.footer}>Dado Triple v1.0 · El Plan del Diablo</Text>
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

  // Tabs
  tabs: {
    flexDirection: 'row', backgroundColor: BG,
    borderRadius: 14, padding: 4,
    marginBottom: 22, position: 'relative', overflow: 'hidden',
  },
  tabIndicator: {
    position: 'absolute', top: 4, bottom: 4,
    backgroundColor: PURPLE, borderRadius: 11,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', zIndex: 1 },
  tabText: { fontSize: 12, fontWeight: '700', color: MUTED },
  tabTextActive: { color: TEXT },

  // Campos
  fieldWrapper: { marginBottom: 16 },
  fieldLabel: {
    fontSize: 10, fontWeight: '700', color: MUTED,
    letterSpacing: 1.5, marginBottom: 8,
  },
  fieldBorder: {
    borderWidth: 1.5, borderRadius: 12,
    backgroundColor: BG, overflow: 'hidden',
  },
  fieldInput: {
    paddingHorizontal: 16, paddingVertical: 14,
    color: TEXT, fontSize: 16,
  },
  codeInputStyle: {
    fontSize: 28, fontWeight: '800',
    letterSpacing: 10, textAlign: 'center', color: GOLD,
  },

  // Info
  infoBox: {
    backgroundColor: PURPLE + '15', borderRadius: 12,
    borderWidth: 1, borderColor: PURPLE + '35',
    padding: 12, marginBottom: 16,
  },
  infoBoxGold: {
    backgroundColor: GOLD + '10',
    borderColor: GOLD + '30',
  },
  infoText: { fontSize: 12, color: '#A78BFA', lineHeight: 18 },

  // Error
  errorBox: {
    backgroundColor: DANGER + '15', borderRadius: 10,
    borderWidth: 1, borderColor: DANGER + '40',
    padding: 10, marginBottom: 14,
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