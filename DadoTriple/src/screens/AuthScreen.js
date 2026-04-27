import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  Animated, ActivityIndicator, Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ShieldCheck, User, Mail, Lock, AlertCircle, CheckCircle2 } from 'lucide-react-native';
import { authApi } from '../services/apiService';
import useGameStore from '../store/useGameStore';

const BG = '#0F0F1A';
const CARD = '#1A1A2E';
const BORDER = '#2A2A45';
const TEXT = '#E2E8F0';
const MUTED = '#64748B';
const PURPLE = '#7C3AED';
const SUCCESS = '#10B981';
const DANGER = '#EF4444';

function Field({ label, value, onChangeText, placeholder, keyboardType, autoCapitalize, secureTextEntry, style, icon: Icon }) {
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
        <View style={styles.fieldRow}>
          {Icon && <Icon size={20} color={focused ? PURPLE : MUTED} style={styles.fieldIcon} />}
          <TextInput
            style={styles.fieldInput}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={MUTED}
            keyboardType={keyboardType}
            autoCapitalize={autoCapitalize || 'none'}
            autoCorrect={false}
            secureTextEntry={secureTextEntry}
            onFocus={handleFocus}
            onBlur={handleBlur}
          />
        </View>
      </Animated.View>
    </View>
  );
}

