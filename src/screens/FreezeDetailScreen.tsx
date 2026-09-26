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
import { BreathChamber } from '../components/BreathChamber';
import { SubstitutionCards } from '../components/SubstitutionCards';
import { RealityCheckModal } from '../components/Modals/RealityCheckModal';
import { ImpulseJournalModal } from '../components/Modals/ImpulseJournalModal';
import { FreezerItem, WishlistItem, InterventionRecord } from '../types';
import { HapticsService } from '../services/haptics';
import { AudioService } from '../services/audio';
import { StorageService } from '../services/storage';
import {
  getImpulseTier,
  resetDailyCounters,
  BREATH_CONFIG,
} from '../constants/intervention';
import { EXP_PERK_COST, perkMinLevel } from '../constants/rewards';

interface FreezeDetailScreenProps {
  item: FreezerItem;
  onBack: () => void;
  onTriggerDecision: (item: FreezerItem) => void;
  onUpdateItem: (updated: FreezerItem) => void;
  onAddWish?: (wish: WishlistItem) => void;
  /** 当前 EXP（提前解冻特权按钮的余额展示） */
  willpowerExp?: number;
  /** 当前段位（提前解冻特权 Lv.5 门槛展示） */
  defenseLevel?: number;
  /** 情景特权：提前解冻（未到期时扣 200 EXP 直接进入抉择） */
  onEarlyThaw?: (item: FreezerItem) => void;
}

