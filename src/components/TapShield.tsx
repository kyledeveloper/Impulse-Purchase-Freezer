import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Animated,
  Pressable,
} from 'react-native';
import { ASSETS } from '../constants/assets';
import { AudioService } from '../services/audio';
import { HapticsService } from '../services/haptics';
import { FreezerItem } from '../types';

interface TapShieldProps {
  item: FreezerItem;
  itemImage: any;
  rawCutoutImage?: any;
  tapsRemaining: number;
  calmWaitBonus?: number;
  countdownProgressPercent?: number;
  onTapBreaker: () => void;
  onChillBoost: () => void;
}

export const TapShield: React.FC<TapShieldProps> = ({
  item,
  itemImage,
  rawCutoutImage,
  tapsRemaining,
  calmWaitBonus = 0,
  countdownProgressPercent = 0,
  onTapBreaker,
  onChillBoost,
}) => {
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  // Chill breathing progress
  const [isPressingChill, setIsPressingChill] = useState(false);
  const chillProgressAnim = useRef(new Animated.Value(0)).current;
  const chillTimerRef = useRef<any>(null);

  // Floating idle loop
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -5,
          duration: 1400,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 4,
          duration: 1400,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [floatAnim]);

  // Determine melting stage naturally from countdown (0 -> 30 -> 60 -> 90 -> 100)
  const getNaturalMeltStage = () => {
    if (countdownProgressPercent >= 98) return 100;
    if (countdownProgressPercent >= 75) return 90;
    if (countdownProgressPercent >= 45) return 60;
    if (countdownProgressPercent >= 20) return 30;
    return 0;
  };

  const naturalMeltStage = getNaturalMeltStage();

  // Cracking overlay based on remaining taps
  const getCrackOverlay = () => {
    if (tapsRemaining <= 15) return ASSETS.iceCubeCrackOverlay90;
    if (tapsRemaining <= 45) return ASSETS.iceCubeCrackOverlay60;
    if (tapsRemaining <= 75) return ASSETS.iceCubeCrackOverlay30;
    return null;
  };

  const getMeltAsset = () => {
    switch (naturalMeltStage) {
      case 100:
        return ASSETS.iceCubeMeltPuddle;
      case 90:
        return ASSETS.iceCubeMelt90;
      case 60:
        return ASSETS.iceCubeMelt60;
      case 30:
        return ASSETS.iceCubeMelt30;
      default:
        return ASSETS.iceCubeSolid;
    }
  };

  const triggerBreakerImpact = () => {
    Animated.parallel([
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: -9, duration: 35, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 9, duration: 35, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -5, duration: 35, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 5, duration: 35, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 35, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 0.94, duration: 40, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1.03, duration: 60, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 50, useNativeDriver: true }),
      ]),
    ]).start();

    AudioService.playIceCrackSound();
    HapticsService.mediumTap();
    onTapBreaker();
  };

  // Chill breathing press handlers
  const handleChillPressIn = () => {
    setIsPressingChill(true);
    HapticsService.lightTap();
    chillProgressAnim.setValue(0);

    Animated.timing(chillProgressAnim, {
      toValue: 1,
      duration: 3000,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) {
        // Successfully held for 3s
        setIsPressingChill(false);
        HapticsService.victorySuccess();
        AudioService.playCoinSound();
        onChillBoost();
        chillProgressAnim.setValue(0);
      }
    });
  };

  const handleChillPressOut = () => {
    if (isPressingChill) {
      setIsPressingChill(false);
      chillProgressAnim.stopAnimation();
      chillProgressAnim.setValue(0);
    }
  };

  const crackOverlay = getCrackOverlay();
  const meltAsset = getMeltAsset();

  const getProductSource = () => {
    if (rawCutoutImage) return rawCutoutImage;
    if (itemImage === ASSETS.frozenPhone || itemImage === ASSETS.icePhone || !itemImage) {
      return ASSETS.phoneClean;
    }
    return itemImage;
  };

  const productSource = getProductSource();
  const isPhoneFullSize =
    productSource === ASSETS.phoneClean ||
    productSource === ASSETS.frozenPhone ||
    productSource === ASSETS.icePhone;

  // Status headline description
  const getStatusHeadline = () => {
    if (naturalMeltStage >= 100) {
      return '✨ 坚冰完全消融 · 商品已破冰，待理智抉择';
    }
    if (tapsRemaining < 60) {
      return `💥 破冰阻断进行中 · 剩余 ${tapsRemaining} 次物理摩擦`;
    }
    if (naturalMeltStage >= 60) {
      return `🌊 消融过半 (${countdownProgressPercent}%) · 冲动多巴胺已大幅回落`;
    }
    if (naturalMeltStage >= 30) {
      return `💧 表层初融 (${countdownProgressPercent}%) · 理智正在逐渐觉醒`;
    }
    return `🧊 深度冷冻禁闭 (${countdownProgressPercent}%) · 冰封坚固稳固`;
  };

  return (
    <View style={styles.container}>
      {/* 1. Natural Ice Stage */}
      <View style={styles.iceSceneWrapper}>
        <Animated.View
          style={[
            styles.iceContainer,
            {
              transform: [{ translateX: shakeAnim }, { scale: scaleAnim }],
            },
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={triggerBreakerImpact}
            style={styles.iceTouchable}
          >
            {naturalMeltStage === 100 ? (
              // 100% Fully Melted Puddle
              <>
                <Image
                  source={ASSETS.iceCubeMeltPuddle}
                  style={styles.iceBlockImg}
                  resizeMode="contain"
                />
                <Animated.View
                  style={[
                    styles.floatingProductContainer,
                    { transform: [{ translateY: floatAnim }] },
                  ]}
                >
                  <Image
                    source={productSource}
                    style={isPhoneFullSize ? styles.iceBlockImg : styles.thawedProductFloating}
                    resizeMode="contain"
                  />
                </Animated.View>
              </>
            ) : naturalMeltStage > 0 ? (
              // Partially melted
              <>
                <Image
                  source={productSource}
                  style={isPhoneFullSize ? styles.iceBlockImg : styles.meltingProductImg}
                  resizeMode="contain"
                />
                <Image
                  source={meltAsset}
                  style={[styles.iceBlockImg, styles.iceMeltOverlay]}
                  resizeMode="contain"
                />
                {crackOverlay && (
                  <Image
                    source={crackOverlay}
                    style={styles.crackOverlayImg}
                    resizeMode="contain"
                  />
                )}
              </>
            ) : (
              // 0% Solid Ice Cube
              <>
                <Image
                  source={productSource}
                  style={isPhoneFullSize ? styles.iceBlockImg : styles.meltingProductImg}
                  resizeMode="contain"
                />
                <Image
                  source={ASSETS.iceCubeSolid}
                  style={[styles.iceBlockImg, styles.iceSolidOverlay]}
                  resizeMode="contain"
                />
                {crackOverlay && (
                  <Image
                    source={crackOverlay}
                    style={styles.crackOverlayImg}
                    resizeMode="contain"
                  />
                )}
              </>
            )}
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* 2. Natural Status Badge */}
      <View style={styles.statusBadge}>
        <Text style={styles.statusBadgeText}>{getStatusHeadline()}</Text>
      </View>

      {/* 3. Core Gameplay Action 1: ❄️【急冻深呼吸·按住注冷】(Chill Boost) */}
      <View style={styles.chillCard}>
        <Pressable
          onPressIn={handleChillPressIn}
          onPressOut={handleChillPressOut}
          style={({ pressed }) => [
            styles.chillBtn,
            pressed && styles.chillBtnPressed,
          ]}
        >
          <View style={styles.chillContent}>
            <View style={styles.chillIconBadge}>
              <Text style={styles.chillEmoji}>{isPressingChill ? '💨' : '❄️'}</Text>
            </View>
            <View style={styles.chillTextCol}>
              <Text style={styles.chillTitle}>
                {isPressingChill ? '深度吸气·保持按住...' : '按住注入理智冷气 (急冻深呼吸)'}
              </Text>
              <Text style={styles.chillSub}>
                {isPressingChill
                  ? '持续按住 3 秒注入冰晶，平复多巴胺躁动'
                  : `长按 3 秒获得自控力经验 · 当前已冷静注冷 ${calmWaitBonus} 次`}
              </Text>
            </View>
          </View>

          {/* Animated Progress Bar along bottom */}
          {isPressingChill && (
            <View style={styles.chillProgressTrack}>
              <Animated.View
                style={[
                  styles.chillProgressFill,
                  {
                    width: chillProgressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                  },
                ]}
              />
            </View>
          )}
        </Pressable>
      </View>

      {/* 4. Core Gameplay Action 2: 🔨【强行破冰关卡】(Willpower Friction Challenge) */}
      <View style={styles.breakerCard}>
        <View style={styles.breakerHeaderRow}>
          <Text style={styles.breakerTitle}>🔨 破冰阻断意志挑战</Text>
          <Text style={styles.breakerTapsLeft}>{tapsRemaining}/100 次阻断点击</Text>
        </View>

        <TouchableOpacity
          style={styles.breakerActionBtn}
          activeOpacity={0.8}
          onPress={triggerBreakerImpact}
        >
          <Image source={ASSETS.btnIceBreaker} style={styles.breakerBtnImg} resizeMode="contain" />
        </TouchableOpacity>

        <Text style={styles.breakerTip}>
          💡 提示：若非要提前强行解冻，需攻破 100 次冰层阻断并在 25/50/75/100 阈值接受灵魂拷问。
        </Text>
      </View>

      {/* 5. Opportunity Cost Transformer (欲望天平·替代价值) */}
      <View style={styles.costCard}>
        <View style={styles.costHeader}>
          <Text style={styles.costTitle}>⚖️ 欲望天平 · 替代生活价值</Text>
          <Text style={styles.costBadge}>省下 ¥{item.price.toLocaleString('zh-CN')} 等同于</Text>
        </View>

        <View style={styles.costGrid}>
          <View style={styles.costItem}>
            <Text style={styles.costEmoji}>☕</Text>
            <Text style={styles.costNum}>{Math.max(1, Math.round(item.price / 35))} 杯</Text>
            <Text style={styles.costLabel}>精品拿铁咖啡</Text>
          </View>
          <View style={styles.costItem}>
            <Text style={styles.costEmoji}>🍱</Text>
            <Text style={styles.costNum}>{Math.max(1, Math.round(item.price / 45))} 顿</Text>
            <Text style={styles.costLabel}>营养轻食餐</Text>
          </View>
          <View style={styles.costItem}>
            <Text style={styles.costEmoji}>🎬</Text>
            <Text style={styles.costNum}>{Math.max(1, Math.round(item.price / 60))} 次</Text>
            <Text style={styles.costLabel}>周末IMAX观影</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 4,
    marginTop: 2,
  },
  iceSceneWrapper: {
    width: '100%',
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginVertical: 4,
  },
  iceContainer: {
    width: 203,
    height: 210,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  iceTouchable: {
    width: 203,
    height: 210,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  iceBlockImg: {
    width: 203,
    height: 210,
  },
  iceMeltOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 203,
    height: 210,
    zIndex: 3,
    opacity: 0.78,
  },
  iceSolidOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 203,
    height: 210,
    zIndex: 3,
    opacity: 0.85,
  },
  floatingProductContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 203,
    height: 210,
    zIndex: 4,
  },
  meltingProductImg: {
    position: 'absolute',
    top: 40,
    left: 49,
    width: 105,
    height: 110,
    zIndex: 2,
  },
  crackOverlayImg: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 203,
    height: 210,
    zIndex: 10,
  },
  thawedProductFloating: {
    position: 'absolute',
    top: 40,
    left: 49,
    width: 105,
    height: 110,
    zIndex: 4,
  },
  statusBadge: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderColor: '#38BDF8',
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 16,
    marginVertical: 8,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#E0F2FE',
    letterSpacing: 0.3,
  },
  // Chill Boost Card
  chillCard: {
    width: '100%',
    marginBottom: 10,
  },
  chillBtn: {
    backgroundColor: 'rgba(6, 182, 212, 0.16)',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#06B6D4',
    padding: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  chillBtnPressed: {
    backgroundColor: 'rgba(6, 182, 212, 0.3)',
    borderColor: '#38BDF8',
  },
  chillContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  chillIconBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(6, 182, 212, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#06B6D4',
  },
  chillEmoji: {
    fontSize: 22,
  },
  chillTextCol: {
    flex: 1,
  },
  chillTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#67E8F9',
    marginBottom: 2,
  },
  chillSub: {
    fontSize: 10,
    color: '#94A3B8',
    lineHeight: 14,
  },
  chillProgressTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  chillProgressFill: {
    height: '100%',
    backgroundColor: '#38BDF8',
  },
  // Breaker Card
  breakerCard: {
    width: '100%',
    backgroundColor: '#0F1E36',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#1E3A5F',
    padding: 12,
    marginBottom: 10,
  },
  breakerHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  breakerTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  breakerTapsLeft: {
    fontSize: 11,
    fontWeight: '900',
    color: '#F59E0B',
  },
  breakerActionBtn: {
    width: '100%',
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  breakerBtnImg: {
    width: '100%',
    height: 46,
  },
  breakerTip: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 6,
    lineHeight: 14,
  },
  // Opportunity Cost Card
  costCard: {
    width: '100%',
    backgroundColor: '#0F1E36',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#1E3A5F',
    padding: 12,
    marginBottom: 10,
  },
  costHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  costTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#E2E8F0',
  },
  costBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FBBF24',
  },
  costGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  costItem: {
    flex: 1,
    backgroundColor: '#13233F',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E3A5F',
  },
  costEmoji: {
    fontSize: 20,
    marginBottom: 2,
  },
  costNum: {
    fontSize: 12,
    fontWeight: '900',
    color: '#38BDF8',
    marginVertical: 2,
  },
  costLabel: {
    fontSize: 9,
    color: '#94A3B8',
    fontWeight: '600',
  },
});
