# Dado Triple - Juego de Dados Multijugador

Este es un proyecto de juego de dados multijugador en tiempo real basado en una arquitectura cliente-servidor con WebSockets.

## Cómo ejecutar el proyecto

Para correr el proyecto completo, necesitarás tener instalado **Node.js** y **MongoDB** corriendo en tu máquina (o una URI de MongoDB Atlas).

### 1. Configuración del Backend

1.  **Entrar a la carpeta**:
    cd backend

2.  **Instalar dependencias**:
    npm install
    
3.  **Configurar variables de entorno**:
    Asegúrate de que el archivo `.env` en `backend/.env` tenga la configuración correcta para tu base de datos:
       env
    PORT=3001
    MONGO_URI=mongodb+srv://DadosUser:Bolachile200@dadosmagicos.s78oqlm.mongodb.net/?appName=DaDosMagicos
    JWT_SECRET=tu_secreto_super_seguro
    NODE_ENV=development
    
4.  **Iniciar el servidor**:
    - Para desarrollo (con recarga automática):
      npm run dev

    - Para producción:
      npm start


### 2. Configuración del Frontend

1.  Entrar a la carpeta**:
    cd frontend

2.  Instalar dependencias**:
    npm install

3.  Iniciar Expo**:
    npm start

4.  Ejecutar en un dispositivo/emulador**:
    - Presiona `a` para Android (requiere emulador o dispositivo conectado).
    - Presiona `i` para iOS (requiere macOS y simulador de Xcode).
    - Escanea el código QR con la app **Expo Go** en tu móvil para probar en un dispositivo real.

---

## Estructura del Proyecto

### Backend (Node.js + Express + Socket.io)
- **src/server.js**: Punto de entrada del servidor y configuración de HTTP/WebSockets.
- **src/app.js**: Configuración de Express y middlewares.
- **src/gateway/socketHandler.js**: Lógica de gestión de conexiones WebSockets y eventos de juego.
- **src/engine/gameEngine.js**: Motor de juego que maneja los tiros de dados y cálculo de puntuación.
- **src/models**: (Estructura creada) Esquemas de MongoDB para perfiles de usuario y partidas.

### Frontend (React Native + Expo + Zustand)
- **App.js**: Punto de entrada de la aplicación.
- **src/screens/GameScreen.js**: Pantalla principal del juego con tablero y tiro de dados.
- **src/services/socketService.js**: Cliente de WebSockets para comunicación con el servidor.
- **src/store/useGameStore.js**: Gestión del estado global del juego mediante Zustand.
- **src/hooks/useWebSocket.js**: Hook personalizado para manejar la sincronización del estado en tiempo real.

## Tecnologías utilizadas
- **Backend**: Node.js, Express, Socket.io, Mongoose.
- **Frontend**: React Native (Expo), Zustand, Socket.io-client.
- **Base de Datos**: MongoDB.
