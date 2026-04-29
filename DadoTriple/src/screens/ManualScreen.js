import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, ChevronRight, AlertTriangle, Lightbulb } from 'lucide-react-native';
import MagicBackground from '../components/MagicBackground';
import { colors, shadows } from '../theme';

const BG = colors.bg;
const CARD = colors.card;
const BORDER = colors.border;
const TEXT = colors.text;
const MUTED = colors.muted;
const PURPLE = colors.purple;
const GOLD = colors.gold;
const GREEN = colors.green;
const RED = colors.red;

const BLUE = colors.blue;
const SILVER = colors.silver;

export default function ManualScreen({ navigation, route }) {
  const isOnboarding = route.params?.onboarding ?? false;

  const handleClose = () => {
    if (isOnboarding) {
      navigation.replace('Lobby');
    } else {
      navigation.goBack();
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <MagicBackground intensity={0.4} />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Manual del Jugador</Text>
        <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
          <X size={24} color={TEXT} />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scroll} 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.cover}>
          <Text style={styles.title}>Dado Triple</Text>
          <Text style={styles.sub}>Manual del jugador</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Temporada 2 — El plan del diablo</Text>
          </View>
        </View>

        {/* Estructura de la partida */}
        <View style={styles.section}>
          <Text style={styles.secTitle}>Estructura de la partida</Text>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statNum}>3</Text>
              <Text style={styles.statLabel}>lanzamientos</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNum}>3</Text>
              <Text style={styles.statLabel}>rondas</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNum}>11</Text>
              <Text style={styles.statLabel}>dados</Text>
            </View>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardText}>
              Cada lanzamiento abarca 3 rondas. Después de cada lanzamiento haces una predicción. Al terminar las 3 rondas se comparan manos y se asignan puntos de posición.
            </Text>
          </View>
        </View>

        {/* Manos */}
        <View style={styles.section}>
          <Text style={styles.secTitle}>Manos, de mejor a peor</Text>
          
          <View style={styles.comboRow}>
            <View style={[styles.rank, styles.r1]}><Text style={styles.rankText}>1</Text></View>
            <View style={styles.comboInfo}>
              <Text style={styles.comboName}>Trío</Text>
              <Text style={styles.comboDesc}>3 dados con el mismo número</Text>
            </View>
            <View style={[styles.tag, styles.tg]}><Text style={styles.tagText}>Mejor mano</Text></View>
          </View>

          <View style={styles.comboRow}>
            <View style={[styles.rank, styles.r2]}><Text style={styles.rankText}>2</Text></View>
            <View style={styles.comboInfo}>
              <Text style={styles.comboName}>Escalera</Text>
              <Text style={styles.comboDesc}>Secuencia consecutiva de dados</Text>
            </View>
            <View style={[styles.tag, styles.tb]}><Text style={styles.tagText}>Segunda</Text></View>
          </View>

          <View style={styles.comboRow}>
            <View style={[styles.rank, styles.r3]}><Text style={styles.rankText}>3</Text></View>
            <View style={styles.comboInfo}>
              <Text style={styles.comboName}>Par</Text>
              <Text style={styles.comboDesc}>2 dados con el mismo número</Text>
            </View>
            <View style={[styles.tag, styles.tp]}><Text style={styles.tagText}>Tercera</Text></View>
          </View>

          <View style={styles.comboRow}>
            <View style={[styles.rank, styles.r4]}><Text style={[styles.rankText, styles.r4Text]}>4</Text></View>
            <View style={styles.comboInfo}>
              <Text style={styles.comboName}>Nada</Text>
              <Text style={styles.comboDesc}>Sin combinación válida</Text>
            </View>
            <View style={[styles.tag, styles.tgr]}><Text style={styles.tagText}>Peor mano</Text></View>
          </View>
        </View>

        {/* Puntos por posición */}
        <View style={styles.section}>
          <Text style={styles.secTitle}>Puntos por posición</Text>
          <View style={styles.ptsRow}>
            <View style={styles.ptsPlace}><Text style={[styles.placeNum, styles.p1]}>6</Text><Text style={styles.placeLabel}>1er lugar</Text></View>
            <View style={styles.ptsPlace}><Text style={[styles.placeNum, styles.p2]}>3</Text><Text style={styles.placeLabel}>2do lugar</Text></View>
            <View style={styles.ptsPlace}><Text style={[styles.placeNum, styles.p3]}>1</Text><Text style={styles.placeLabel}>3er lugar</Text></View>
            <View style={styles.ptsPlace}><Text style={[styles.placeNum, styles.p4]}>0</Text><Text style={styles.placeLabel}>último</Text></View>
          </View>
        </View>

        {/* Predicción */}
        <View style={styles.section}>
          <Text style={styles.secTitle}>Predicción (una por lanzamiento)</Text>
          <View style={styles.card}>
            <Text style={styles.cardText}>
              Después de cada lanzamiento debes predecir cuántos puntos de posición obtendrás en las 3 rondas. Si aciertas, se duplican tus puntos — o ganas 40 fijos si predijiste cero y cumpliste.
            </Text>
          </View>

          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, { flex: 1.2 }]}>Tu predicción</Text>
              <Text style={[styles.tableHeaderText, { flex: 2 }]}>Condición</Text>
              <Text style={[styles.tableHeaderText, { flex: 1.2 }]}>Premio</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={[styles.tableCell, { flex: 1.2 }]}>Más de 10 pts</Text>
              <Text style={[styles.tableCell, { flex: 2 }]}>Obtienes 11 o más</Text>
              <Text style={[styles.tableCell, styles.bonus, { flex: 1.2 }]}>x2 puntos</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={[styles.tableCell, { flex: 1.2 }]}>Entre 7 y 10</Text>
              <Text style={[styles.tableCell, { flex: 2 }]}>Obtienes 7 a 10</Text>
              <Text style={[styles.tableCell, styles.bonus, { flex: 1.2 }]}>x2 puntos</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={[styles.tableCell, { flex: 1.2 }]}>Entre 1 y 7</Text>
              <Text style={[styles.tableCell, { flex: 2 }]}>Obtienes 1 a 7</Text>
              <Text style={[styles.tableCell, styles.bonus, { flex: 1.2 }]}>x2 puntos</Text>
            </View>
            <View style={[styles.tableRow, { borderBottomWidth: 0 }]}>
              <Text style={[styles.tableCell, { flex: 1.2 }]}>0 puntos</Text>
              <Text style={[styles.tableCell, { flex: 2 }]}>Exactamente 0</Text>
              <Text style={[styles.tableCell, styles.special, { flex: 1.2 }]}>+40 fijos</Text>
            </View>
          </View>

          <View style={styles.warnBox}>
            <AlertTriangle size={16} color="#633806" style={{ marginRight: 8 }} />
            <Text style={styles.warnText}>Si la predicción no se cumple, recibes los puntos normales sin ningún bono.</Text>
          </View>
        </View>

        {/* Cómo se juega */}
        <View style={styles.section}>
          <Text style={styles.secTitle}>Cómo se juega</Text>
          
          <Step num="1" title="Lanza todos tus dados" text="Tira los 9 dados visibles (todos los ven) y los 2 dados ocultos (solo tú los ves). Los ocultos te permiten mejorar tu mano en secreto." />
          <Step num="2" title="Haz tu predicción" text="Después de lanzar, declara cuántos puntos de posición crees que ganarás en las 3 rondas del lanzamiento." />
          <Step num="3" title="Se juegan 3 rondas" text="En cada ronda se comparan las manos. Trío gana sobre escalera, escalera sobre par, par sobre nada." />
          <Step num="4" title="Se verifica la predicción" text="Al terminar las 3 rondas se suman tus puntos. Si coinciden con tu predicción, recibes el bono correspondiente." />
          <Step num="5" title="Nuevo lanzamiento" text="Se repite el ciclo. La partida tiene 3 lanzamientos en total. Gana quien acumule más puntos al final." />

          <View style={styles.tipBox}>
            <Lightbulb size={16} color="#27500A" style={{ marginRight: 8 }} />
            <Text style={styles.tipText}>Los dados ocultos son tu ventaja clave. Tus rivales ven tus dados visibles e intentarán adivinar tu mano — pero no saben lo que escondes.</Text>
          </View>
        </View>

        {isOnboarding && (
          <TouchableOpacity style={styles.continueBtn} onPress={handleClose}>
            <Text style={styles.continueBtnText}>Entendido, ¡a jugar!</Text>
            <ChevronRight size={20} color="#FFF" />
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Step({ num, title, text }) {
  return (
    <View style={styles.step}>
      <View style={styles.stepNum}><Text style={styles.stepNumText}>{num}</Text></View>
      <View style={styles.stepBody}>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepText}>{text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: TEXT },
  closeBtn: { padding: 5 },
  scroll: { flex: 1 },
  content: { padding: 20 },
  
  cover: { alignItems: 'center', marginBottom: 30 },
  title: { fontSize: 32, fontWeight: '800', color: TEXT, letterSpacing: -0.5 },
  sub: { fontSize: 14, color: MUTED, marginTop: 4 },
  badge: { 
    backgroundColor: PURPLE + '20', 
    paddingHorizontal: 12, 
    paddingVertical: 4, 
    borderRadius: 20, 
    marginTop: 12,
    borderWidth: 1,
    borderColor: PURPLE + '40',
  },
  badgeText: { color: PURPLE, fontSize: 12, fontWeight: '600' },

  section: { marginBottom: 32 },
  secTitle: { 
    fontSize: 11, 
    fontWeight: '700', 
    color: MUTED, 
    textTransform: 'uppercase', 
    letterSpacing: 1.2, 
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingBottom: 6,
  },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  statCard: { 
    flex: 1, 
    backgroundColor: CARD, 
    borderRadius: 12, 
    padding: 12, 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },
  statNum: { fontSize: 24, fontWeight: '700', color: PURPLE },
  statLabel: { fontSize: 10, color: MUTED, marginTop: 2, textAlign: 'center' },

  card: { 
    backgroundColor: CARD, 
    borderRadius: 12, 
    padding: 16, 
    borderWidth: 1, 
    borderColor: BORDER,
  },
  cardText: { fontSize: 14, color: TEXT, lineHeight: 20 },

  comboRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: CARD, 
    borderRadius: 12, 
    padding: 12, 
    marginBottom: 8,
    borderWidth: 1,
    borderColor: BORDER,
  },
  rank: { 
    width: 28, 
    height: 28, 
    borderRadius: 14, 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginRight: 12 
  },
  rankText: { fontSize: 13, fontWeight: '800', color: colors.black },
  r1: { backgroundColor: GOLD },
  r2: { backgroundColor: SILVER },
  r3: { backgroundColor: PURPLE },
  r4: { backgroundColor: BORDER },
  r4Text: { color: MUTED },
  comboInfo: { flex: 1 },
  comboName: { fontSize: 14, fontWeight: '700', color: TEXT },
  comboDesc: { fontSize: 12, color: MUTED, marginTop: 1 },
  tag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  tagText: { fontSize: 10, fontWeight: '700' },
  tg: { backgroundColor: GOLD + '20', color: GOLD },
  tb: { backgroundColor: SILVER + '20', color: SILVER },
  tp: { backgroundColor: PURPLE + '20', color: PURPLE },
  tgr: { backgroundColor: BORDER, color: MUTED },

  ptsRow: { flexDirection: 'row', gap: 8 },
  ptsPlace: { 
    flex: 1, 
    backgroundColor: CARD, 
    borderRadius: 12, 
    padding: 12, 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },
  placeNum: { fontSize: 22, fontWeight: '700' },
  placeLabel: { fontSize: 10, color: MUTED, marginTop: 2 },
  p1: { color: GOLD },
  p2: { color: '#378ADD' },
  p3: { color: PURPLE },
  p4: { color: MUTED },

  table: { 
    backgroundColor: CARD, 
    borderRadius: 12, 
    borderWidth: 1, 
    borderColor: BORDER, 
    overflow: 'hidden',
    marginTop: 12,
  },
  tableHeader: { 
    flexDirection: 'row', 
    backgroundColor: BORDER, 
    padding: 10 
  },
  tableHeaderText: { fontSize: 11, fontWeight: '700', color: MUTED },
  tableRow: { 
    flexDirection: 'row', 
    padding: 12, 
    borderBottomWidth: 1, 
    borderBottomColor: BORDER 
  },
  tableCell: { fontSize: 12, color: TEXT },
  bonus: { color: GREEN, fontWeight: '700' },
  special: { color: GOLD, fontWeight: '700' },

  warnBox: { 
    backgroundColor: GOLD + '15', 
    borderLeftWidth: 4, 
    borderLeftColor: GOLD, 
    padding: 12, 
    marginTop: 12, 
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: GOLD + '30',
  },
  warnText: { fontSize: 13, color: GOLD, flex: 1, fontWeight: '500' },

  step: { flexDirection: 'row', marginBottom: 16 },
  stepNum: { 
    width: 28, 
    height: 28, 
    borderRadius: 14, 
    backgroundColor: PURPLE + '20', 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginRight: 12,
    borderWidth: 1,
    borderColor: PURPLE + '40',
  },
  stepNumText: { color: PURPLE, fontWeight: '700', fontSize: 14 },
  stepBody: { flex: 1 },
  stepTitle: { fontSize: 15, fontWeight: '700', color: TEXT, marginBottom: 4 },
  stepText: { fontSize: 13, color: MUTED, lineHeight: 18 },

  tipBox: { 
    backgroundColor: GREEN + '15', 
    borderLeftWidth: 4, 
    borderLeftColor: GREEN, 
    padding: 12, 
    marginTop: 10, 
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: GREEN + '30',
  },
  tipText: { fontSize: 13, color: GREEN, flex: 1, fontWeight: '500' },

  continueBtn: {
    backgroundColor: PURPLE,
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    ...shadows.purple,
  },
  continueBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800', marginRight: 8 },
});
