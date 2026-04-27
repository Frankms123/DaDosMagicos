import React, {useRef} from 'react';
import {Animated, Pressable, StyleSheet, Text} from 'react-native';
import {colors, radius, shadows} from '../theme';
import {playSound} from '../services/soundService';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const VARIANTS = {
  primary: {bg: colors.purple, shadow: shadows.purple},
  gold: {bg: colors.gold, shadow: shadows.gold},
  green: {bg: colors.green, shadow: shadows.green},
  danger: {bg: colors.red, shadow: shadows.gold},
  quiet: {bg: colors.cardRaised, shadow: {}},
};

export default function GameButton({
  children,
  title,
  variant = 'primary',
  disabled = false,
  onPress,
  style,
  textStyle,
  sound = 'click',
  volume = 0.6,
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const meta = VARIANTS[variant] ?? VARIANTS.primary;

  const animateTo = value => {
    Animated.spring(scale, {
      toValue: value,
      useNativeDriver: true,
      speed: 45,
      bounciness: 7,
    }).start();
  };

  const handlePress = event => {
    if (disabled) {
      return;
    }
    if (sound) {
      playSound(sound, volume);
    }
    onPress && onPress(event);
  };

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={() => animateTo(0.96)}
      onPressOut={() => animateTo(1)}
      disabled={disabled}
      style={[
        styles.button,
        {backgroundColor: meta.bg, transform: [{scale}]},
        meta.shadow,
        disabled && styles.disabled,
        style,
      ]}>
      {children ?? <Text style={[styles.text, textStyle]}>{title}</Text>}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 54,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  text: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '800',
  },
  disabled: {
    opacity: 0.48,
    shadowOpacity: 0,
  },
});
