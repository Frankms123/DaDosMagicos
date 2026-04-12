import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Animated,
  Easing,
} from 'react-native';
import socketService from '../services/socketService';
import useGameStore from '../store/useGameStore';

// Genera un código de sala aleatorio de 6 caracteres
const generateRoomCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

export default function LobbyScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('create'); // 'create' | 'join'
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [loading, setLoading] = useState(false);

  const setUser = useGameStore((state) => state.setUser);
  const setRoom = useGameStore((state) => state.setRoom);

  // Animación del indicador de tab
  const tabIndicatorAnim = React.useRef(new Animated.Value(0)).current;

  const switchTab = (tab) => {
    setActiveTab(tab);
    Animated.timing(tabIndicatorAnim, {
      toValue: tab === 'create' ? 0 : 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  };

  const handleCreateRoom = () => {
    if (!playerName.trim()) {
      Alert.alert('¡Espera!', 'Ingresa tu nombre para continuar.');
      return;
    }
    setLoading(true);
    const newCode = generateRoomCode();

    const socket = socketService.connect();
    setUser({ name: playerName.trim(), id: socket.id });
    setRoom({ code: newCode, isHost: true });

    socketService.joinRoom(newCode);

    setTimeout(() => {
      setLoading(false);
      navigation.navigate('WaitingRoom', { roomCode: newCode, playerName: playerName.trim(), isHost: true });
    }, 600);
  };

  const handleJoinRoom = () => {
    if (!playerName.trim()) {
      Alert.alert('¡Espera!', 'Ingresa tu nombre para continuar.');
      return;
    }
    if (roomCodeInput.trim().length < 4) {
      Alert.alert('Código inválido', 'El código de sala debe tener al menos 4 caracteres.');
      return;
    }
    setLoading(true);
    const code = roomCodeInput.trim().toUpperCase();

    const socket = socketService.connect();
    setUser({ name: playerName.trim(), id: socket.id });
    setRoom({ code, isHost: false });

    socketService.joinRoom(code);

    setTimeout(() => {
      setLoading(false);
      navigation.navigate('WaitingRoom', { roomCode: code, playerName: playerName.trim(), isHost: false });
    }, 600);
  };

  const tabLeft = tabIndicatorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '50%'],
  });

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>🎲</Text>
        <Text style={styles.title}>Dados Mágicos</Text>
        <Text style={styles.subtitle}>Juego de dados multijugador</Text>
      </View>

      {/* Card principal */}
      <View style={styles.card}>
        {/* Tabs */}
        <View style={styles.tabContainer}>
          <Animated.View style={[styles.tabIndicator, { left: tabLeft }]} />
          <TouchableOpacity
            style={styles.tab}
            onPress={() => switchTab('create')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === 'create' && styles.tabTextActive]}>
              Crear Sala
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.tab}
            onPress={() => switchTab('join')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === 'join' && styles.tabTextActive]}>
              Unirse
            </Text>
          </TouchableOpacity>
        </View>

        {/* Nombre del jugador (siempre visible) */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Tu nombre</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: Jugador1"
            placeholderTextColor="#555"
            value={playerName}
            onChangeText={setPlayerName}
            maxLength={16}
            autoCapitalize="words"
          />
        </View>

        {/* Contenido según el tab */}
        {activeTab === 'create' ? (
          <View style={styles.tabContent}>
            <View style={styles.infoBox}>
              <Text style={styles.infoIcon}>✨</Text>
              <Text style={styles.infoText}>
                Se generará un código único que puedes compartir con tus amigos para que se unan.
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
              onPress={handleCreateRoom}
              disabled={loading}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryButtonText}>
                {loading ? 'Creando sala...' : '🎲 Crear Sala'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.tabContent}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Código de sala</Text>
              <TextInput
                style={[styles.input, styles.codeInput]}
                placeholder="Ej: AB12CD"
                placeholderTextColor="#555"
                value={roomCodeInput}
                onChangeText={setRoomCodeInput}
                maxLength={8}
                autoCapitalize="characters"
                autoCorrect={false}
              />
            </View>
            <TouchableOpacity
              style={[styles.primaryButton, styles.joinButton, loading && styles.primaryButtonDisabled]}
              onPress={handleJoinRoom}
              disabled={loading}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryButtonText}>
                {loading ? 'Uniéndose...' : '🚀 Unirse a la Sala'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Footer */}
      <Text style={styles.footer}>Dados Mágicos v1.0</Text>
    </KeyboardAvoidingView>
  );
}

const PURPLE = '#7C3AED';
const PURPLE_DARK = '#5B21B6';
const GOLD = '#F59E0B';
const BG = '#0F0F1A';
const CARD_BG = '#1A1A2E';
const BORDER = '#2A2A45';
const TEXT = '#E2E8F0';
const MUTED = '#64748B';

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    fontSize: 64,
    marginBottom: 8,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: TEXT,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14,
    color: MUTED,
    marginTop: 4,
    letterSpacing: 0.3,
  },
  card: {
    width: '100%',
    backgroundColor: CARD_BG,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 24,
    shadowColor: PURPLE,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#0F0F1A',
    borderRadius: 14,
    padding: 4,
    marginBottom: 24,
    position: 'relative',
    overflow: 'hidden',
  },
  tabIndicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    width: '50%',
    backgroundColor: PURPLE,
    borderRadius: 11,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    zIndex: 1,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: MUTED,
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  tabContent: {
    gap: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#0F0F1A',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: TEXT,
    fontSize: 16,
  },
  codeInput: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 4,
    textAlign: 'center',
    color: GOLD,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(124, 58, 237, 0.12)',
    borderRadius: 12,
    padding: 14,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
    gap: 10,
    marginBottom: 4,
  },
  infoIcon: {
    fontSize: 18,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#A78BFA',
    lineHeight: 20,
  },
  primaryButton: {
    backgroundColor: PURPLE,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: PURPLE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  joinButton: {
    backgroundColor: GOLD,
    shadowColor: GOLD,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  footer: {
    marginTop: 28,
    fontSize: 12,
    color: '#2A2A45',
  },
});
