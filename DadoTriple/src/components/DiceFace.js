import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {colors} from '../theme';

const PIPS = {
  1: ['mc'],
  2: ['tl', 'br'],
  3: ['tl', 'mc', 'br'],
  4: ['tl', 'tr', 'bl', 'br'],
  5: ['tl', 'tr', 'mc', 'bl', 'br'],
  6: ['tl', 'tr', 'ml', 'mr', 'bl', 'br'],
};

const COORDS = {
  tl: [0.28, 0.28],
  tr: [0.72, 0.28],
  ml: [0.28, 0.5],
  mc: [0.5, 0.5],
  mr: [0.72, 0.5],
  bl: [0.28, 0.72],
  br: [0.72, 0.72],
};

export default function DiceFace({
  value,
  size = 44,
  pipColor = colors.text,
  faceColor = colors.cardRaised,
  borderColor = colors.border,
  hidden = false,
  muted = false,
  style,
}) {
  const pipSize = Math.max(4, Math.round(size * 0.15));
  const radius = Math.round(size * 0.22);
  const pips = PIPS[value] ?? [];

  return (
    <View
      style={[
        styles.face,
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: hidden ? colors.bg2 : faceColor,
          borderColor: hidden ? borderColor + '80' : borderColor,
        },
        muted && styles.faceMuted,
        style,
      ]}>
      {hidden || pips.length === 0 ? (
        <Text
          style={[styles.hiddenMark, {fontSize: size * 0.48, color: pipColor}]}>
          ?
        </Text>
      ) : (
        pips.map(key => {
          const [x, y] = COORDS[key];
          return (
            <View
              key={key}
              style={[
                styles.pip,
                {
                  width: pipSize,
                  height: pipSize,
                  borderRadius: pipSize / 2,
                  backgroundColor: pipColor,
                  left: size * x - pipSize / 2,
                  top: size * y - pipSize / 2,
                },
              ]}
            />
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  face: {
    borderWidth: 1.5,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceMuted: {
    opacity: 0.42,
  },
  pip: {
    position: 'absolute',
  },
  hiddenMark: {
    fontWeight: '900',
  },
});
