import 'react-native-gesture-handler';
import React from 'react';

import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import LobbyScreen        from './src/screens/LobbyScreen';
import WaitingRoomScreen  from './src/screens/WaitingRoomScreen';
import GameScreen         from './src/screens/GameScreen';
import RoundResultsScreen from './src/screens/RoundResultsScreen';
import GameOverScreen     from './src/screens/GameOverScreen';
import SpectatorScreen   from './src/screens/SpectatorScreen';

import useWebSocket from './src/hooks/useWebSocket';

const Stack = createStackNavigator();



function AppNavigator() {
  useWebSocket();
  return (
    <Stack.Navigator
      initialRouteName="Lobby"
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: '#0F0F1A' },
        animationEnabled: true,
      }}
    >
      <Stack.Screen name="Lobby"        component={LobbyScreen} />
      <Stack.Screen name="WaitingRoom"  component={WaitingRoomScreen} />
      <Stack.Screen name="Game"         component={GameScreen} />
      <Stack.Screen name="RoundResults" component={RoundResultsScreen} />
      <Stack.Screen name="GameOver"     component={GameOverScreen} />
          <Stack.Screen name="Spectator"    component={SpectatorScreen} />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}