export const FreezeDetailScreen: React.FC<FreezeDetailScreenProps> = ({
  item,
  onBack,
  onTriggerDecision,
  onUpdateItem,
  onAddWish,
  willpowerExp = 0,
  defenseLevel = 1,
  onEarlyThaw,
}) => {
  // Tier config (migrate-on-read: fall back to price-derived tier)
  const tierCfg = getImpulseTier(item.price);
  const maxTaps = tierCfg.maxTaps;

  // Cross-day reset of daily counters before reading them
  const resetItem = resetDailyCounters(item);
  const tapsToday = resetItem.tapsToday ?? 0;
  const chillToday = resetItem.chillToday ?? 0;

  const [tapsRemaining, setTapsRemaining] = useState(
    Math.min(resetItem.breakTapsRemaining, maxTaps)
  );
  const [now, setNow] = useState(Date.now());
  const [realityLevel, setRealityLevel] = useState<number>(25);
  const [realityModalVisible, setRealityModalVisible] = useState(false);
  const [answeredLevels, setAnsweredLevels] = useState<number[]>(
    resetItem.answeredQuizLevels || []
  );
  const [rationalMarks, setRationalMarks] = useState<number[]>(
    resetItem.rationalMarks || []
  );
  const [breathVisible, setBreathVisible] = useState(false);
  const [journalVisible, setJournalVisible] = useState(false);
  const [bannerMsg, setBannerMsg] = useState<string | null>(null);

  // Persist the migrated / daily-reset item once on mount if it changed
  useEffect(() => {
    if (
      resetItem.lastResetDate !== item.lastResetDate ||
      resetItem.tapsToday !== item.tapsToday ||
      resetItem.chillToday !== item.chillToday
    ) {
      onUpdateItem(resetItem);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Real-time second-by-second ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Inline banner (replaces system Alert for intervention feedback)
  const showBanner = (msg: string) => {
    setBannerMsg(msg);
    setTimeout(() => setBannerMsg(null), 3200);
  };

  const appendLog = (base: FreezerItem, rec: InterventionRecord): InterventionRecord[] => {
    return [...(base.interventionLog || []), rec];
  };

  // Effective intervention count driving the dopamine curve suppression
  const interventionCount =
    (resetItem.interventionLog || []).filter(
      (r) => r.type === 'breath' || r.type === 'quiz_pass' || r.type === 'journal'
    ).length;

  // Format remaining time for the gold timer badge
  const remainingMs = Math.max(0, item.thawAt - now);
  const totalSec = Math.floor(remainingMs / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => (n < 10 ? '0' + n : n.toString());
  const formattedCountdown = `${pad(h)}:${pad(m)}:${pad(s)}`;
  const isMatured = remainingMs <= 0;
  // 提前解冻特权：每件商品限 1 次（已付过费的商品可随时免再次扣费进入抉择）；Lv.5 解锁
  const earlyThawed = !!item.earlyThawedAt;
  const earlyThawLevel = perkMinLevel('early_thaw');
  const earlyThawLocked = defenseLevel < earlyThawLevel;
  const canAffordEarlyThaw = !earlyThawLocked && (willpowerExp || 0) >= EXP_PERK_COST.early_thaw;

  // Calculate countdown progress (0% -> 100%)
  const totalDurationMs =
    item.freezeDurationHours < 1 ? 10 * 1000 : item.freezeDurationHours * 3600 * 1000;
  const elapsedMs = Math.max(0, totalDurationMs - remainingMs);
  const countdownProgressPercent = Math.min(
    100,
    Math.round((elapsedMs / totalDurationMs) * 100)
  );

  // Daily tap fatigue: beyond dailyTapLimit taps still work but the UI discourages;
  // beyond 2x dailyTapLimit, tapping is exhausted for the day.
  const tapFatigued = tapsToday >= tierCfg.dailyTapLimit;
  const dailyTapExhausted = tapsToday >= tierCfg.dailyTapLimit * 2;

  // Breaker Click Handler
  const handleBreakTap = () => {
    if (dailyTapExhausted) return;

    const nextTaps = Math.max(0, tapsRemaining - 1);
    setTapsRemaining(nextTaps);
    const nextTapsToday = tapsToday + 1;
    onUpdateItem({
      ...resetItem,
      breakTapsRemaining: nextTaps,
      tapsToday: nextTapsToday,
    });

    // Reality-check checkpoints based on fraction of taps completed
    // (75% left = 25% done, etc.) mapped onto tier quiz levels
    const doneFraction = (maxTaps - nextTaps) / Math.max(1, maxTaps);
    const checkpoint =
      doneFraction >= 1
        ? 100
        : doneFraction >= 0.75
        ? 75
        : doneFraction >= 0.5
        ? 50
        : doneFraction >= 0.25
        ? 25
        : null;

    const isNewCheckpoint =
      checkpoint !== null &&
      tierCfg.quizLevels.includes(checkpoint) &&
      !answeredLevels.includes(checkpoint) &&
      // only trigger exactly when crossing the boundary
      Math.abs(doneFraction - checkpoint / 100) < 1 / Math.max(1, maxTaps);

    if (checkpoint === 100 && nextTaps === 0) {
      HapticsService.heavyBreak();
      AudioService.playIceCrackSound();
      setRealityLevel(100);
      setRealityModalVisible(true);
    } else if (isNewCheckpoint && checkpoint !== null) {
      setRealityLevel(checkpoint);
      setRealityModalVisible(true);
    }
  };

  // Breath Chamber callbacks
  const handleBreathComplete = async () => {
    setBreathVisible(false);
    const nextChillToday = chillToday + 1;
    const updated: FreezerItem = {
      ...resetItem,
      calmWaitBonus: resetItem.calmWaitBonus + 1,
      chillToday: nextChillToday,
      interventionLog: appendLog(resetItem, { type: 'breath', timestamp: Date.now() }),
    };
    // 先写 EXP 再回写商品：onUpdateItem 会顺带刷新父级 stats，
    // 顺序反过来会让 +10 EXP 在本次刷新中丢失（显示值比真实值少 10）。
    await StorageService.addWillpowerExp(BREATH_CONFIG.expReward, 'breath');
    onUpdateItem(updated);
    showBanner(`❄️ 完成 ${BREATH_CONFIG.roundsRequired} 轮深呼吸 · 意志力 +${BREATH_CONFIG.expReward} EXP`);
  };

  const handleBreathAbort = () => {
    setBreathVisible(false);
    showBanner('没关系，哪怕一次深呼吸也有用');
  };

  // Reality Check Modal Callbacks — rational choice now grants a MARK, not direct EXP
  const handleRealityRationalChoice = async (futureSelfNote?: string) => {
    setRealityModalVisible(false);
    const nextMarks = rationalMarks.includes(realityLevel)
      ? rationalMarks
      : [...rationalMarks, realityLevel];
    setRationalMarks(nextMarks);

    const nextAnswered = answeredLevels.includes(realityLevel)
      ? answeredLevels
      : [...answeredLevels, realityLevel];
    setAnsweredLevels(nextAnswered);

    const updated: FreezerItem = {
      ...resetItem,
      breakTapsRemaining: tapsRemaining,
      rationalMarks: nextMarks,
      answeredQuizLevels: nextAnswered,
      futureSelfNote: futureSelfNote ?? resetItem.futureSelfNote,
      interventionLog: appendLog(resetItem, {
        type: 'quiz_pass',
        timestamp: Date.now(),
        detail: `level_${realityLevel}`,
      }),
    };
    onUpdateItem(updated);

    if (realityLevel === 100) {
      // Final checkpoint passed rationally -> go straight to decision
      onTriggerDecision(updated);
      return;
    }

    showBanner(`🛡️ 获得「理智印记」(${nextMarks.length}/${tierCfg.quizLevels.length}) · 解冻时每个印记兑换 +15 EXP`);
  };

  const handleRealityContinueBreaker = () => {
    setRealityModalVisible(false);
    const nextAnswered = [...answeredLevels, realityLevel];
    setAnsweredLevels(nextAnswered);
    onUpdateItem({
      ...resetItem,
      breakTapsRemaining: tapsRemaining,
      answeredQuizLevels: nextAnswered,
      quizInsisted: (resetItem.quizInsisted || 0) + 1,
    });

    if (realityLevel === 100) {
      // Completed all taps and chose to insist -> open final decision
      onTriggerDecision({ ...resetItem, breakTapsRemaining: 0, answeredQuizLevels: nextAnswered });
    }
  };

  // Impulse Journal callback
  const handleJournalSubmit = async (scene: string, mood: string, note: string) => {
    setJournalVisible(false);
    const updated: FreezerItem = {
      ...resetItem,
      breakTapsRemaining: tapsRemaining,
      journal: { scene, mood, note: note || undefined, createdAt: Date.now() },
      interventionLog: appendLog(resetItem, {
        type: 'journal',
        timestamp: Date.now(),
        detail: `${scene}/${mood}`,
      }),
    };
    // 同 handleBreathComplete：先写 EXP 再回写商品，避免父级 stats 刷新丢失 +5
    await StorageService.addWillpowerExp(5, 'journal');
    onUpdateItem(updated);
    showBanner('📝 冲动日记已保存 · 意志力 +5 EXP');
  };

  const handleAddWishFromSubstitution = (wish: WishlistItem) => {
    if (onAddWish) {
      onAddWish(wish);
      showBanner(`🎯 已将「${wish.title}」加入心愿单`);
    }
  };

  // Only count marks belonging to this tier's quiz levels (level 100 is the
  // final decision gate, not a collectible mark for tiers that exclude it)
  const earnedMarkCount = rationalMarks.filter((m) =>
    tierCfg.quizLevels.includes(m)
  ).length;
  const marksProgressText = `${earnedMarkCount}/${tierCfg.quizLevels.length}`;

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
              `商品：${item.name}\n档位：${tierCfg.emoji} ${tierCfg.label}\n录入时间：${new Date(
                item.frozenAt
              ).toLocaleString()}\n预计解冻：${new Date(
                item.thawAt
              ).toLocaleString()}\n当前冷冻期：${
                item.freezeDurationHours < 1 ? '10秒(测试)' : item.freezeDurationHours + '小时'
              }`
            );
          }}
          theme="ice"
        />

        {/* Inline feedback banner (replaces system Alert) */}
        {bannerMsg && (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>{bannerMsg}</Text>
          </View>
        )}

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Gold Digital Timer Badge */}
          <View style={styles.timerBadgeBox}>
            <Image source={ASSETS.timerGoldBlank} style={styles.timerBadgeBg} resizeMode="contain" />
            <Text style={styles.timerDigits}>{formattedCountdown}</Text>
          </View>

          {/* Tier badge */}
          <View style={styles.tierBadge}>
            <Text style={styles.tierBadgeText}>
              {tierCfg.emoji} {tierCfg.label} · 理智印记 {marksProgressText}
            </Text>
          </View>

          {/* Interactive Tap Shield Scene */}
          <TapShield
            item={item}
            itemImage={item.image}
            rawCutoutImage={item.rawCutout}
            tapsRemaining={tapsRemaining}
            calmWaitBonus={resetItem.calmWaitBonus}
            countdownProgressPercent={countdownProgressPercent}
            maxTaps={maxTaps}
            chillToday={chillToday}
            dailyBreathLimit={tierCfg.dailyBreathLimit}
            tapFatigued={tapFatigued}
            dailyTapExhausted={dailyTapExhausted}
            onTapBreaker={handleBreakTap}
            onOpenBreathChamber={() => setBreathVisible(true)}
          />

          {/* Scientific Dopamine / Desire Decay Chart (dynamic, intervention-aware) */}
          <DopamineChart
            freezeDurationHours={item.freezeDurationHours}
            frozenAt={item.frozenAt}
            itemPrice={item.price}
            interventionCount={interventionCount}
          />

          {/* Substitution / opportunity-cost cards with one-tap add-to-wishlist */}
          <SubstitutionCards item={item} onAddWish={handleAddWishFromSubstitution} />

          {/* Rational marks progress */}
          <View style={styles.marksCard}>
            <Text style={styles.marksTitle}>🛡️ 理智印记收集</Text>
            <View style={styles.marksRow}>
              {tierCfg.quizLevels.map((lv) => {
                const earned = rationalMarks.includes(lv);
                return (
                  <View key={lv} style={[styles.markCell, earned && styles.markCellEarned]}>
                    <Text style={[styles.markCellText, earned && styles.markCellTextEarned]}>
                      {earned ? '🛡️' : '○'} {lv}%
                    </Text>
                  </View>
                );
              })}
            </View>
            <Text style={styles.marksHint}>
              破冰阈值拷问中选择理性反思可获得印记，解冻时每个印记兑换 +15 EXP
            </Text>
          </View>

          {/* Impulse Journal entry */}
          <TouchableOpacity
            style={styles.journalBtn}
            activeOpacity={0.8}
            onPress={() => setJournalVisible(true)}
            disabled={!!resetItem.journal}
          >
            <Text style={styles.journalBtnText}>
              {resetItem.journal
                ? `📝 已记录冲动来源：${resetItem.journal.scene} · ${resetItem.journal.mood}`
                : '📝 记录这次冲动的来源（+5 EXP）'}
            </Text>
          </TouchableOpacity>

          {/* Future-self note preview (if left at final checkpoint) */}
          {!!resetItem.futureSelfNote && (
            <View style={styles.futureSelfCard}>
              <Text style={styles.futureSelfLabel}>💌 给 3 个月后的自己：</Text>
              <Text style={styles.futureSelfText}>{resetItem.futureSelfNote}</Text>
            </View>
          )}

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

            {/* Quick Test / Instant Thaw Trigger（未到期时转为提前解冻特权，每件商品限 1 次） */}
            <TouchableOpacity
              style={[
                styles.instantThawBtn,
                !isMatured && styles.earlyThawBtn,
                !isMatured && !earlyThawed && !canAffordEarlyThaw && styles.earlyThawDisabled,
              ]}
              activeOpacity={0.8}
              onPress={() => {
                if (isMatured || earlyThawed) {
                  onTriggerDecision(item);
                } else if (onEarlyThaw) {
                  onEarlyThaw(item);
                }
              }}
            >
              <Text style={styles.instantThawText}>
                {isMatured
                  ? '⚡ 倒计时结束·进入最终抉择时刻'
                  : earlyThawed
                  ? '⚡ 已提前解冻 · 进入最终抉择（不再扣 EXP）'
                  : earlyThawLocked
                  ? `⚡ 提前解冻特权（需 Lv.${earlyThawLevel} 解锁 · 当前 Lv.${defenseLevel}）`
                  : canAffordEarlyThaw
                  ? `⚡ 提前解冻特权（${EXP_PERK_COST.early_thaw} EXP · 当前 ${willpowerExp}）`
                  : `⚡ 提前解冻特权（需 ${EXP_PERK_COST.early_thaw} EXP · 当前 ${willpowerExp}，不足）`}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Breath Chamber (4-7-8 guided breathing) */}
        <BreathChamber
          visible={breathVisible}
          onComplete={handleBreathComplete}
          onAbort={handleBreathAbort}
        />

        {/* Reality Check Modal */}
        <RealityCheckModal
          visible={realityModalVisible}
          item={item}
          level={realityLevel}
          showFutureSelfInput={tierCfg.hasFutureSelf && realityLevel === 100}
          onRationalChoice={handleRealityRationalChoice}
          onContinueBreaker={handleRealityContinueBreaker}
        />

        {/* Impulse Journal Modal */}
        <ImpulseJournalModal
          visible={journalVisible}
          itemName={item.name}
          onSubmit={handleJournalSubmit}
          onClose={() => setJournalVisible(false)}
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
  banner: {
    marginHorizontal: 16,
    marginTop: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.16)',
    borderWidth: 1,
    borderColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  bannerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6EE7B7',
    textAlign: 'center',
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
  tierBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.4)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginBottom: 6,
  },
  tierBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#7DD3FC',
    letterSpacing: 0.4,
  },
  marksCard: {
    width: '100%',
    backgroundColor: '#0F1E36',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#1E3A5F',
    padding: 12,
    marginBottom: 10,
  },
  marksTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 8,
  },
  marksRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  markCell: {
    flex: 1,
    backgroundColor: '#13233F',
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E3A5F',
  },
  markCellEarned: {
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
  },
  markCellText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
  },
  markCellTextEarned: {
    color: '#34D399',
  },
  marksHint: {
    fontSize: 10,
    color: '#64748B',
    lineHeight: 14,
  },
  journalBtn: {
    width: '100%',
    backgroundColor: '#0F1E36',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#1E3A5F',
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  journalBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#E2E8F0',
  },
  futureSelfCard: {
    width: '100%',
    backgroundColor: 'rgba(103, 232, 249, 0.08)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(103, 232, 249, 0.35)',
    padding: 12,
    marginBottom: 10,
  },
  futureSelfLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#67E8F9',
    marginBottom: 4,
  },
  futureSelfText: {
    fontSize: 13,
    color: '#E0F2FE',
    lineHeight: 19,
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
  earlyThawBtn: {
    borderColor: '#A78BFA',
    backgroundColor: 'rgba(167, 139, 250, 0.12)',
  },
  earlyThawDisabled: {
    opacity: 0.5,
  },
});
