import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { ASSETS } from '../constants/assets';

interface DialGaugeProps {
  remainingMs: number;
}

export const DialGauge: React.FC<DialGaugeProps> = ({ remainingMs }) => {
  // Format remaining time into HH:MM:SS
  const formatTime = (ms: number) => {
    if (ms <= 0) return '00:00:00';
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const pad = (n: number) => (n < 10 ? '0' + n : n.toString());
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  };

  const timeStr = formatTime(remainingMs);

  return (
    <View style={styles.container}>
      <Image source={ASSETS.dialGaugeBlank} style={styles.gaugeBg} />
      <View style={styles.overlay}>
        <Text style={styles.label}>Countdown</Text>
        <Text style={styles.timeDigits}>{timeStr}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  gaugeBg: {
    width: 88,
    height: 88,
    resizeMode: 'contain',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
  },
  label: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timeDigits: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
});
