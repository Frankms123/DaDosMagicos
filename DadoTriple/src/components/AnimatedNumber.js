import React, {useEffect, useRef, useState} from 'react';
import {Animated, Text} from 'react-native';

export default function AnimatedNumber({
  value = 0,
  duration = 650,
  style,
  prefix = '',
  suffix = '',
}) {
  const animated = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    animated.setValue(0);
    const id = animated.addListener(({value: progress}) => {
      setDisplay(Math.round(Number(value || 0) * progress * 10) / 10);
    });
    Animated.timing(animated, {
      toValue: 1,
      duration,
      useNativeDriver: false,
    }).start();
    return () => animated.removeListener(id);
  }, [animated, duration, value]);

  return (
    <Text style={style}>
      {prefix}
      {display}
      {suffix}
    </Text>
  );
}
