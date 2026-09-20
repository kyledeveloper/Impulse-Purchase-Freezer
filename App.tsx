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
} from 'react-native';
import { FreezerItem, VaultStats, WishlistItem } from './src/types';
import { StorageService } from './src/services/storage';
import { AudioService } from './src/services/audio';
import { FreezerScreen } from './src/screens/FreezerScreen';
import { FreezeDetailScreen } from './src/screens/FreezeDetailScreen';
import { VaultScreen } from './src/screens/VaultScreen';
import { FreezeModal } from './src/components/Modals/FreezeModal';
import { ThawDecisionModal } from './src/components/Modals/ThawDecisionModal';
import { ConfettiEffect } from './src/components/ConfettiEffect';

export default function App() {
  const [items, setItems] = useState<FreezerItem[]>([]);
  const [vaultStats, setVaultStats] = useState<VaultStats>({
    totalSaved: 0,
    itemsDefended: 0,
    defenseLevel: 1,
    willpowerExp: 0,
    unlockedMedals: [],
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

    // 1. Update item status
    const updatedList = items.map((i) =>
      i.id === item.id ? { ...i, status: 'thawed_abandoned' as const } : i
    );
    setItems(updatedList);
    await StorageService.saveItems(updatedList);

    // 2. Accumulate saved price into Loot Vault & record defense log
    const { stats: updatedStats, newlyUnlocked } =
      await StorageService.recordAbandonedPurchase(item);
    setVaultStats(updatedStats);

    // 3. Trigger victory confetti
    setShowConfetti(true);

    // 4. Return to freezer or vault
    if (screen === 'detail') {
      setScreen('freezer');
      setSelectedItem(null);
    }

    // 5. Celebration message
    let medalMsg = '';
    if (newlyUnlocked.length > 0) {
      medalMsg = '\n\n🏆 恭喜解锁了新的成就勋章！请前往【金库】查看！';
    }

    Alert.alert(
      '🪙 理性大胜利！金币入袋！',
      `你成功战胜了冲动！省下的 ¥${item.price.toLocaleString(
        'zh-CN'
      )} 已全额存入战利品金库！当前累计金币：¥${updatedStats.totalSaved.toLocaleString(
        'zh-CN'
      )}，自控力经验 +80 EXP！${medalMsg}`,
      [
        {
          text: '查看金库',
          onPress: () => setScreen('vault'),
        },
        { text: '继续冷冻' },
      ]
    );
  };

  // Handler: Choose to buy (Deliberate choice)
  const handleBuyPurchase = async (item: FreezerItem) => {
    setThawModalVisible(false);
    setItemForDecision(null);

    const updatedList = items.map((i) =>
      i.id === item.id ? { ...i, status: 'thawed_purchased' as const } : i
    );
    setItems(updatedList);
    await StorageService.saveItems(updatedList);

    // Log purchase to defense history
    const { stats: updatedStats } = await StorageService.recordConfirmedPurchase(item);
    setVaultStats(updatedStats);

    if (screen === 'detail') {
      setScreen('freezer');
      setSelectedItem(null);
    }

    Alert.alert('✅ 理性消费确认', `经过完整的冷静期，你确认了对「${item.name}」的真正需要！祝购物愉快！`);
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

  // Handler: Redeem a wish from the market
  const handleRedeemWish = async (wish: WishlistItem) => {
    const updatedWishlist = wishlist.map((w) =>
      w.id === wish.id ? { ...w, redeemed: true } : w
    );
    setWishlist(updatedWishlist);
    await StorageService.saveWishlist(updatedWishlist);
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
            onUpdateItem={async (updated) => {
              await handleUpdateItem(updated);
              const freshStats = await StorageService.getVaultStats();
              setVaultStats(freshStats);
            }}
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
        onAbandon={handleAbandonPurchase}
        onBuy={handleBuyPurchase}
        onClose={() => {
          setThawModalVisible(false);
          setItemForDecision(null);
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
