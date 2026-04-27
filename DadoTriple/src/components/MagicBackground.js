import React, {useEffect, useMemo, useRef} from 'react';
import {Animated, StyleSheet, View} from 'react-native';
import {colors} from '../theme';

const SYMBOLS = ['✦', '◇', '◆', '⚀', '⚂', '⚄'];

export default function MagicBackground({intensity = 1}) {
  const items = useMemo(
    () =>
      Array.from({length: 14}).map((_, index) => ({
        key: `sigil-${index}`,
        symbol: SYMBOLS[index % SYMBOLS.length],
        left: `${(index * 17) % 96}%`,
        top: `${8 + ((index * 23) % 84)}%`,
        size: 14 + (index % 5) * 5,
        delay: index * 230,
        opacity: (0.06 + (index % 4) * 0.025) * intensity,
      })),
    [intensity],
  );

  const pulses = useRef(items.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const loops = pulses.map((pulse, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(items[index].delay),
          Animated.timing(pulse, {
            toValue: 1,
            duration: 2400 + index * 90,
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 0,
            duration: 2400 + index * 90,
            useNativeDriver: true,
          }),
        ]),
      ),
    );
    loops.forEach(loop => loop.start());
    return () => loops.forEach(loop => loop.stop());
  }, [items, pulses]);

  return (
    <View pointerEvents="none" style={styles.container}>
      <View style={styles.bandTop} />
      <View style={styles.bandBottom} />
      {items.map((item, index) => {
        const translateY = pulses[index].interpolate({
          inputRange: [0, 1],
          outputRange: [0, -12],
        });
        const rotate = pulses[index].interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', index % 2 ? '-10deg' : '10deg'],
        });
        return (
          <Animated.Text
            key={item.key}
            style={[
              styles.symbol,
              {
                left: item.left,
                top: item.top,
                fontSize: item.size,
                opacity: item.opacity,
                transform: [{translateY}, {rotate}],
              },
            ]}>
            {item.symbol}
          </Animated.Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bg,
    overflow: 'hidden',
  },
  bandTop: {
    position: 'absolute',
    left: -80,
    right: -80,
    top: 36,
    height: 180,
    backgroundColor: colors.purpleDark,
    opacity: 0.12,
    transform: [{rotate: '-11deg'}],
  },
  bandBottom: {
    position: 'absolute',
    left: -70,
    right: -70,
    bottom: 32,
    height: 150,
    backgroundColor: colors.gold,
    opacity: 0.08,
    transform: [{rotate: '9deg'}],
  },
  symbol: {
    position: 'absolute',
    color: colors.white,
    fontWeight: '900',
  },
});
