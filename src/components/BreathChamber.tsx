import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Easing,
} from 'react-native';
import { HapticsService } from '../services/haptics';
import { BREATH_CONFIG } from '../constants/intervention';

type BreathPhase = 'inhale' | 'hold' | 'exhale';

interface BreathChamberProps {
  visible: boolean;
  onComplete: () => void;   // finished required rounds -> valid intervention
  onAbort: () => void;      // quit before finishing -> no reward
}

const PHASE_META: Record<BreathPhase, { label: string; seconds: number; color: string }> = {
  inhale: { label: '吸气', seconds: BREATH_CONFIG.inhaleSec, color: '#7DD3FC' },
  hold: { label: '屏息', seconds: BREATH_CONFIG.holdSec, color: '#22D3EE' },
  exhale: { label: '呼气', seconds: BREATH_CONFIG.exhaleSec, color: '#0369A1' },
};

const PHASE_ORDER: BreathPhase[] = ['inhale', 'hold', 'exhale'];

export const BreathChamber: React.FC<BreathChamberProps> = ({
  visible,
  onComplete,
  onAbort,
}) => {
  const [phase, setPhase] = useState<BreathPhase>('inhale');
  const [round, setRound] = useState(1);
  const [phaseSecondsLeft, setPhaseSecondsLeft] = useState(BREATH_CONFIG.inhaleSec);

  const orbScale = useRef(new Animated.Value(0.55)).current;
  const orbOpacity = useRef(new Animated.Value(0.85)).current;
  const phaseIndexRef = useRef(0);
  const roundRef = useRef(1);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const runPhaseAnimation = (p: BreathPhase) => {
    animRef.current?.stop();
    if (p === 'inhale') {
      animRef.current = Animated.timing(orbScale, {
        toValue: 1,
        duration: PHASE_META.inhale.seconds * 1000,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      });
    } else if (p === 'exhale') {
      animRef.current = Animated.timing(orbScale, {
        toValue: 0.55,
        duration: PHASE_META.exhale.seconds * 1000,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      });
    } else {
      animRef.current = null; // hold: keep scale
    }
    animRef.current?.start();
  };

  const advancePhase = () => {
    const nextIndex = (phaseIndexRef.current + 1) % PHASE_ORDER.length;
    const nextPhase = PHASE_ORDER[nextIndex];

    if (nextIndex === 0) {
      // completed a full round (exhale -> inhale)
      if (roundRef.current >= BREATH_CONFIG.roundsRequired) {
        clearTimer();
        HapticsService.victorySuccess();
        onComplete();
        return;
      }
      roundRef.current += 1;
      setRound(roundRef.current);
    }

    phaseIndexRef.current = nextIndex;
    setPhase(nextPhase);
    setPhaseSecondsLeft(PHASE_META[nextPhase].seconds);
    HapticsService.lightTap();
    runPhaseAnimation(nextPhase);
  };

  // Countdown ticker for current phase
  useEffect(() => {
    if (!visible) return;
    timerRef.current = setInterval(() => {
      setPhaseSecondsLeft((prev) => {
        if (prev <= 1) {
          advancePhase();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return clearTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Reset state whenever chamber opens
  useEffect(() => {
    if (visible) {
      phaseIndexRef.current = 0;
      roundRef.current = 1;
      setPhase('inhale');
      setRound(1);
      setPhaseSecondsLeft(BREATH_CONFIG.inhaleSec);
      orbScale.setValue(0.55);
      runPhaseAnimation('inhale');
      HapticsService.mediumTap();
    } else {
      clearTimer();
      animRef.current?.stop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const meta = PHASE_META[phase];
  const totalRounds = BREATH_CONFIG.roundsRequired;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onAbort}>
      <View style={styles.overlay}>
        <Text style={styles.title}>❄️ 深呼吸冷静舱</Text>
        <Text style={styles.subtitle}>跟随光球节奏 · 4 秒吸气 → 7 秒屏息 → 8 秒呼气</Text>

        {/* Breathing orb */}
        <View style={styles.orbArea}>
          <Animated.View
            style={[
              styles.orbOuter,
              { transform: [{ scale: orbScale }], opacity: orbOpacity },
            ]}
          >
            <View style={[styles.orbInner, { backgroundColor: meta.color }]} />
          </Animated.View>
          <View style={styles.orbTextBox} pointerEvents="none">
            <Text style={styles.phaseLabel}>{meta.label}</Text>
            <Text style={styles.phaseSeconds}>{phaseSecondsLeft}s</Text>
          </View>
        </View>

        {/* Round indicator */}
        <View style={styles.roundRow}>
          {Array.from({ length: totalRounds }).map((_, i) => (
            <View
              key={i}
              style={[styles.roundDot, i < round && styles.roundDotActive]}
            />
          ))}
          <Text style={styles.roundText}>
            第 {round} / {totalRounds} 轮
          </Text>
        </View>

        <Text style={styles.tip}>完成 {totalRounds} 轮呼吸才算一次有效理智注冷</Text>

        <TouchableOpacity style={styles.abortBtn} activeOpacity={0.8} onPress={onAbort}>
          <Text style={styles.abortBtnText}>提前离开（无奖励）</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(4, 12, 26, 0.96)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: '#E0F2FE',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 12,
    color: '#7DD3FC',
    marginBottom: 32,
  },
  orbArea: {
    width: 260,
    height: 260,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  orbOuter: {
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(125, 211, 252, 0.5)',
  },
  orbInner: {
    width: 150,
    height: 150,
    borderRadius: 75,
    opacity: 0.75,
  },
  orbTextBox: {
    position: 'absolute',
    alignItems: 'center',
  },
  phaseLabel: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  phaseSeconds: {
    fontSize: 16,
    fontWeight: '800',
    color: '#BAE6FD',
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  roundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  roundDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#1E3A5F',
  },
  roundDotActive: {
    backgroundColor: '#38BDF8',
  },
  roundText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    marginLeft: 6,
  },
  tip: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 28,
  },
  abortBtn: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  abortBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
});
