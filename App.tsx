import React, { useEffect, useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  StatusBar,
  Platform,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native';
import { FreezerItem, VaultStats, WishlistItem } from './src/types';
import { StorageService } from './src/services/storage';
import { AudioService } from './src/services/audio';
import { NotificationService } from './src/services/notifications';
import { FreezerScreen } from './src/screens/FreezerScreen';
import { FreezeDetailScreen } from './src/screens/FreezeDetailScreen';
import { VaultScreen } from './src/screens/VaultScreen';
import { FreezeModal } from './src/components/Modals/FreezeModal';
import { ThawDecisionModal } from './src/components/Modals/ThawDecisionModal';
import { PurchaseConfirmSteps } from './src/components/Modals/PurchaseConfirmSteps';
import { VictorySettlement } from './src/components/Modals/VictorySettlement';
import { ConfettiEffect } from './src/components/ConfettiEffect';
import {
  canRefreeze,
  refreezeLeft,
  REFREEZE,
  ExpBreakdown,
} from './src/constants/decision';
import { RewardsService } from './src/services/rewards';
import { MEDAL_LIST } from './src/constants/mockData';
import { EXP_PERK_COST, perkMinLevel } from './src/constants/rewards';

export default function App() {
  const [items, setItems] = useState<FreezerItem[]>([]);
  const [vaultStats, setVaultStats] = useState<VaultStats>({
    totalSaved: 0,
    availableBalance: 0,
    allocatedToWishes: 0,
    itemsDefended: 0,
    defenseLevel: 1,
    willpowerExp: 0,
    unlockedMedals: [],
    monthlyPurchasedCount: 0,
    monthlyPurchasedAmount: 0,
    purchaseMonth: '',
    currentStreak: 0,
    perfectDefenses: 0,
    ownedPerks: [],
    lastDailyRewardDate: '',
  });
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);

  // Navigation: 'freezer' | 'detail' | 'vault'
  const [screen, setScreen] = useState<'freezer' | 'detail' | 'vault'>('freezer');
  const [selectedItem, setSelectedItem] = useState<FreezerItem | null>(null);

  // Modals & Effects
  const [freezeModalVisible, setFreezeModalVisible] = useState(false);
  const [thawModalVisible, setThawModalVisible] = useState(false);
  const [itemForDecision, setItemForDecision] = useState<FreezerItem | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  // Decision module state
  const [purchaseConfirmVisible, setPurchaseConfirmVisible] = useState(false);
  const [itemForPurchase, setItemForPurchase] = useState<FreezerItem | null>(null);
  const [victoryVisible, setVictoryVisible] = useState(false);
  const [victoryData, setVictoryData] = useState<{
    item: FreezerItem;
    expBreakdown: ExpBreakdown;
    newlyUnlocked: string[];
    stats: VaultStats;
    autoAllocatedWishTitle: string | null;
    isPerfect: boolean;
  } | null>(null);

  // Desktop simulator frame toggle
  const [usePhoneFrame, setUsePhoneFrame] = useState(Platform.OS === 'web');

  // Load storage data on start
  useEffect(() => {
    AudioService.init();

    async function loadData() {
      const storedItems = await StorageService.getItems();
      const storedStats = await StorageService.getVaultStats();
      const storedWishlist = await StorageService.getWishlist();

      setItems(storedItems);
      setVaultStats(storedStats);
      setWishlist(storedWishlist);

      // 每日连胜奖励：连胜 >= 3 天时，今日首次打开 +5 EXP
      const storedRecords = await StorageService.getDefenseRecords();
      const claimed = await RewardsService.claimDailyStreakReward(
        storedStats,
        storedRecords,
        (s) => StorageService.saveVaultStats(s)
      );
      if (claimed) {
        setVaultStats(claimed.stats);
        if (claimed.expGained > 0) {
          Alert.alert(
            '🔥 连胜奖励',
            `连续 ${claimed.streak} 天无冲动购买！意志力 +${claimed.expGained} EXP`
          );
        }
        if (claimed.newlyUnlocked.length > 0) {
          const names = claimed.newlyUnlocked
            .map((id) => MEDAL_LIST.find((m) => m.id === id)?.name)
            .filter(Boolean)
            .join('、');
          if (names) Alert.alert('🏅 新奖章解锁', names);
        }
      }
    }

    loadData();
  }, []);

  // Tick timer every second to check thaw conditions
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      // Check if any freezing item just matured and hasn't shown decision
      items.forEach((it) => {
        if (it.status === 'freezing' && it.thawAt <= now) {
          // If not currently showing a decision modal, trigger it
          if (!thawModalVisible && !itemForDecision) {
            setItemForDecision(it);
            setThawModalVisible(true);
          }
        }
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [items, thawModalVisible, itemForDecision]);

  // Handler: Add new item to freezer
  const handleAddNewItem = async (newItem: FreezerItem) => {
    const updated = [newItem, ...items];
    setItems(updated);
    await StorageService.saveItems(updated);
    Alert.alert('❄️ 成功放入冷冻箱', `「${newItem.name}」已开始冷静倒计时！`);
  };

  // Handler: Update an existing item (e.g. tap count)
  const handleUpdateItem = async (updated: FreezerItem) => {
    const nextList = items.map((i) => (i.id === updated.id ? updated : i));
    setItems(nextList);
    setSelectedItem(updated);
    await StorageService.saveItems(nextList);
  };

  // Handler: Choose to abandon purchase (Rational victory!)
  const handleAbandonPurchase = async (item: FreezerItem) => {
    setThawModalVisible(false);
    setItemForDecision(null);
    NotificationService.cancelItemNotifications(item.notificationIds);

    // 1. Update item status
    const updatedList = items.map((i) =>
      i.id === item.id ? { ...i, status: 'thawed_abandoned' as const } : i
    );
    setItems(updatedList);
    await StorageService.saveItems(updatedList);

    // 2. Record with dynamic EXP + auto-allocation into wishes
    const { stats: updatedStats, newlyUnlocked, expBreakdown, wishlist: updatedWishlist, autoAllocatedWishId, isPerfect } =
      await StorageService.recordAbandonedPurchase(item);
    setVaultStats(updatedStats);
    setWishlist(updatedWishlist);

    // 3. Trigger victory confetti + settlement ceremony
    setShowConfetti(true);
    const allocWish = autoAllocatedWishId
      ? updatedWishlist.find((w) => w.id === autoAllocatedWishId)
      : null;
    setVictoryData({
      item,
      expBreakdown,
      newlyUnlocked,
      stats: updatedStats,
      autoAllocatedWishTitle: allocWish?.title ?? null,
      isPerfect,
    });
    setVictoryVisible(true);

    // 4. Return to freezer
    if (screen === 'detail') {
      setScreen('freezer');
      setSelectedItem(null);
    }
  };

  // Handler: "仍然想买" pressed in decision modal -> open 3-step confirmation
  const handleBuyPurchase = (item: FreezerItem) => {
    setThawModalVisible(false);
    setItemForPurchase(item);
    setPurchaseConfirmVisible(true);
  };

  // Handler: purchase confirmed after 3-step ritual
  const handlePurchaseConfirmed = async (item: FreezerItem) => {
    setPurchaseConfirmVisible(false);
    setItemForDecision(null);
    NotificationService.cancelItemNotifications(item.notificationIds);

    const updatedList = items.map((i) =>
      i.id === item.id ? { ...i, status: 'thawed_purchased' as const } : i
    );
    setItems(updatedList);
    await StorageService.saveItems(updatedList);

    // Log purchase (EXP with impulse-residue penalty + monthly stats)
    const { stats: updatedStats, expEarned } = await StorageService.recordConfirmedPurchase(item);
    setVaultStats(updatedStats);

    // Schedule 30-day usage feedback reminder
    const feedbackReminderId = await NotificationService.scheduleUsageFeedbackReminder(
      item.id,
      item.name
    );
    if (feedbackReminderId) {
      const withReminder = updatedList.map((i) =>
        i.id === item.id ? { ...i, status: 'thawed_purchased' as const, feedbackReminderId } : i
      );
      setItems(withReminder);
      await StorageService.saveItems(withReminder);
    }

    if (screen === 'detail') {
      setScreen('freezer');
      setSelectedItem(null);
    }

    // Open the original purchase link
    if (item.originalUrl) {
      Linking.openURL(item.originalUrl).catch(() => {
        Alert.alert('提示', '无法打开原始链接');
      });
    }

    Alert.alert(
      '✅ 理性消费确认',
      `经过完整的冷静期，你确认了对「${item.name}」的真正需要！意志力 +${expEarned} EXP。30 天后欢迎回来记录使用体验。`
    );
  };

  // Handler: refreeze the item for another 24h (max REFREEZE.maxCount times)
  // 执行再冻（不校验次数上限；次数校验在入口处完成）
  const applyRefreeze = async (item: FreezerItem) => {
    setThawModalVisible(false);
    setItemForDecision(null);

    // Cancel old nudges, extend thaw window, schedule fresh thaw notice
    await NotificationService.cancelItemNotifications(item.notificationIds);
    const newThawAt = Date.now() + REFREEZE.extendHours * 3600 * 1000;
    const thawNoticeId = await NotificationService.scheduleThawNotification(item.name, newThawAt);

    const updated: FreezerItem = {
      ...item,
      thawAt: newThawAt,
      refreezeCount: (item.refreezeCount || 0) + 1,
      notificationIds: thawNoticeId ? [thawNoticeId] : [],
    };
    const updatedList = items.map((i) => (i.id === item.id ? updated : i));
    setItems(updatedList);
    await StorageService.saveItems(updatedList);

    if (screen === 'detail') {
      setSelectedItem(updated);
    }

    Alert.alert(
      '🧊 已重新冷冻',
      `「${item.name}」将再冷静 ${REFREEZE.extendHours} 小时。剩余再冻次数：${refreezeLeft(updated)} 次。`
    );
  };

  const handleRefreeze = async (item: FreezerItem) => {
    if (!canRefreeze(item)) return;
    await applyRefreeze(item);
  };

  // 情景特权：提前解冻（200 EXP + Lv.5，跳过剩余倒计时直接抉择；每件商品限 1 次）
  const handleEarlyThaw = (item: FreezerItem) => {
    // 已付费过：直接进入抉择，不再扣 EXP（避免重复扣费的死循环）
    if (item.earlyThawedAt) {
      setItemForDecision(item);
      setThawModalVisible(true);
      return;
    }
    const earlyThawLevel = perkMinLevel('early_thaw');
    Alert.alert(
      '⚡ 提前解冻特权',
      `花费 ${EXP_PERK_COST.early_thaw} EXP 立即进入最终抉择？\n（需 Lv.${earlyThawLevel} 解锁；未自然到期将不计入「完美克制」；每件商品限用 1 次）`,
      [
        { text: '再等等', style: 'cancel' },
        {
          text: '立即解冻',
          onPress: async () => {
            const result = await StorageService.spendExpForContextualPerk('early_thaw');
            if (!result.ok) {
              if (result.reason === 'level') {
                Alert.alert(
                  '🔒 段位不足',
                  `提前解冻特权需要 Lv.${result.requiredLevel}（当前 Lv.${result.currentLevel}）。继续冷冻商品提升段位吧！`
                );
              } else {
                Alert.alert('EXP 不足', `提前解冻需要 ${result.cost} EXP。`);
              }
              return;
            }
            setVaultStats(result.stats);
            // 打上「已提前解冻」标记并落盘，保证不会重复扣费
            const marked: FreezerItem = { ...item, earlyThawedAt: Date.now() };
            const nextList = items.map((i) => (i.id === item.id ? marked : i));
            setItems(nextList);
            await StorageService.saveItems(nextList);
            setSelectedItem(marked);
            setItemForDecision(marked);
            setThawModalVisible(true);
          },
        },
      ]
    );
  };

  // 情景特权：再冻一次 +（100 EXP + Lv.7，突破常规再冻次数上限）
  const handleExtraRefreeze = (item: FreezerItem) => {
    const extraRefreezeLevel = perkMinLevel('extra_refreeze');
    Alert.alert(
      '🧊 再冻一次 +',
      `常规再冻次数已用完。花费 ${EXP_PERK_COST.extra_refreeze} EXP 额外再冻 ${REFREEZE.extendHours} 小时？\n（需 Lv.${extraRefreezeLevel} 解锁）`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '使用特权',
          onPress: async () => {
            const result = await StorageService.spendExpForContextualPerk('extra_refreeze');
            if (!result.ok) {
              if (result.reason === 'level') {
                Alert.alert(
                  '🔒 段位不足',
                  `再冻一次 + 需要 Lv.${result.requiredLevel}（当前 Lv.${result.currentLevel}）。`
                );
              } else {
                Alert.alert('EXP 不足', `再冻一次 + 需要 ${result.cost} EXP。`);
              }
              return;
            }
            setVaultStats(result.stats);
            await applyRefreeze(item);
          },
        },
      ]
    );
  };

  // Handler: Add a custom wish to market
  const handleAddWish = async (newWish: WishlistItem) => {
    const updated = await StorageService.addWishlistItem(newWish);
    setWishlist(updated);
  };

  // Handler: Delete a wish
  const handleDeleteWish = async (id: string) => {
    const updated = await StorageService.deleteWishlistItem(id);
    setWishlist(updated);
  };

  // Handler: Redeem a fully-charged wish (deducts allocated funds, +50 EXP)
  const handleRedeemWish = async (wish: WishlistItem) => {
    const result = await StorageService.redeemWish(wish.id);
    if (!result) {
      Alert.alert('🔒 心愿尚未充满', '心愿充能满 100% 后才能兑换哦，继续加油！');
      return;
    }
    setWishlist(result.wishlist);
    setVaultStats(result.stats);
    AudioService.playFanfareSound();
    if (result.newlyUnlocked.length > 0) {
      const names = result.newlyUnlocked
        .map((id) => MEDAL_LIST.find((m) => m.id === id)?.name)
        .filter(Boolean)
        .join('、');
      if (names) Alert.alert('🏅 新奖章解锁', names);
    }
  };

  // Handler: allocate available balance into a wish
  const handleAllocateToWish = async (wishId: string, amount: number) => {
    const { stats, wishlist: updated, allocated } = await StorageService.allocateToWish(wishId, amount);
    setVaultStats(stats);
    setWishlist(updated);
    return allocated;
  };

  // Handler: withdraw allocated funds back to available balance
  const handleWithdrawFromWish = async (wishId: string, amount: number) => {
    const { stats, wishlist: updated } = await StorageService.withdrawFromWish(wishId, amount);
    setVaultStats(stats);
    setWishlist(updated);
  };

  // Handler: toggle wish auto-allocate
  const handleToggleAutoAllocate = async (wishId: string, autoAllocate: boolean) => {
    const updated = await StorageService.setWishAutoAllocate(wishId, autoAllocate);
    setWishlist(updated);
  };

  // Render Screen Content
  const renderScreen = () => {
    switch (screen) {
      case 'freezer':
        return (
          <FreezerScreen
            items={items}
            totalSaved={vaultStats.totalSaved}
            onOpenFreezeModal={() => setFreezeModalVisible(true)}
            onSelectItem={(item) => {
              setSelectedItem(item);
              setScreen('detail');
            }}
            onNavigateToVault={() => setScreen('vault')}
          />
        );
      case 'detail':
        if (!selectedItem) {
          return null;
        }
        return (
          <FreezeDetailScreen
            item={selectedItem}
            onBack={async () => {
              const freshStats = await StorageService.getVaultStats();
              setVaultStats(freshStats);
              setScreen('freezer');
              setSelectedItem(null);
            }}
            onTriggerDecision={(item) => {
              setItemForDecision(item);
              setThawModalVisible(true);
            }}
            willpowerExp={vaultStats.willpowerExp}
            defenseLevel={vaultStats.defenseLevel}
            onEarlyThaw={handleEarlyThaw}
            onUpdateItem={async (updated) => {
              await handleUpdateItem(updated);
              const freshStats = await StorageService.getVaultStats();
              setVaultStats(freshStats);
            }}
            onAddWish={handleAddWish}
          />
        );
      case 'vault':
        return (
          <VaultScreen
            stats={vaultStats}
            wishlist={wishlist}
            onBack={() => setScreen('freezer')}
            onRedeemWish={handleRedeemWish}
            onAddWish={handleAddWish}
            onDeleteWish={handleDeleteWish}
            onAllocateToWish={handleAllocateToWish}
            onWithdrawFromWish={handleWithdrawFromWish}
            onToggleAutoAllocate={handleToggleAutoAllocate}
            onStatsChanged={setVaultStats}
            onWishlistChanged={setWishlist}
          />
        );
      default:
        return null;
    }
  };

  const appContent = (
    <View style={styles.appRoot}>
      <StatusBar barStyle={screen === 'freezer' ? 'dark-content' : 'light-content'} />
      {renderScreen()}

      {/* Modals */}
      <FreezeModal
        visible={freezeModalVisible}
        onClose={() => setFreezeModalVisible(false)}
        onFreezeItem={handleAddNewItem}
      />

      <ThawDecisionModal
        visible={thawModalVisible}
        item={itemForDecision}
        wishlist={wishlist}
        willpowerExp={vaultStats.willpowerExp}
        defenseLevel={vaultStats.defenseLevel}
        onAbandon={handleAbandonPurchase}
        onBuy={handleBuyPurchase}
        onRefreeze={handleRefreeze}
        onExtraRefreeze={handleExtraRefreeze}
        onClose={() => {
          setThawModalVisible(false);
          setItemForDecision(null);
        }}
      />

      {/* 3-step purchase confirmation ritual */}
      <PurchaseConfirmSteps
        visible={purchaseConfirmVisible}
        item={itemForPurchase}
        stats={vaultStats}
        onConfirm={handlePurchaseConfirmed}
        onCancel={() => {
          setPurchaseConfirmVisible(false);
          // Back to decision modal
          if (itemForPurchase) {
            setItemForDecision(itemForPurchase);
            setThawModalVisible(true);
          }
          setItemForPurchase(null);
        }}
      />

      {/* Victory settlement ceremony after abandoning */}
      <VictorySettlement
        visible={victoryVisible}
        item={victoryData?.item ?? null}
        expBreakdown={victoryData?.expBreakdown ?? null}
        newlyUnlocked={victoryData?.newlyUnlocked ?? []}
        stats={victoryData?.stats ?? null}
        autoAllocatedWishTitle={victoryData?.autoAllocatedWishTitle ?? null}
        isPerfect={victoryData?.isPerfect ?? false}
        onClose={() => setVictoryVisible(false)}
        onGoVault={() => {
          setVictoryVisible(false);
          setScreen('vault');
        }}
      />

      {/* Confetti burst on abandoning purchase */}
      {showConfetti && <ConfettiEffect onComplete={() => setShowConfetti(false)} />}
    </View>
  );

  // If on Web desktop, optionally wrap in a realistic phone mockup frame matching design draft
  if (Platform.OS === 'web' && usePhoneFrame) {
    return (
      <View style={styles.webContainer}>
        {/* Top bar controls */}
        <View style={styles.webHeader}>
          <Text style={styles.webTitle}>真实比例手机UI设计 - 冲动消费冷冻箱</Text>
          <Text style={styles.webSub}>Real-Proportion Phone UI Design - Impulse Purchase Freezer</Text>
          <View style={styles.webButtonsRow}>
            <TouchableOpacity
              style={[styles.webTabBtn, screen === 'freezer' && styles.webTabBtnActive]}
              onPress={() => {
                setScreen('freezer');
                setSelectedItem(null);
              }}
            >
              <Text style={styles.webTabBtnText}>屏1: 冷冻箱 (Navigate)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.webTabBtn, screen === 'detail' && styles.webTabBtnActive]}
              onPress={() => {
                if (items.length > 0) {
                  setSelectedItem(items[0]);
                  setScreen('detail');
                } else {
                  Alert.alert('提示', '请先录入冷冻商品');
                }
              }}
            >
              <Text style={styles.webTabBtnText}>屏2: 冰冻详情 (Freeze Info)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.webTabBtn, screen === 'vault' && styles.webTabBtnActive]}
              onPress={() => {
                setScreen('vault');
                setSelectedItem(null);
              }}
            >
              <Text style={styles.webTabBtnText}>屏3: 战利品金库 (Loot Vault)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.webFrameToggle}
              onPress={() => setUsePhoneFrame(false)}
            >
              <Text style={styles.webFrameToggleText}>切换全屏视图</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Realistic iPhone Bezel Container */}
        <View style={styles.phoneFrameWrapper}>
          <View style={styles.phoneDevice}>
            {/* Dynamic Island / Notch */}
            <View style={styles.phoneNotch}>
              <View style={styles.cameraLens} />
              <View style={styles.sensorDot} />
            </View>

            {/* Screen Viewport */}
            <View style={styles.phoneScreen}>{appContent}</View>

            {/* Home Indicator bar */}
            <View style={styles.homeIndicator} />
          </View>
        </View>
      </View>
    );
  }

  // Full Screen Native Container
  return (
    <View style={styles.fullScreen}>
      {appContent}
      {Platform.OS === 'web' && (
        <TouchableOpacity
          style={styles.floatingFrameToggle}
          onPress={() => setUsePhoneFrame(true)}
        >
          <Text style={styles.floatingFrameText}>📱 手机真机框展示</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    backgroundColor: '#070C1A',
  },
  appRoot: {
    flex: 1,
  },
  // Web desktop container
  webContainer: {
    minHeight: '100vh' as any,
    backgroundColor: '#0D1527',
    alignItems: 'center',
    paddingVertical: 20,
  },
  webHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  webTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  webSub: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 4,
    marginBottom: 12,
  },
  webButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  webTabBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  webTabBtnActive: {
    backgroundColor: '#38BDF8',
    borderColor: '#38BDF8',
  },
  webTabBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  webFrameToggle: {
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  webFrameToggleText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  phoneFrameWrapper: {
    padding: 8,
    backgroundColor: '#1E293B',
    borderRadius: 54,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.6,
    shadowRadius: 30,
    borderWidth: 4,
    borderColor: '#475569',
  },
  phoneDevice: {
    width: 390,
    height: 844,
    backgroundColor: '#000000',
    borderRadius: 46,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 4,
    borderColor: '#111827',
  },
  phoneNotch: {
    position: 'absolute',
    top: 10,
    alignSelf: 'center',
    width: 120,
    height: 28,
    backgroundColor: '#000000',
    borderRadius: 14,
    zIndex: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingRight: 16,
    gap: 8,
  },
  cameraLens: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#1E293B',
    borderWidth: 1.5,
    borderColor: '#0284C7',
  },
  sensorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0F172A',
  },
  phoneScreen: {
    flex: 1,
  },
  homeIndicator: {
    position: 'absolute',
    bottom: 6,
    alignSelf: 'center',
    width: 134,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    zIndex: 9999,
  },
  floatingFrameToggle: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    backgroundColor: '#1E293B',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#38BDF8',
    zIndex: 9999,
  },
  floatingFrameText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '700',
  },
});
