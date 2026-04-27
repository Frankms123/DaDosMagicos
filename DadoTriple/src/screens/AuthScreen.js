import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Platform, Animated,
  ActivityIndicator, Keyboard, ScrollView, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ShieldCheck, User, Mail, Lock, AlertCircle, CheckCircle2, Gamepad2 } from 'lucide-react-native';
import { authApi } from '../services/apiService';
import useGameStore from '../store/useGameStore';

const BG     = '#0F0F1A';
const CARD   = '#1A1A2E';
const BORDER = '#2A2A45';
const TEXT   = '#E2E8F0';
const MUTED  = '#64748B';
const PURPLE = '#7C3AED';
const GOLD   = '#F59E0B';
const SUCCESS = '#10B981';
const DANGER  = '#EF4444';

// ─── Campo de texto ───────────────────────────────────────────────────────────
function Field({ label, value, onChangeText, placeholder, keyboardType, autoCapitalize, secureTextEntry, icon: Icon }) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.fieldWrapper}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.fieldBorder, focused && styles.fieldBorderFocused]}>
        <View style={styles.fieldRow}>
          {Icon && <Icon size={18} color={focused ? PURPLE : MUTED} style={styles.fieldIcon} />}
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
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            underlineColorAndroid="transparent"
          />
        </View>
      </View>
    </View>
  );
}

// ─── Pantalla ─────────────────────────────────────────────────────────────────
export default function AuthScreen({ navigation }) {
  const [tab,      setTab]      = useState('login');
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  const [success,  setSuccess]  = useState(null);

  const switchTab = (t) => {
    setTab(t);
    setError(null);
    setSuccess(null);
  };

  const validate = () => {
    Keyboard.dismiss();
    if (tab === 'register' && !name.trim()) {
      setError('Ingresa tu nombre'); return false;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Ingresa un correo válido'); return false;
    }
    if (!password) {
      setError('Ingresa tu contraseña'); return false;
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
      const userName = data.user?.name || data.user?.email || '';
      useGameStore.setState({ playerName: userName, playerEmail: data.user?.email || '' });
      setSuccess(tab === 'login' ? '¡Bienvenido de vuelta!' : '¡Cuenta creada!');
      setTimeout(() => navigation.replace('Lobby'), 900);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <ShieldCheck size={44} color={GOLD} strokeWidth={2.5} />
          </View>
          <Text style={styles.title}>Dado Triple</Text>
          <Text style={styles.subtitle}>El Plan del Diablo</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>

          {/* Tabs */}
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, tab === 'login' && styles.tabActive]}
              onPress={() => switchTab('login')}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, tab === 'login' && styles.tabTextActive]}>
                Iniciar Sesión
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, tab === 'register' && styles.tabActive]}
              onPress={() => switchTab('register')}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, tab === 'register' && styles.tabTextActive]}>
                Registrarse
              </Text>
            </TouchableOpacity>
          </View>

          {/* Campos */}
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

          {/* Error */}
          {error && (
            <View style={styles.errorBox}>
              <AlertCircle size={16} color={DANGER} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Éxito */}
          {success && (
            <View style={styles.successBox}>
              <CheckCircle2 size={16} color={SUCCESS} />
              <Text style={styles.successText}>{success}</Text>
            </View>
          )}

          {/* Botón */}
          <TouchableOpacity
            style={[styles.actionBtn, loading && styles.actionBtnDisabled]}
            onPress={handleAction}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.actionBtnText}>
                  {tab === 'login' ? 'Entrar' : 'Crear cuenta'}
                </Text>
            }
          </TouchableOpacity>

          {/* Opción Invitado */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>O TAMBIÉN</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity 
            style={styles.guestBtn} 
            onPress={() => navigation.navigate('Lobby')}
            activeOpacity={0.7}
          >
            <Gamepad2 size={20} color={GOLD} />
            <Text style={styles.guestBtnText}>Entrar como invitado</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: BG },
  scroll:  { flex: 1, backgroundColor: BG },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 40,
  },

  header: { alignItems: 'center', marginBottom: 32, width: '100%' },
  logoCircle: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: GOLD + '15',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: GOLD + '40',
    marginBottom: 14,
  },
  title:    { fontSize: 30, fontWeight: '900', color: TEXT, letterSpacing: 1 },
  subtitle: { fontSize: 12, color: MUTED, marginTop: 4 },

  card: {
    width: '100%',
    backgroundColor: CARD,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: BORDER,
    padding: 22,
  },

  // Tabs — sin Animated para evitar problemas de z-index
  tabs: {
    flexDirection: 'row',
    backgroundColor: BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 22,
    overflow: 'hidden',
  },
  tab: {
    flex: 1,
    paddingVertical: 13,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: PURPLE,
  },
  tabText:       { fontSize: 13, fontWeight: '700', color: MUTED },
  tabTextActive: { color: TEXT },

  // Campos — sin Animated.View en el borde
  fieldWrapper: { marginBottom: 16 },
  fieldLabel: {
    fontSize: 10, fontWeight: '800', color: MUTED,
    letterSpacing: 2, marginBottom: 8,
  },
  fieldBorder: {
    borderWidth: 1.5, borderRadius: 12,
    borderColor: BORDER,
    backgroundColor: BG,
  },
  fieldBorderFocused: {
    borderColor: PURPLE,
  },
  fieldRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 },
  fieldIcon: { marginRight: 10 },
  fieldInput: {
    flex: 1,
    paddingVertical: 13,
    color: TEXT,
    fontSize: 15,
  },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: DANGER + '15',
    borderRadius: 10, borderWidth: 1, borderColor: DANGER + '40',
    padding: 11, marginBottom: 12,
  },
  errorText: { flex: 1, fontSize: 12, color: DANGER, fontWeight: '600' },

  successBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: SUCCESS + '15',
    borderRadius: 10, borderWidth: 1, borderColor: SUCCESS + '40',
    padding: 11, marginBottom: 12,
  },
  successText: { flex: 1, fontSize: 12, color: SUCCESS, fontWeight: '600' },

  actionBtn: {
    backgroundColor: PURPLE,
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
    marginTop: 4,
  },
  actionBtnDisabled: { opacity: 0.5 },
  actionBtnText: { fontSize: 16, fontWeight: '800', color: '#fff' },

  // Divider
  divider: {
    flexDirection: 'row', alignItems: 'center', marginVertical: 20, gap: 10,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: BORDER },
  dividerText: { fontSize: 10, fontWeight: '800', color: MUTED, letterSpacing: 1 },

  // Guest Btn
  guestBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 15, borderRadius: 14,
    borderWidth: 1.5, borderColor: GOLD + '40',
    backgroundColor: GOLD + '05',
  },
  guestBtnText: { fontSize: 15, fontWeight: '700', color: GOLD },
});