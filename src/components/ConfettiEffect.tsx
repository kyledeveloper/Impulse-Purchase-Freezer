import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions, Text } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ConfettiEffectProps {
  onComplete?: () => void;
}

export const ConfettiEffect: React.FC<ConfettiEffectProps> = ({ onComplete }) => {
  const particles = useRef(
    Array.from({ length: 24 }).map(() => ({
      x: Math.random() * (SCREEN_WIDTH - 40),
      animY: new Animated.Value(-50),
      animRot: new Animated.Value(0),
      opacity: new Animated.Value(1),
      char: ['🪙', '✨', '💰', '❄️', '⭐'][Math.floor(Math.random() * 5)],
      duration: 1800 + Math.random() * 800,
      delay: Math.random() * 400,
    }))
  ).current;

  useEffect(() => {
    const animations = particles.map((p) =>
      Animated.sequence([
        Animated.delay(p.delay),
        Animated.parallel([
          Animated.timing(p.animY, {
            toValue: SCREEN_HEIGHT - 100,
            duration: p.duration,
            useNativeDriver: true,
          }),
          Animated.timing(p.animRot, {
            toValue: 1,
            duration: p.duration,
            useNativeDriver: true,
          }),
          Animated.timing(p.opacity, {
            toValue: 0,
            duration: p.duration,
            delay: p.duration * 0.7,
            useNativeDriver: true,
          }),
        ]),
      ])
    );

    Animated.parallel(animations).start(() => {
      onComplete?.();
    });
  }, [particles, onComplete]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map((p, i) => {
        const spin = p.animRot.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', '720deg'],
        });

        return (
          <Animated.View
            key={i}
            style={[
              styles.particle,
              {
                left: p.x,
                opacity: p.opacity,
                transform: [{ translateY: p.animY }, { rotate: spin }],
              },
            ]}
          >
            <Text style={styles.particleEmoji}>{p.char}</Text>
          </Animated.View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  particle: {
    position: 'absolute',
    top: 0,
    zIndex: 9999,
  },
  particleEmoji: {
    fontSize: 26,
  },
});
