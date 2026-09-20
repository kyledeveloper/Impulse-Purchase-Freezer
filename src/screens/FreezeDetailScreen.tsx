import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  Image,
} from 'react-native';
import { COLORS } from '../constants/theme';
import { ASSETS } from '../constants/assets';
import { Header } from '../components/Header';
import { TapShield } from '../components/TapShield';
import { DopamineChart } from '../components/DopamineChart';
import { RealityCheckModal } from '../components/Modals/RealityCheckModal';
import { FreezerItem } from '../types';
import { HapticsService } from '../services/haptics';
import { AudioService } from '../services/audio';
import { StorageService } from '../services/storage';

interface FreezeDetailScreenProps {
  item: FreezerItem;
  onBack: () => void;
  onTriggerDecision: (item: FreezerItem) => void;
  onUpdateItem: (updated: FreezerItem) => void;
}

export const FreezeDetailScreen: React.FC<FreezeDetailScreenProps> = ({
  item,
  onBack,
  onTriggerDecision,
  onUpdateItem,
}) => {
  const [tapsRemaining, setTapsRemaining] = useState(item.breakTapsRemaining);
  const [now, setNow] = useState(Date.now());
  const [realityLevel, setRealityLevel] = useState<number>(25);
  const [realityModalVisible, setRealityModalVisible] = useState(false);
  const [answeredLevels, setAnsweredLevels] = useState<number[]>(item.answeredQuizLevels || []);

  // Real-time second-by-second ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Format remaining time for the gold timer badge
  const remainingMs = Math.max(0, item.thawAt - now);
  const totalSec = Math.floor(remainingMs / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => (n < 10 ? '0' + n : n.toString());
  const formattedCountdown = `${pad(h)}:${pad(m)}:${pad(s)}`;

  // Calculate countdown progress (0% -> 100%)
  const totalDurationMs =
    item.freezeDurationHours < 1 ? 10 * 1000 : item.freezeDurationHours * 3600 * 1000;
  const elapsedMs = Math.max(0, totalDurationMs - remainingMs);
  const countdownProgressPercent = Math.min(
    100,
    Math.round((elapsedMs / totalDurationMs) * 100)
  );

  // Breaker Click Handler
  const handleBreakTap = () => {
    const nextTaps = Math.max(0, tapsRemaining - 1);
    setTapsRemaining(nextTaps);
    onUpdateItem({ ...item, breakTapsRemaining: nextTaps });

    // Checkpoints for reality questions (when 25, 50, 75, 100 taps are done)
    // 75 taps left = 25 done
    // 50 taps left = 50 done
    // 25 taps left = 75 done
    // 0 taps left = 100 done
    if (nextTaps === 75 && !answeredLevels.includes(25)) {
      setRealityLevel(25);
      setRealityModalVisible(true);
    } else if (nextTaps === 50 && !answeredLevels.includes(50)) {
      setRealityLevel(50);
      setRealityModalVisible(true);
    } else if (nextTaps === 25 && !answeredLevels.includes(75)) {
      setRealityLevel(75);
      setRealityModalVisible(true);
    } else if (nextTaps === 0) {
      HapticsService.heavyBreak();
      AudioService.playIceCrackSound();
      setRealityLevel(100);
      setRealityModalVisible(true);
    }
  };

  // Chill Boost (Deep Breathing + Cold Injection) Handler
  const handleChillBoost = async () => {
    const updatedBonus = item.calmWaitBonus + 1;
    onUpdateItem({ ...item, calmWaitBonus: updatedBonus });
    await StorageService.addWillpowerExp(15);

    const quotes = [
      '“延迟满足是高情商与财富积累的秘密。”',
      '“你的自控力正在战胜短暂的多巴胺诱惑！”',
      '“省下的每一分钱，都在为你真正的梦想充能。”',
      '“深呼吸，48小时后你可能根本不需要它。”',
      '“冲动的快感只有几分钟，账户的余额能陪你很久。”',
    ];
    const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];

    Alert.alert(
      '❄️ 注入理智冷气成功！',
      `意志力经验 +15 EXP！

${randomQuote}

当前商品冷静注冷次数：${updatedBonus} 次`,
      [{ text: '继续保持' }]
    );
  };

  // Reality Check Modal Callbacks
  const handleRealityRationalChoice = async () => {
    setRealityModalVisible(false);
    const expGain = realityLevel === 25 ? 20 : realityLevel === 50 ? 30 : realityLevel === 75 ? 40 : 50;
    await StorageService.addWillpowerExp(expGain);

    Alert.alert(
      '🛡️ 理性重归上风！',
      `你通过反思成功抵御了本轮破冰冲动！
获得意志力经验 +${expGain} EXP！

是否直接确认放弃购买，将 ¥${item.price.toLocaleString('zh-CN')} 金币存入金库？`,
      [
        {
          text: '直接放弃购买（金币入袋）',
          onPress: () => onTriggerDecision(item),
        },
        {
          text: '放回冷冻舱继续冷静',
        },
      ]
    );
  };

  const handleRealityContinueBreaker = () => {
    setRealityModalVisible(false);
    const nextAnswered = [...answeredLevels, realityLevel];
    setAnsweredLevels(nextAnswered);
    onUpdateItem({ ...item, answeredQuizLevels: nextAnswered });

    if (realityLevel === 100) {
      // Completed all 100 taps and 4 questions! Open final decision
      onTriggerDecision(item);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Top Navigation */}
        <Header
          title="Freeze Info"
          showBack
          onBackPress={onBack}
          showSettings
          onSettingsPress={() => {
            Alert.alert(
              '冷冻舱设置',
              `商品：${item.name}
录入时间：${new Date(item.frozenAt).toLocaleString()}
预计解冻：${new Date(
                item.thawAt
              ).toLocaleString()}
当前冷冻期：${item.freezeDurationHours < 1 ? '10秒(测试)' : item.freezeDurationHours + '小时'}`
            );
          }}
          theme="ice"
        />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Gold Digital Timer Badge */}
          <View style={styles.timerBadgeBox}>
            <Image source={ASSETS.timerGoldBlank} style={styles.timerBadgeBg} resizeMode="contain" />
            <Text style={styles.timerDigits}>{formattedCountdown}</Text>
          </View>

          {/* Interactive Tap Shield Scene (Pure & Realistic) */}
          <TapShield
            item={item}
            itemImage={item.image}
            rawCutoutImage={item.rawCutout}
            tapsRemaining={tapsRemaining}
            calmWaitBonus={item.calmWaitBonus}
            countdownProgressPercent={countdownProgressPercent}
            onTapBreaker={handleBreakTap}
            onChillBoost={handleChillBoost}
          />

          {/* Scientific Dopamine / Desire Decay Chart */}
          <DopamineChart
            freezeDurationHours={item.freezeDurationHours}
            frozenAt={item.frozenAt}
          />

          {/* Item Meta Information Card */}
          <View style={styles.itemMetaCard}>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>冷冻标的</Text>
              <Text style={styles.metaValue}>{item.name}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>待省金额</Text>
              <Text style={styles.priceGold}>¥{item.price.toLocaleString('zh-CN')}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>设定冷静期</Text>
              <Text style={styles.metaValue}>
                {item.freezeDurationHours < 1 ? '10 秒 (测试)' : `${item.freezeDurationHours} 小时`}
              </Text>
            </View>

            {/* Quick Test / Instant Thaw Trigger */}
            <TouchableOpacity
              style={styles.instantThawBtn}
              activeOpacity={0.8}
              onPress={() => onTriggerDecision(item)}
            >
              <Text style={styles.instantThawText}>⚡ 倒计时结束·进入最终抉择时刻</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Reality Check Modal */}
        <RealityCheckModal
          visible={realityModalVisible}
          item={item}
          level={realityLevel}
          onRationalChoice={handleRealityRationalChoice}
          onContinueBreaker={handleRealityContinueBreaker}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bgDeepIce,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.bgDeepIce,
  },
  scrollContent: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  timerBadgeBox: {
    width: 160,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginTop: 4,
    marginBottom: 6,
  },
  timerBadgeBg: {
    position: 'absolute',
    width: 160,
    height: 44,
  },
  timerDigits: {
    position: 'absolute',
    color: '#FEF08A',
    fontSize: 16,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    letterSpacing: 1,
  },
  itemMetaCard: {
    backgroundColor: '#0F1E36',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#1E3A5F',
    padding: 14,
    width: '100%',
    marginTop: 6,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  metaLabel: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  metaValue: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  priceGold: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FBBF24',
  },
  instantThawBtn: {
    marginTop: 12,
    backgroundColor: '#1E293B',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  instantThawText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '800',
  },
});
