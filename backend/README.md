# Dado Triple — Servidor WebSocket

## Instalación

```bash
npm install
cp .env.example .env
# Editar .env con tu conexión a PostgreSQL
npm run dev
```

## Estructura

```
src/
├── index.js                  # Entry point
├── websocket/
│   └── handler.js            # Router de eventos WS + flujo de partida
├── rooms/
│   └── roomManager.js        # Estado en memoria de las salas
├── game/
│   └── gameEngine.js         # Lógica pura: dados, combos, puntos
└── db/
    ├── repository.js          # Persistencia al final de la partida
    └── migration.sql          # Esquema de BD
```

## Protocolo WebSocket

Todos los mensajes siguen la estructura:
```json
{ "type": "nombre_evento", "payload": { ... } }
```

### Eventos que envía el CLIENTE → SERVIDOR

| Evento | Payload | Descripción |
|--------|---------|-------------|
| `create_room` | `{ playerName, maxPlayers? }` | Crear sala nueva |
| `join_room` | `{ roomCode, playerName }` | Unirse con código de 4 letras |
| `player_ready` | `{}` | Marcar que estás listo para empezar |
| `roll_dice` | `{}` | Tirar los 11 dados |
| `select_combo` | `{ comboName }` | Elegir combinación de la ronda |

### Eventos que envía el SERVIDOR → CLIENTE

| Evento | Descripción |
|--------|-------------|
| `room_created` | Sala creada, incluye código y estado |
| `room_joined` | Confirmación de ingreso a sala |
| `player_joined` | Otro jugador se unió |
| `player_ready` | Alguien marcó listo |
| `round_started` | Nueva ronda iniciada |
| `dice_rolled` | Un jugador tiró sus dados |
| `phase_changed` | Cambio de fase (rolling → selecting) |
| `combo_selected` | Un jugador eligió combinación |
| `round_ended` | Ronda terminada con snapshot completo |
| `game_over` | Partida terminada, ganador y logs |
| `player_disconnected` | Jugador se desconectó |
| `error` | Error con mensaje descriptivo |

## Combos disponibles (dados visibles)

| Combo | Puntos |
|-------|--------|
| Seis Iguales | 100 |
| Escalera (1-6) | 60 |
| Cinco Iguales | 50 |
| Póker | 30 |
| Doble Trío | 40 |
| Full House | 25 |
| Trío | 15 |
| Dos Pares | 10 |
| Par | 5 |
| Suma | suma de los 9 dados |

> Los **dados ocultos** otorgan bonus si son iguales entre sí: `valor × 2`