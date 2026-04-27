import 'react-native-gesture-handler';
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import AuthScreen         from './src/screens/AuthScreen';
import LobbyScreen        from './src/screens/LobbyScreen';
import WaitingRoomScreen  from './src/screens/WaitingRoomScreen';
import GameScreen         from './src/screens/GameScreen';
import RoundResultsScreen from './src/screens/RoundResultsScreen';
import GameOverScreen     from './src/screens/GameOverScreen';
import SpectatorScreen    from './src/screens/SpectatorScreen';
import RankingScreen      from './src/screens/RankingScreen';
import ProfileScreen      from './src/screens/ProfileScreen';

import useWebSocket from './src/hooks/useWebSocket';

// ─── Colores ──────────────────────────────────────────────────────────────────
const BG     = '#0F0F1A';
const CARD   = '#1A1A2E';
const BORDER = '#2A2A45';
const PURPLE = '#7C3AED';
const MUTED  = '#64748B';
const TEXT   = '#E2E8F0';

// ─── Pantallas que NO muestran la tab bar ─────────────────────────────────────
const HIDE_TAB_SCREENS = new Set([
  'Auth', 'WaitingRoom', 'Game', 'RoundResults', 'GameOver', 'Spectator',
]);

// ─── Tab Bar ──────────────────────────────────────────────────────────────────
const TABS = [
  { name: 'Profile', label: 'Perfil',   emoji: '👤' },
  { name: 'Lobby',   label: 'Jugar',    emoji: '🎲' },
  { name: 'Ranking', label: 'Ranking',  emoji: '🏆' },
];

function TabBar({ navigation, currentRoute }: { navigation: any; currentRoute: string }) {
  const insets = useSafeAreaInsets();

  if (HIDE_TAB_SCREENS.has(currentRoute)) return null;

  return (
    <View style={[
      tabStyles.container,
      { paddingBottom: Math.max(insets.bottom, 8) },
    ]}>
      {TABS.map(tab => {
        const active = currentRoute === tab.name;
        return (
          <TouchableOpacity
            key={tab.name}
            style={tabStyles.tab}
            onPress={() => navigation.navigate(tab.name)}
            activeOpacity={0.7}
          >
            <View style={[tabStyles.iconWrap, active && tabStyles.iconWrapActive]}>
              <Text style={tabStyles.emoji}>{tab.emoji}</Text>
            </View>
            <Text style={[tabStyles.label, active && tabStyles.labelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const tabStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: CARD,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 8,
  },
  tab: {
    flex: 1, alignItems: 'center', gap: 3,
  },
  iconWrap: {
    width: 44, height: 34, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: PURPLE + '25',
  },
  emoji:       { fontSize: 20 },
  label:       { fontSize: 10, fontWeight: '600', color: MUTED },
  labelActive: { color: PURPLE, fontWeight: '800' },
});

// ─── Navigator ────────────────────────────────────────────────────────────────
const Stack = createStackNavigator();

function AppNavigator() {
  useWebSocket();

  return (
    <Stack.Navigator
      initialRouteName="Auth"
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: BG },
        animationEnabled: true,
      }}
    >
      {/* Auth */}
      <Stack.Screen name="Auth"    component={AuthScreen} options={{ animationEnabled: false }} />

      {/* Tab screens */}
      <Stack.Screen name="Lobby"   component={LobbyScreen} />
      <Stack.Screen name="Ranking" component={RankingScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />

      {/* Game flow — sin tab bar */}
      <Stack.Screen name="WaitingRoom"  component={WaitingRoomScreen} />
      <Stack.Screen name="Game"         component={GameScreen} />
      <Stack.Screen name="RoundResults" component={RoundResultsScreen} />
      <Stack.Screen name="GameOver"     component={GameOverScreen} />
      <Stack.Screen name="Spectator"    component={SpectatorScreen} />
    </Stack.Navigator>
  );
}

// ─── Navigation ref para TabBar externa ──────────────────────────────────────
const navigationRef = createNavigationContainerRef();

export default function App() {
  const [currentRoute, setCurrentRoute] = React.useState('Auth');

  return (
    <SafeAreaProvider>
      <NavigationContainer
        ref={navigationRef}
        onStateChange={(state) => {
          if (!state) return;
          const route = state.routes[state.index];
          setCurrentRoute(route?.name ?? 'Lobby');
        }}
      >
        <View style={{ flex: 1, backgroundColor: BG }}>
          <AppNavigator />
          <TabBar
            navigation={navigationRef}
            currentRoute={currentRoute}
          />
        </View>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}