export default function AuthScreen({ navigation }) {
  const [tab, setTab] = useState('login'); // 'login' | 'register'

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Animaciones
  const logoAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(40)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const tabIndicator = useRef(new Animated.Value(0)).current;
  const errorShake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
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
  }, []);

  const shakeError = () => {
    Animated.sequence([
      Animated.timing(errorShake, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(errorShake, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(errorShake, { toValue: 6, duration: 60, useNativeDriver: true }),
      Animated.timing(errorShake, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const switchTab = (t) => {
    setTab(t);
    setError(null);
    setSuccess(null);
    Animated.spring(tabIndicator, {
      toValue: t === 'login' ? 0 : 1,
      useNativeDriver: false,
      tension: 80, friction: 12,
    }).start();
  };

  const validate = () => {
    Keyboard.dismiss();
    if (tab === 'register' && !name.trim()) {
      setError('Ingresa tu nombre para continuar');
      shakeError();
      return false;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Ingresa un correo electrónico válido');
      shakeError();
      return false;
    }
    if (!password) {
      setError('Ingresa tu contraseña');
      shakeError();
      return false;
    }
    return true;
  };

  const handleAction = async () => {
    if (!validate()) return;
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      let data;
      if (tab === 'login') {
        data = await authApi.login(email.trim(), password);
      } else {
        data = await authApi.register(name.trim(), email.trim(), password);
      }

      useGameStore.setState({ playerName: data.user.name, playerEmail: data.user.email });

      setSuccess(tab === 'login' ? '¡Bienvenido de vuelta!' : '¡Cuenta creada exitosamente!');

      setTimeout(() => {
        navigation.replace('Lobby');
      }, 1000);

    } catch (err) {
      setError(err.message);
      shakeError();
    } finally {
      setLoading(false);
    }
  };

  const indicatorLeft = tabIndicator.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '50%'],
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Animated.View style={[styles.header, { transform: [{ scale: logoAnim }], opacity: logoAnim }]}>
          <View style={styles.logoCircle}>
            <ShieldCheck size={48} color={GOLD} strokeWidth={2.5} />
          </View>
          <Text style={styles.title}>Dado Triple</Text>
          <Text style={styles.subtitle}>Iniciar Sesión o Registro</Text>
        </Animated.View>

        <Animated.View
          style={[
            styles.card,
            { opacity: cardOpacity, transform: [{ translateY: cardAnim }] },
          ]}
        >
          <View style={styles.tabs}>
            <Animated.View style={[styles.tabIndicator, { left: indicatorLeft, width: '50%' }]} />
            <TouchableOpacity style={styles.tab} onPress={() => switchTab('login')} activeOpacity={0.7}>
              <Text style={[styles.tabText, tab === 'login' && styles.tabTextActive]}>Iniciar Sesión</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.tab} onPress={() => switchTab('register')} activeOpacity={0.7}>
              <Text style={[styles.tabText, tab === 'register' && styles.tabTextActive]}>Registrarse</Text>
            </TouchableOpacity>
          </View>

          {tab === 'register' && (
            <Field
              label="TU NOMBRE"
              value={name}
              onChangeText={setName}
              placeholder="Ej: Alice"
              autoCapitalize="words"
              icon={User}
            />
          )}

          <Field
            label="CORREO ELECTRÓNICO"
            value={email}
            onChangeText={setEmail}
            placeholder="ejemplo@correo.com"
            keyboardType="email-address"
            icon={Mail}
          />

          <Field
            label="CONTRASEÑA"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            icon={Lock}
          />

          {error && (
            <Animated.View style={[styles.errorBox, { transform: [{ translateX: errorShake }] }]}>
              <AlertCircle size={18} color={DANGER} style={styles.boxIcon} />
              <Text style={styles.errorText}>{error}</Text>
            </Animated.View>
          )}

          {success && (
            <View style={styles.successBox}>
              <CheckCircle2 size={18} color={SUCCESS} style={styles.boxIcon} />
              <Text style={styles.successText}>{success}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.actionBtn, loading && styles.actionBtnDisabled]}
            onPress={handleAction}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.actionBtnText}>
                {tab === 'login' ? 'Entrar' : 'Crear cuenta'}
              </Text>
            )}
          </TouchableOpacity>
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const GOLD = '#F59E0B';

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  root: {
    flex: 1, backgroundColor: BG,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 24,
  },
  header: { alignItems: 'center', marginBottom: 32 },
  logoCircle: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: GOLD + '15', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: GOLD + '40', marginBottom: 12,
    shadowColor: GOLD, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 15, elevation: 8,
  },
  title: { fontSize: 32, fontWeight: '900', color: TEXT, letterSpacing: 1 },
  subtitle: { fontSize: 13, color: MUTED, marginTop: 4, letterSpacing: 0.5 },

  card: {
    backgroundColor: CARD,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: BORDER,
    padding: 24,
    width: '100%',
    shadowColor: PURPLE, shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4, shadowRadius: 20, elevation: 12,
  },
  tabs: {
    flexDirection: 'row', backgroundColor: BG,
    borderRadius: 16, padding: 4,
    marginBottom: 22, position: 'relative', overflow: 'hidden',
    borderWidth: 1, borderColor: BORDER,
  },
  tabIndicator: {
    position: 'absolute', top: 4, bottom: 4,
    backgroundColor: PURPLE, borderRadius: 12,
  },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center', zIndex: 1 },
  tabText: { fontSize: 13, fontWeight: '700', color: MUTED, letterSpacing: 0.5 },
  tabTextActive: { color: TEXT },

  fieldWrapper: { marginBottom: 16 },
  fieldLabel: {
    fontSize: 10, fontWeight: '800', color: MUTED,
    letterSpacing: 2, marginBottom: 8,
  },
  fieldBorder: {
    borderWidth: 1.5, borderRadius: 14,
    backgroundColor: BG, overflow: 'hidden',
  },
  fieldRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  fieldIcon: { marginRight: 12 },
  fieldInput: {
    flex: 1, paddingVertical: 14,
    color: TEXT, fontSize: 16,
  },

  errorBox: {
    backgroundColor: DANGER + '15', borderRadius: 12,
    borderWidth: 1.5, borderColor: DANGER + '40',
    padding: 12, marginBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
  },
  boxIcon: { marginRight: 8 },
  errorText: { fontSize: 13, color: DANGER, fontWeight: '700' },

  successBox: {
    backgroundColor: SUCCESS + '15', borderRadius: 12,
    borderWidth: 1.5, borderColor: SUCCESS + '40',
    padding: 12, marginBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
  },
  successText: { fontSize: 13, color: SUCCESS, fontWeight: '700' },

  actionBtn: {
    backgroundColor: PURPLE, borderRadius: 16,
    paddingVertical: 18, alignItems: 'center',
    shadowColor: PURPLE, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5, shadowRadius: 14, elevation: 10,
  },
  actionBtnDisabled:  { opacity: 0.5 },
  actionBtnText: { fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
});
