import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Easing,
  Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { FreezerItem, VaultStats } from '../../types';
import { ExpBreakdown, victoryShareText } from '../../constants/decision';
import { PERFECT_DEFENSE_BONUS } from '../../constants/rewards';
import { MEDAL_LIST } from '../../constants/mockData';
import { AudioService } from '../../services/audio';
import { HapticsService } from '../../services/haptics';

interface VictorySettlementProps {
  visible: boolean;
  item: FreezerItem | null;
  expBreakdown: ExpBreakdown | null;
  newlyUnlocked: string[];
  stats: VaultStats | null;
  autoAllocatedWishTitle?: string | null;
  /** 完美克制：集齐印记 + 自然到期 + 放弃（+50 EXP） */
  isPerfect?: boolean;
  onClose: () => void;
  onGoVault: () => void;
}

/**
 * 放弃购买后的结算仪式：
 * 金币飞入动画 → EXP 明细滚动 → 奖章解锁 → 战报分享卡片
 */
export const VictorySettlement: React.FC<VictorySettlementProps> = ({
  visible,
  item,
  expBreakdown,
  newlyUnlocked,
  stats,
  autoAllocatedWishTitle,
  isPerfect = false,
  onClose,
  onGoVault,
}) => {
  const coinScale = useRef(new Animated.Value(0)).current;
  const coinY = useRef(new Animated.Value(60)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const [displayedExp, setDisplayedExp] = useState(0);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (!visible) {
      setDisplayedExp(0);
      setShowDetails(false);
      return;
    }
    // Coin fly-in
    coinScale.setValue(0);
    coinY.setValue(60);
    contentOpacity.setValue(0);
    Animated.sequence([
      Animated.parallel([
        Animated.spring(coinScale, { toValue: 1, friction: 5, useNativeDriver: true }),
        Animated.timing(coinY, {
          toValue: 0,
          duration: 500,
          easing: Easing.out(Easing.back(1.5)),
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
    ]).start(() => setShowDetails(true));
    AudioService.playFanfareSound();

    // EXP count-up
    const total = expBreakdown?.total ?? 0;
    const started = Date.now();
    const timer = setInterval(() => {
      const t = Math.min(1, (Date.now() - started) / 900);
      setDisplayedExp(Math.round(total * t));
      if (t >= 1) clearInterval(timer);
    }, 40);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!visible || !item || !expBreakdown || !stats) return null;

  const unlockedMedals = MEDAL_LIST.filter((m) => newlyUnlocked.includes(m.id));

  const handleShare = async () => {
    await Clipboard.setStringAsync(victoryShareText(item, stats.totalSaved));
    HapticsService.lightTap();
    Alert.alert('📋 已复制', '战报文案已复制到剪贴板，去分享给你的朋友吧！');
  };

  const expLines: { label: string; value: number }[] = [
    { label: '理性胜利基础', value: expBreakdown.base },
    ...(expBreakdown.markBonus > 0
      ? [{ label: `理智印记 ×${expBreakdown.markCount}`, value: expBreakdown.markBonus }]
      : []),
    ...(expBreakdown.fullCooldownBonus > 0
      ? [{ label: '完整冷静期', value: expBreakdown.fullCooldownBonus }]
      : []),
    ...(expBreakdown.glacierBonus > 0
      ? [{ label: '冰川级大额克制', value: expBreakdown.glacierBonus }]
      : []),
    ...(isPerfect ? [{ label: '🌟 完美克制加成', value: PERFECT_DEFENSE_BONUS }] : []),
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Coin fly-in */}
          <Animated.View
            style={[
              styles.coinBox,
              { transform: [{ scale: coinScale }, { translateY: coinY }] },
            ]}
          >
            <Text style={styles.coinEmoji}>🪙</Text>
            <Text style={styles.coinAmount}>+¥{item.price.toLocaleString('zh-CN')}</Text>
            <Text style={styles.coinSub}>已存入战利品金库</Text>
          </Animated.View>

          <Animated.View style={[styles.detailBox, { opacity: contentOpacity }]}>
            {/* Perfect defense banner */}
            {isPerfect && (
              <View style={styles.perfectBanner}>
                <Text style={styles.perfectBannerText}>🌟 完美克制！印记集齐 · 自然到期 · 理性放弃</Text>
              </View>
            )}
            {/* EXP breakdown */}
            <View style={styles.expCard}>
              <Text style={styles.expTitle}>⚡ 意志力经验 +{displayedExp} EXP</Text>
              {showDetails &&
                expLines.map((l) => (
                  <View key={l.label} style={styles.expRow}>
                    <Text style={styles.expLabel}>{l.label}</Text>
                    <Text style={styles.expValue}>+{l.value}</Text>
                  </View>
                ))}
              <View style={styles.expTotalRow}>
                <Text style={styles.expTotalLabel}>当前总经验</Text>
                <Text style={styles.expTotalValue}>{stats.willpowerExp} EXP · Lv.{stats.defenseLevel}</Text>
              </View>
            </View>

            {/* Auto-allocated wish notice */}
            {!!autoAllocatedWishTitle && (
              <Text style={styles.allocText}>🎯 已自动充入心愿「{autoAllocatedWishTitle}」</Text>
            )}

            {/* Medal unlocks */}
            {unlockedMedals.length > 0 && (
              <View style={styles.medalBox}>
                {unlockedMedals.map((m) => (
                  <Text key={m.id} style={styles.medalText}>
                    🏆 解锁成就「{m.name}」
                  </Text>
                ))}
              </View>
            )}

            {/* Battle report card */}
            <View style={styles.reportCard}>
              <Text style={styles.reportTitle}>🛡️ 理性战报</Text>
              <Text style={styles.reportLine} numberOfLines={2}>
                成功抵御 ¥{item.price.toLocaleString('zh-CN')} 的「{item.name}」
              </Text>
              <Text style={styles.reportLine}>累计金库：¥{stats.totalSaved.toLocaleString('zh-CN')}</Text>
              <Text style={styles.reportLine}>成功防守：{stats.itemsDefended} 次</Text>
            </View>

            {/* Actions */}
            <View style={styles.btnColumn}>
              <TouchableOpacity style={styles.shareBtn} activeOpacity={0.85} onPress={handleShare}>
                <Text style={styles.shareBtnText}>📤 复制战报分享文案</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.vaultBtn} activeOpacity={0.85} onPress={onGoVault}>
                <Text style={styles.vaultBtnText}>前往金库查看</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.closeBtn} activeOpacity={0.8} onPress={onClose}>
                <Text style={styles.closeBtnText}>继续冷冻</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(7, 12, 26, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    backgroundColor: '#0B132B',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#F59E0B',
    padding: 20,
    alignItems: 'center',
  },
  coinBox: {
    alignItems: 'center',
    marginBottom: 14,
  },
  coinEmoji: {
    fontSize: 52,
  },
  coinAmount: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FBBF24',
    marginTop: 4,
  },
  coinSub: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '700',
    marginTop: 2,
  },
  perfectBanner: {
    width: '100%',
    backgroundColor: 'rgba(251, 191, 36, 0.14)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FBBF24',
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 10,
    alignItems: 'center',
  },
  perfectBannerText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FBBF24',
  },
  detailBox: {
    width: '100%',
  },
  expCard: {
    backgroundColor: '#13233F',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1E3A5F',
    padding: 12,
    marginBottom: 10,
  },
  expTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#67E8F9',
    marginBottom: 6,
  },
  expRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  expLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  expValue: {
    fontSize: 11,
    color: '#34D399',
    fontWeight: '800',
  },
  expTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#1E3A5F',
    marginTop: 6,
    paddingTop: 6,
  },
  expTotalLabel: {
    fontSize: 11,
    color: '#E2E8F0',
    fontWeight: '700',
  },
  expTotalValue: {
    fontSize: 11,
    color: '#FBBF24',
    fontWeight: '900',
  },
  allocText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F59E0B',
    textAlign: 'center',
    marginBottom: 8,
  },
  medalBox: {
    marginBottom: 10,
    alignItems: 'center',
    gap: 4,
  },
  medalText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FDE68A',
  },
  reportCard: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 12,
    marginBottom: 12,
  },
  reportTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 6,
  },
  reportLine: {
    fontSize: 11,
    color: '#CBD5E1',
    fontWeight: '600',
    lineHeight: 17,
  },
  btnColumn: {
    gap: 8,
  },
  shareBtn: {
    backgroundColor: '#38BDF8',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  shareBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#082F49',
  },
  vaultBtn: {
    backgroundColor: '#F59E0B',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  vaultBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#451A03',
  },
  closeBtn: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
});
