import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import LobbyScreen        from './src/screens/LobbyScreen';
import WaitingRoomScreen  from './src/screens/WaitingRoomScreen';
import GameScreen         from './src/screens/GameScreen';
import RoundResultsScreen from './src/screens/RoundResultsScreen';
import GameOverScreen     from './src/screens/GameOverScreen';

const Stack = createStackNavigator();

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Lobby"
          screenOptions={{
            headerShown: false,
            cardStyle: { backgroundColor: '#0F0F1A' },
          }}
        >
          {/* 1. Lobby: crear / unirse con código */}
          <Stack.Screen name="Lobby" component={LobbyScreen} />

          {/* 2. Sala de espera: jugadores conectados */}
          <Stack.Screen name="WaitingRoom" component={WaitingRoomScreen} />

          {/* 3-5. Tablero de juego: 9 dados + 2 secretos + selector de 3 */}
          <Stack.Screen name="Game" component={GameScreen} />

          {/* 6. Resultados de ronda con marcador acumulado */}
          <Stack.Screen name="RoundResults" component={RoundResultsScreen} />

          {/* 7. Fin de partida: ranking final + revancha */}
          <Stack.Screen name="GameOver" component={GameOverScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
