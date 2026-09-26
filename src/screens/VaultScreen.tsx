import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Image,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { COLORS } from '../constants/theme';
import { ASSETS } from '../constants/assets';
import { Header } from '../components/Header';
import { MedalRow } from '../components/MedalRow';
import { AddWishModal } from '../components/Modals/AddWishModal';
import { VaultStats, WishlistItem, DefenseRecord, FreezerItem } from '../types';
import { DEFENSE_RANKS } from '../constants/mockData';
import { HapticsService } from '../services/haptics';
import { AudioService } from '../services/audio';
import { StorageService } from '../services/storage';
import { UsageFeedbackModal } from '../components/Modals/UsageFeedbackModal';
import { UsageFeedbackKey } from '../constants/decision';
import { EXP_PERKS, EXP_PERK_COST, streakProgress } from '../constants/rewards';
import { RewardsService } from '../services/rewards';

const FEEDBACK_LABELS: Record<string, string> = {
  often: '🔥 经常使用',
  sometimes: '🌤️ 偶尔使用',
  dusty: '🕸️ 吃灰了',
  sold: '💱 已转卖',
};

interface VaultScreenProps {
  stats: VaultStats;
  wishlist: WishlistItem[];
  onBack: () => void;
  onRedeemWish: (wish: WishlistItem) => void;
  onAddWish: (newWish: WishlistItem) => void;
  onDeleteWish: (id: string) => void;
  onAllocateToWish: (wishId: string, amount: number) => Promise<number>;
  onWithdrawFromWish: (wishId: string, amount: number) => Promise<void>;
  onToggleAutoAllocate: (wishId: string, autoAllocate: boolean) => Promise<void>;
  /** EXP 商店 / 反馈等操作后直接更新父级 stats 状态 */
  onStatsChanged: (stats: VaultStats) => void;
  /** EXP 兑换充入心愿后同步父级心愿单 */
  onWishlistChanged?: (wishlist: WishlistItem[]) => void;
}

export const VaultScreen: React.FC<VaultScreenProps> = ({
  stats,
  wishlist,
  onBack,
  onRedeemWish,
  onAddWish,
  onDeleteWish,
  onAllocateToWish,
  onWithdrawFromWish,
  onToggleAutoAllocate,
  onStatsChanged,
  onWishlistChanged,
}) => {
  const [activeTab, setActiveTab] = useState<'wishes' | 'history'>('wishes');
  const [records, setRecords] = useState<DefenseRecord[]>([]);
  const [journalSceneStats, setJournalSceneStats] = useState<[string, number][]>([]);
  const [addWishModalVisible, setAddWishModalVisible] = useState(false);
  const [allItems, setAllItems] = useState<FreezerItem[]>([]);
  const [feedbackItem, setFeedbackItem] = useState<FreezerItem | null>(null);
  const [monthlyExpConverted, setMonthlyExpConverted] = useState(0);

  // Load history records & impulse journal profile on mount
  useEffect(() => {
    async function loadRecords() {
      const recs = await StorageService.getDefenseRecords();
      setRecords(recs);

      // Aggregate impulse journal scenes from all items (冲动画像)
      const items = await StorageService.getItems();
      setAllItems(items);
      const sceneCount: Record<string, number> = {};
      items.forEach((it) => {
        if (it.journal?.scene) {
          sceneCount[it.journal.scene] = (sceneCount[it.journal.scene] || 0) + 1;
        }
      });
      const sorted = Object.entries(sceneCount).sort((a, b) => b[1] - a[1]);
      setJournalSceneStats(sorted);

      // EXP 兑换月度用量（心愿加速充能上限控制）
      setMonthlyExpConverted(await RewardsService.getMonthlyExpConverted());
    }
    loadRecords();
  }, [stats]);

  // Usage feedback submit: persist onto the item, award EXP
  const handleFeedbackSubmit = async (itemId: string, feedback: string, exp: number) => {
    const updatedItems = allItems.map((i) =>
      i.id === itemId ? { ...i, purchasedFeedback: feedback as FreezerItem['purchasedFeedback'] } : i
    );
    setAllItems(updatedItems);
    await StorageService.saveItems(updatedItems);
    const newStats = await StorageService.addWillpowerExp(exp, 'usage_feedback');
    onStatsChanged(newStats);
    setFeedbackItem(null);
    HapticsService.victorySuccess();
    Alert.alert('✅ 反馈已记录', `感谢你的诚实回顾！意志力 +${exp} EXP`);
  };

  // Determine current and next defense rank
  const currentRank =
    DEFENSE_RANKS.find((r) => r.level === stats.defenseLevel) || DEFENSE_RANKS[0];
  const nextRank =
    DEFENSE_RANKS.find((r) => r.level === stats.defenseLevel + 1) || null;

  // Rank progress calculation
  // 注意：段位可由「累计节省」触发，此时 EXP 可能低于当前段位门槛，
  // 必须夹紧到 0 以上，否则会产出 `width: '-150%'` 这种非法样式值。
  const currentExp = stats.willpowerExp || 0;
  const rankProgress = nextRank
    ? Math.max(
        0,
        Math.min(
          100,
          Math.round(
            ((currentExp - currentRank.minExp) / Math.max(1, nextRank.minExp - currentRank.minExp)) * 100
          )
        )
      )
    : 100;

  // 连胜里程碑进度（七日禅）：下一目标 / 还差几天
  const streakInfo = streakProgress(stats.currentStreak);
  const streakNextLabel = streakInfo.nextMilestone
    ? `冲向 ${streakInfo.nextMilestone} 天（还差 ${streakInfo.remaining} 天）`
    : '连胜里程碑已全部达成';

  // EXP 兑换心愿金的目标心愿：进度最高的未兑换且未充满心愿
  const exchangeCandidates = wishlist.filter(
    (w) => !w.redeemed && (w.allocatedAmount || 0) < w.cost
  );
  const exchangeTarget =
    exchangeCandidates.length > 0
      ? exchangeCandidates.reduce((best, w) =>
          (w.allocatedAmount || 0) / Math.max(1, w.cost) >
          (best.allocatedAmount || 0) / Math.max(1, best.cost)
            ? w
            : best
        )
      : null;

  const handleRedeemPress = (item: WishlistItem) => {
    HapticsService.lightTap();
    const allocated = item.allocatedAmount || 0;
    if (allocated >= item.cost) {
      AudioService.playFanfareSound();
      HapticsService.victorySuccess();
      Alert.alert(
        '🎉 恭喜达成梦想心愿！',
        `「${item.title}」已充能 100%！兑换将从心愿余额中扣减 ¥${item.cost.toLocaleString('zh-CN')}，并获得 +50 EXP。`,
        [
          {
            text: '立即达成兑换',
            onPress: () => onRedeemWish(item),
          },
          { text: '继续保留储蓄' },
        ]
      );
    } else {
      const needed = item.cost - allocated;
      Alert.alert(
        '🔒 心愿储蓄充能中',
        `心愿目标：¥${item.cost.toLocaleString('zh-CN')}\n已充入：¥${allocated.toLocaleString('zh-CN')}（${Math.round(
          (allocated / Math.max(1, item.cost)) * 100
        )}%）\n金库可用余额：¥${stats.availableBalance.toLocaleString('zh-CN')}\n还需充入 ¥${needed.toLocaleString('zh-CN')} 即可达成！`,
        [{ text: '继续加油！' }]
      );
    }
  };

  // ---- EXP 商店 ----
  const handlePurchasePerk = (perkId: string, title: string, cost: number) => {
    HapticsService.lightTap();
    if ((stats.willpowerExp || 0) < cost) {
      Alert.alert('EXP 不足', `购买「${title}」需要 ${cost} EXP，当前 ${stats.willpowerExp || 0} EXP。继续通过放弃购买 / 完美克制 / 连胜奖励积累吧！`);
      return;
    }
    Alert.alert('确认购买特权', `花费 ${cost} EXP 解锁「${title}」？`, [
      { text: '再想想', style: 'cancel' },
      {
        text: '解锁',
        onPress: async () => {
          const updated = await StorageService.purchasePerk(perkId);
          if (updated) {
            onStatsChanged(updated);
            HapticsService.victorySuccess();
            Alert.alert('🎉 特权已解锁', `「${title}」已生效！`);
          }
        },
      },
    ]);
  };

  const handleExpToBalance = () => {
    HapticsService.lightTap();
    const unit = EXP_PERK_COST.exp_to_balance_unit; // 100 EXP -> ¥100
    const remaining = Math.max(0, EXP_PERK_COST.exp_to_balance_monthly_cap - monthlyExpConverted);
    if (remaining < unit) {
      Alert.alert('本月额度已用完', `心愿加速充能每月上限 ${EXP_PERK_COST.exp_to_balance_monthly_cap} EXP，下个月再来吧。`);
      return;
    }
    if ((stats.willpowerExp || 0) < unit) {
      Alert.alert('EXP 不足', `每次兑换需要 ${unit} EXP，当前 ${stats.willpowerExp || 0} EXP。`);
      return;
    }
    const target = exchangeTarget;
    const targetLine = target
      ? `将充入「${target.title}」（当前 ${Math.round(
          ((target.allocatedAmount || 0) / Math.max(1, target.cost)) * 100
        )}%）`
      : '当前没有可充能的心愿，将转入金库可用余额';
    Alert.alert('心愿加速充能', `将 ${unit} EXP 按 1:1 折算为 ¥${unit} ？\n${targetLine}`, [
      { text: '取消', style: 'cancel' },
      {
        text: '兑换',
        onPress: async () => {
          const result = await StorageService.expToBalance(unit, target?.id);
          if (result) {
            onStatsChanged(result.stats);
            if (onWishlistChanged) onWishlistChanged(result.wishlist);
            setMonthlyExpConverted(await RewardsService.getMonthlyExpConverted());
            HapticsService.victorySuccess();
            const where = result.wishTitle
              ? `已充入「${result.wishTitle}」¥${result.toWish}`
              : `已充入可用余额 ¥${result.toBalance}`;
            const rest = result.wishTitle && result.toBalance > 0 ? `，剩余 ¥${result.toBalance} 进可用余额` : '';
            Alert.alert('💱 兑换成功', `${where}${rest}！`);
          }
        },
      },
    ]);
  };


  // Allocate as much available balance as possible toward the wish goal
  const handleChargePress = async (item: WishlistItem) => {
    HapticsService.mediumTap();
    const need = item.cost - (item.allocatedAmount || 0);
    const allocated = await onAllocateToWish(item.id, Math.min(need, stats.availableBalance));
    if (allocated > 0) {
      AudioService.playCoinSound();
    } else {
      Alert.alert('提示', '金库可用余额不足，先去冷冻箱抵御一次冲动吧！');
    }
  };

  const handleWithdrawPress = (item: WishlistItem) => {
    const allocated = item.allocatedAmount || 0;
    if (allocated <= 0) return;
    HapticsService.lightTap();
    Alert.alert('取出心愿资金', `将 ¥${allocated.toLocaleString('zh-CN')} 从「${item.title}」取回金库余额？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '取出',
        onPress: () => onWithdrawFromWish(item.id, allocated),
      },
    ]);
  };

  const handleDeletePress = (item: WishlistItem) => {
    HapticsService.lightTap();
    Alert.alert('删除心愿', `确定要移除心愿「${item.title}」吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => onDeleteWish(item.id),
      },
    ]);
  };

  const getWishIconEmoji = (type: WishlistItem['iconType']) => {
    switch (type) {
      case 'flight':
        return '✈️';
      case 'game':
        return '🎮';
      case 'headphone':
        return '🎧';
      case 'coffee':
        return '☕';
      case 'book':
        return '📚';
      default:
        return '🎁';
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Top Header */}
        <Header
          title="Loot Vault 金库"
          showBack
          onBackPress={onBack}
          theme="vault"
        />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero Section: Overflowing Treasure Chest & Real Defense Rank Card */}
          <View style={styles.heroSection}>
            <View style={styles.chestWrapper}>
              <Image source={ASSETS.chest} style={styles.chestImg} resizeMode="contain" />
            </View>

            {/* Defense Rank Level Card */}
            <View style={styles.rankCard}>
              <View style={styles.rankBadgeRow}>
                <View style={styles.rankLevelBadge}>
                  <Text style={styles.rankLevelText}>Lv.{currentRank.level}</Text>
                </View>
                <Text style={styles.rankNameText}>{currentRank.name}</Text>
              </View>

              <Text style={styles.rankTitleText}>{currentRank.title}</Text>
              <Text style={styles.rankDescText} numberOfLines={2}>
                {currentRank.desc}
              </Text>

              {/* Progress to next level */}
              <View style={styles.rankProgressBox}>
                <View style={styles.rankProgressHeader}>
                  <Text style={styles.rankExpLabel}>意志力经验: {currentExp} EXP</Text>
                  <Text style={styles.rankStreakLabel}>
                    🔥 连续克制 {stats.currentStreak} 天{stats.currentStreak >= 3 ? '（每日 +5 EXP）' : ''} · 🌟 完美克制 {stats.perfectDefenses} 次
                  </Text>
                  <Text style={styles.rankNextLabel}>
                    {nextRank ? `晋级需 ${nextRank.minExp} EXP + 累计省 ¥${nextRank.minSaved.toLocaleString('zh-CN')}` : '已登顶'}
                  </Text>
                </View>
                <View style={styles.rankProgressTrack}>
                  <View style={[styles.rankProgressFill, { width: `${rankProgress}%` }]} />
                </View>
              </View>

              {/* 七日禅：连胜里程碑进度 */}
              <View style={styles.streakBox}>
                <View style={styles.streakHeader}>
                  <Text style={styles.streakTitle}>
                    🔥 连胜修行 {stats.currentStreak} 天
                    {streakInfo.reached.length > 0 ? ` · 已达成 ${streakInfo.reached.join('/')} 天` : ''}
                  </Text>
                  <Text style={styles.streakNext}>{streakNextLabel}</Text>
                </View>
                <View style={styles.streakTrack}>
                  <View
                    style={[
                      styles.streakFill,
                      { width: `${streakInfo.nextMilestone === null ? 100 : streakInfo.percent}%` },
                    ]}
                  />
                </View>
              </View>
            </View>
          </View>

          {/* 3 Core Stat Cards */}
          <View style={styles.statsRow}>
            {/* DEFENSE LEVEL */}
            <View style={styles.statCard}>
              <Image source={ASSETS.btnDefenseLevel} style={styles.statCardBg} resizeMode="contain" />
              <View style={styles.statContent}>
                <Text style={styles.statValue}>Lv.{stats.defenseLevel}</Text>
                <Text style={styles.statLabel}>防御段位</Text>
              </View>
            </View>

            {/* TOTAL COINS */}
            <View style={styles.statCard}>
              <Image source={ASSETS.btnTotalCoins} style={styles.statCardBg} resizeMode="contain" />
              <View style={styles.statContent}>
                <Text style={styles.statValue}>¥{stats.totalSaved.toLocaleString('zh-CN')}</Text>
                <Text style={styles.statLabel}>已省总金币</Text>
              </View>
            </View>

            {/* ITEMS DEFENDED */}
            <View style={styles.statCard}>
              <Image source={ASSETS.btnItemsDefended} style={styles.statCardBg} resizeMode="contain" />
              <View style={styles.statContent}>
                <Text style={styles.statValue}>{stats.itemsDefended}</Text>
                <Text style={styles.statLabel}>已拦截冲动</Text>
              </View>
            </View>
          </View>

          {/* Available balance strip */}
          <View style={styles.balanceStrip}>
            <Text style={styles.balanceText}>
              💰 可用余额 ¥{stats.availableBalance.toLocaleString('zh-CN')}
            </Text>
            <Text style={styles.balanceSubText}>
              已充入心愿 ¥{stats.allocatedToWishes.toLocaleString('zh-CN')}
            </Text>
          </View>

          {/* EXP Shop */}
          <View style={styles.shopCard}>
            <View style={styles.shopHeader}>
              <Text style={styles.shopTitle}>🛒 EXP 商店</Text>
              <Text style={styles.shopBalance}>⚡ {currentExp} EXP</Text>
            </View>
            {EXP_PERKS.map((perk) => {
              const owned = stats.ownedPerks.includes(perk.id);
              const affordable = currentExp >= perk.cost;
              const isExchange = perk.id === 'exp_to_balance';
              const levelLocked = stats.defenseLevel < perk.minLevel;
              const monthRemaining = Math.max(
                0,
                EXP_PERK_COST.exp_to_balance_monthly_cap - monthlyExpConverted
              );
              return (
                <View key={perk.id} style={styles.shopRow}>
                  <Text style={styles.shopEmoji}>{perk.emoji}</Text>
                  <View style={styles.shopInfo}>
                    <Text style={styles.shopPerkTitle}>
                      {perk.title}
                      {perk.minLevel > 0 ? ` · Lv.${perk.minLevel} 解锁` : ''}
                    </Text>
                    <Text style={styles.shopPerkDesc}>
                      {perk.desc}
                      {isExchange
                        ? `（本月剩余 ${monthRemaining} EXP 额度${
                            exchangeTarget ? ` · 充入「${exchangeTarget.title}」` : ''
                          }）`
                        : ''}
                    </Text>
                  </View>
                  {perk.contextual ? (
                    <View style={[styles.shopTag, levelLocked && styles.shopTagLocked]}>
                      <Text style={[styles.shopTagText, levelLocked && styles.shopTagLockedText]}>
                        {levelLocked
                          ? `🔒 需 Lv.${perk.minLevel}`
                          : `${perk.cost} EXP · 场景中使用`}
                      </Text>
                    </View>
                  ) : owned ? (
                    <View style={[styles.shopTag, styles.shopTagOwned]}>
                      <Text style={[styles.shopTagText, styles.shopTagOwnedText]}>已拥有</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[styles.shopBuyBtn, !affordable && styles.shopBuyBtnDisabled]}
                      activeOpacity={0.8}
                      onPress={() =>
                        isExchange
                          ? handleExpToBalance()
                          : handlePurchasePerk(perk.id, perk.title, perk.cost)
                      }
                    >
                      <Text style={styles.shopBuyText}>
                        {isExchange ? '兑换' : `${perk.cost} EXP`}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>

          {/* Tab Switcher: 心愿工坊 vs 防御战报 */}
          <View style={styles.tabsRow}>
            <TouchableOpacity
              style={[styles.segmentTab, activeTab === 'wishes' && styles.segmentTabActive]}
              activeOpacity={0.8}
              onPress={() => {
                HapticsService.lightTap();
                setActiveTab('wishes');
              }}
            >
              <Text style={[styles.segmentTabText, activeTab === 'wishes' && styles.segmentTabTextActive]}>
                ✨ 心愿储蓄工坊 ({wishlist.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.segmentTab, activeTab === 'history' && styles.segmentTabActive]}
              activeOpacity={0.8}
              onPress={() => {
                HapticsService.lightTap();
                setActiveTab('history');
              }}
            >
              <Text style={[styles.segmentTabText, activeTab === 'history' && styles.segmentTabTextActive]}>
                📜 防御战报手账 ({records.length})
              </Text>
            </TouchableOpacity>
          </View>

          {/* TAB 1: 心愿储蓄工坊 */}
          {activeTab === 'wishes' && (
            <View style={styles.marketSection}>
              <View style={styles.marketHeader}>
                <View>
                  <Text style={styles.marketTitle}>DREAM WISHLIST</Text>
                  <Text style={styles.marketSubtitle}>为你真正热爱的长期心愿充能</Text>
                </View>

                {/* Add Wish Button */}
                <TouchableOpacity
                  style={styles.addWishBtn}
                  activeOpacity={0.8}
                  onPress={() => setAddWishModalVisible(true)}
                >
                  <Text style={styles.addWishBtnText}>＋ 自定义心愿</Text>
                </TouchableOpacity>
              </View>

              {/* Wishlist Grid / List */}
              <View style={styles.wishlistGrid}>
                {wishlist.map((item) => {
                  const allocated = item.allocatedAmount || 0;
                  const progress = Math.min(1, allocated / Math.max(1, item.cost));
                  const percent = Math.round(progress * 100);
                  const isReady = allocated >= item.cost;

                  return (
                    <View key={item.id} style={styles.wishCard}>
                      <TouchableOpacity
                        style={styles.deleteWishBtn}
                        onPress={() => handleDeletePress(item)}
                      >
                        <Text style={styles.deleteWishText}>✕</Text>
                      </TouchableOpacity>

                      <View style={styles.wishIconPlaceholder}>
                        <Text style={styles.wishEmoji}>{getWishIconEmoji(item.iconType)}</Text>
                      </View>
                      <Text style={styles.wishTitle} numberOfLines={2}>
                        {item.title}
                      </Text>
                      <Text style={styles.wishCost}>¥{item.cost.toLocaleString('zh-CN')}</Text>

                      {/* Progress Bar (real charged amount) */}
                      <View style={styles.progressBarBg}>
                        <View style={[styles.progressBarFill, { width: `${percent}%` }]} />
                      </View>
                      <Text style={styles.progressText}>
                        ¥{allocated.toLocaleString('zh-CN')} · {percent}% 已充能
                      </Text>

                      {/* Auto-allocate toggle */}
                      <TouchableOpacity
                        style={styles.autoAllocRow}
                        activeOpacity={0.8}
                        onPress={() => onToggleAutoAllocate(item.id, !item.autoAllocate)}
                      >
                        <View style={[styles.autoAllocDot, item.autoAllocate && styles.autoAllocDotOn]} />
                        <Text style={styles.autoAllocText}>
                          {item.autoAllocate ? '放弃后自动充入 ✓' : '放弃后自动充入'}
                        </Text>
                      </TouchableOpacity>

                      {/* Charge / Withdraw */}
                      {!item.redeemed && (
                        <View style={styles.chargeRow}>
                          <TouchableOpacity
                            style={styles.chargeBtn}
                            activeOpacity={0.8}
                            onPress={() => handleChargePress(item)}
                          >
                            <Text style={styles.chargeBtnText}>＋充入</Text>
                          </TouchableOpacity>
                          {allocated > 0 && (
                            <TouchableOpacity
                              style={styles.withdrawBtn}
                              activeOpacity={0.8}
                              onPress={() => handleWithdrawPress(item)}
                            >
                              <Text style={styles.withdrawBtnText}>取出</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}

                      {/* Action Button */}
                      <TouchableOpacity
                        style={[styles.redeemBtn, isReady && styles.redeemBtnReady]}
                        activeOpacity={0.8}
                        onPress={() => handleRedeemPress(item)}
                      >
                        <Text style={[styles.redeemBtnText, isReady && styles.redeemBtnTextReady]}>
                          {item.redeemed ? '🏆 已达成' : isReady ? '🎉 达成兑换' : '储蓄中...'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* TAB 2: 防御战报手账 */}
          {activeTab === 'history' && (
            <View style={styles.historySection}>
              {/* 冲动画像：日记场景分布 */}
              {journalSceneStats.length > 0 && (
                <View style={styles.profileCard}>
                  <Text style={styles.profileTitle}>🧠 我的冲动画像</Text>
                  <Text style={styles.profileSub}>了解冲动来源，是克制的第一步</Text>
                  {journalSceneStats.map(([scene, count]) => {
                    const maxCount = journalSceneStats[0][1];
                    const widthPct = Math.max(12, Math.round((count / maxCount) * 100));
                    return (
                      <View key={scene} style={styles.profileRow}>
                        <Text style={styles.profileScene}>{scene}</Text>
                        <View style={styles.profileBarBg}>
                          <View style={[styles.profileBarFill, { width: `${widthPct}%` }]} />
                        </View>
                        <Text style={styles.profileCount}>{count} 次</Text>
                      </View>
                    );
                  })}
                </View>
              )}

              {records.length === 0 ? (
                <View style={styles.emptyHistory}>
                  <Text style={styles.emptyHistoryEmoji}>🛡️</Text>
                  <Text style={styles.emptyHistoryTitle}>暂无历史防御战报</Text>
                  <Text style={styles.emptyHistorySub}>
                    每次冷冻期结束选择放弃或购买后，这里将生成你的消费清醒日志。
                  </Text>
                </View>
              ) : (
                records.map((rec) => {
                  const purchasedItem =
                    rec.outcome === 'purchased'
                      ? allItems.find((i) => i.id === rec.itemId)
                      : undefined;
                  const summary = rec.interventionSummary;

                  return (
                  <View key={rec.id} style={styles.recordCard}>
                    <View style={styles.recordLeft}>
                      <View
                        style={[
                          styles.recordBadge,
                          rec.outcome === 'abandoned' ? styles.badgeAbandoned : styles.badgePurchased,
                        ]}
                      >
                        <Text style={styles.recordBadgeEmoji}>
                          {rec.outcome === 'abandoned' ? '🛡️ 成功拦截' : '🛍️ 理性放行'}
                        </Text>
                      </View>
                      <Text style={styles.recordName} numberOfLines={1}>
                        {rec.itemName}
                      </Text>
                      <Text style={styles.recordTime}>
                        {new Date(rec.timestamp).toLocaleDateString()}{' '}
                        {new Date(rec.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · 冷冻{' '}
                        {rec.freezeDurationHours < 1 ? '10秒' : rec.freezeDurationHours + '小时'}
                      </Text>
                      {summary && (
                        <Text style={styles.recordSummary}>
                          干预：呼吸×{summary.breathCount} · 印记×{summary.rationalMarks}
                          {summary.journalScene ? ` · ${summary.journalScene}` : ''} · 压平{summary.flattenedPercent}%
                        </Text>
                      )}
                      {rec.outcome === 'purchased' && purchasedItem && !purchasedItem.purchasedFeedback && (
                        <TouchableOpacity
                          style={styles.feedbackBtn}
                          activeOpacity={0.8}
                          onPress={() => {
                            HapticsService.lightTap();
                            setFeedbackItem(purchasedItem);
                          }}
                        >
                          <Text style={styles.feedbackBtnText}>📦 记录使用反馈</Text>
                        </TouchableOpacity>
                      )}
                      {rec.outcome === 'purchased' && purchasedItem?.purchasedFeedback && (
                        <Text style={styles.feedbackDone}>
                          使用反馈：{FEEDBACK_LABELS[purchasedItem.purchasedFeedback]}
                        </Text>
                      )}
                    </View>

                    <View style={styles.recordRight}>
                      <Text
                        style={[
                          styles.recordPrice,
                          rec.outcome === 'abandoned' ? styles.priceGreen : styles.priceGray,
                        ]}
                      >
                        {rec.outcome === 'abandoned' ? `+¥${rec.price.toLocaleString('zh-CN')}` : `¥${rec.price.toLocaleString('zh-CN')}`}
                      </Text>
                      <Text style={styles.recordSub}>
                        {rec.outcome === 'abandoned' ? '存入金库' : '确认需要'}
                      </Text>
                      {typeof rec.expEarned === 'number' && (
                        <Text style={styles.recordExp}>+{rec.expEarned} EXP</Text>
                      )}
                    </View>
                  </View>
                  );
                }))}
            </View>
          )}

          {/* 7 Medals Row */}
          <MedalRow unlockedMedals={stats.unlockedMedals} ownedPerks={stats.ownedPerks} />
        </ScrollView>

        {/* Add Wish Modal */}
        <AddWishModal
          visible={addWishModalVisible}
          onClose={() => setAddWishModalVisible(false)}
          onAddWish={onAddWish}
        />

        {/* Usage Feedback Modal (30-day post-purchase review) */}
        <UsageFeedbackModal
          visible={feedbackItem !== null}
          item={feedbackItem}
          onSubmit={(feedback: UsageFeedbackKey, exp: number) => {
            if (feedbackItem) {
              handleFeedbackSubmit(feedbackItem.id, feedback, exp);
            }
          }}
          onClose={() => setFeedbackItem(null)}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#070C1A',
  },
  container: {
    flex: 1,
    backgroundColor: '#070C1A',
  },
  scrollContent: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  heroSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 14,
    gap: 12,
  },
  chestWrapper: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chestImg: {
    width: 140,
    height: 140,
  },
  rankCard: {
    flex: 1,
    height: 140,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#334155',
    padding: 12,
    justifyContent: 'space-between',
  },
  rankBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rankLevelBadge: {
    backgroundColor: '#38BDF8',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  rankLevelText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#0F172A',
  },
  rankNameText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#F8FAFC',
  },
  rankTitleText: {
    fontSize: 9,
    color: '#38BDF8',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  rankDescText: {
    fontSize: 9,
    color: '#94A3B8',
    lineHeight: 13,
  },
  rankProgressBox: {
    marginTop: 4,
  },
  rankProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  rankExpLabel: {
    fontSize: 8,
    color: '#FBBF24',
    fontWeight: '700',
  },
  rankNextLabel: {
    fontSize: 8,
    color: '#64748B',
    fontWeight: '600',
  },
  rankProgressTrack: {
    width: '100%',
    height: 5,
    backgroundColor: '#0F172A',
    borderRadius: 3,
    overflow: 'hidden',
  },
  rankProgressFill: {
    height: '100%',
    backgroundColor: '#38BDF8',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 8,
    marginBottom: 14,
  },
  statCard: {
    flex: 1,
    height: 60,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statCardBg: {
    width: '100%',
    height: 60,
  },
  statContent: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 4,
  },
  statValue: {
    fontSize: 13,
    fontWeight: '900',
    color: '#111827',
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 1,
  },
  tabsRow: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 3,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  segmentTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
  },
  segmentTabActive: {
    backgroundColor: '#1E293B',
  },
  segmentTabText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  segmentTabTextActive: {
    color: '#38BDF8',
    fontWeight: '800',
  },
  marketSection: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#1E293B',
    padding: 12,
    width: '100%',
    alignItems: 'center',
  },
  marketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 12,
  },
  marketTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 0.5,
  },
  marketSubtitle: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
  },
  addWishBtn: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    borderColor: '#38BDF8',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  addWishBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#38BDF8',
  },
  wishlistGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    width: '100%',
  },
  wishCard: {
    width: '31%',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
  },
  deleteWishBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  deleteWishText: {
    fontSize: 9,
    color: '#64748B',
    fontWeight: '800',
  },
  wishIconPlaceholder: {
    width: 38,
    height: 38,
    backgroundColor: '#E2E8F0',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  wishEmoji: {
    fontSize: 20,
  },
  wishTitle: {
    fontSize: 9,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    height: 24,
  },
  wishCost: {
    fontSize: 9,
    fontWeight: '800',
    color: '#0284C7',
    marginVertical: 2,
  },
  progressBarBg: {
    width: '100%',
    height: 4,
    backgroundColor: '#CBD5E1',
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 2,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#10B981',
  },
  progressText: {
    fontSize: 7,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 2,
  },
  redeemBtn: {
    width: '100%',
    height: 26,
    borderRadius: 6,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  redeemBtnReady: {
    backgroundColor: '#10B981',
  },
  redeemBtnText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
  },
  redeemBtnTextReady: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  // History Section
  historySection: {
    width: '100%',
    gap: 8,
  },
  balanceStrip: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginBottom: 12,
  },
  balanceText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FBBF24',
  },
  balanceSubText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
  },
  autoAllocRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 5,
  },
  autoAllocDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#CBD5E1',
  },
  autoAllocDotOn: {
    backgroundColor: '#10B981',
  },
  autoAllocText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#64748B',
  },
  chargeRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 5,
    width: '100%',
  },
  chargeBtn: {
    flex: 1,
    height: 22,
    borderRadius: 6,
    backgroundColor: '#BAE6FD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chargeBtnText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#0369A1',
  },
  withdrawBtn: {
    width: 40,
    height: 22,
    borderRadius: 6,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  withdrawBtnText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
  },
  recordSummary: {
    fontSize: 9,
    color: '#7DD3FC',
    marginTop: 2,
  },
  feedbackBtn: {
    alignSelf: 'flex-start',
    marginTop: 5,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#38BDF8',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  feedbackBtnText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#7DD3FC',
  },
  feedbackDone: {
    fontSize: 9,
    color: '#64748B',
    marginTop: 4,
  },
  recordExp: {
    fontSize: 8,
    fontWeight: '800',
    color: '#A78BFA',
    marginTop: 2,
  },
  profileCard: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 14,
    marginBottom: 6,
  },
  profileTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 2,
  },
  profileSub: {
    fontSize: 10,
    color: '#64748B',
    marginBottom: 12,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  profileScene: {
    width: 64,
    fontSize: 10,
    fontWeight: '700',
    color: '#E2E8F0',
  },
  profileBarBg: {
    flex: 1,
    height: 10,
    backgroundColor: '#13233F',
    borderRadius: 5,
    overflow: 'hidden',
  },
  profileBarFill: {
    height: '100%',
    backgroundColor: '#38BDF8',
    borderRadius: 5,
  },
  profileCount: {
    width: 32,
    fontSize: 10,
    fontWeight: '800',
    color: '#7DD3FC',
    textAlign: 'right',
  },
  emptyHistory: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  emptyHistoryEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyHistoryTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  emptyHistorySub: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 16,
  },
  recordCard: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recordLeft: {
    flex: 1,
    marginRight: 10,
  },
  recordBadge: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 4,
  },
  badgeAbandoned: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  badgePurchased: {
    backgroundColor: 'rgba(148, 163, 184, 0.2)',
  },
  recordBadgeEmoji: {
    fontSize: 9,
    fontWeight: '800',
    color: '#E2E8F0',
  },
  recordName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 2,
  },
  recordTime: {
    fontSize: 9,
    color: '#64748B',
  },
  recordRight: {
    alignItems: 'flex-end',
  },
  recordPrice: {
    fontSize: 14,
    fontWeight: '900',
  },
  priceGreen: {
    color: '#34D399',
  },
  priceGray: {
    color: '#94A3B8',
  },
  recordSub: {
    fontSize: 8,
    color: '#64748B',
    marginTop: 2,
  },
  rankStreakLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FBBF24',
    marginTop: 2,
  },
  shopCard: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 14,
    marginTop: 10,
  },
  shopHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  shopTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  shopBalance: {
    fontSize: 12,
    fontWeight: '900',
    color: '#A78BFA',
  },
  shopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  shopEmoji: {
    fontSize: 22,
    marginRight: 10,
  },
  shopInfo: {
    flex: 1,
    marginRight: 8,
  },
  shopPerkTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#E2E8F0',
    marginBottom: 2,
  },
  shopPerkDesc: {
    fontSize: 9,
    color: '#64748B',
    lineHeight: 13,
  },
  shopTag: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  shopTagText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94A3B8',
  },
  shopTagOwned: {
    borderColor: '#B45309',
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
  },
  shopTagOwnedText: {
    color: '#FBBF24',
  },
  shopTagLocked: {
    borderColor: '#475569',
    backgroundColor: 'rgba(71, 85, 105, 0.2)',
  },
  shopTagLockedText: {
    color: '#94A3B8',
  },
  streakBox: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(251, 191, 36, 0.25)',
  },
  streakHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  streakTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FBBF24',
  },
  streakNext: {
    fontSize: 9,
    color: '#94A3B8',
    fontWeight: '600',
  },
  streakTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(148, 163, 184, 0.25)',
    overflow: 'hidden',
  },
  streakFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F59E0B',
  },
  shopBuyBtn: {
    borderRadius: 8,
    backgroundColor: '#7C3AED',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  shopBuyBtnDisabled: {
    backgroundColor: '#334155',
  },
  shopBuyText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#F8FAFC',
  },
});
