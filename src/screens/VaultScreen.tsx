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
import { VaultStats, WishlistItem, DefenseRecord } from '../types';
import { DEFENSE_RANKS } from '../constants/mockData';
import { HapticsService } from '../services/haptics';
import { AudioService } from '../services/audio';
import { StorageService } from '../services/storage';

interface VaultScreenProps {
  stats: VaultStats;
  wishlist: WishlistItem[];
  onBack: () => void;
  onRedeemWish: (wish: WishlistItem) => void;
  onAddWish: (newWish: WishlistItem) => void;
  onDeleteWish: (id: string) => void;
}

export const VaultScreen: React.FC<VaultScreenProps> = ({
  stats,
  wishlist,
  onBack,
  onRedeemWish,
  onAddWish,
  onDeleteWish,
}) => {
  const [activeTab, setActiveTab] = useState<'wishes' | 'history'>('wishes');
  const [records, setRecords] = useState<DefenseRecord[]>([]);
  const [journalSceneStats, setJournalSceneStats] = useState<[string, number][]>([]);
  const [addWishModalVisible, setAddWishModalVisible] = useState(false);

  // Load history records & impulse journal profile on mount
  useEffect(() => {
    async function loadRecords() {
      const recs = await StorageService.getDefenseRecords();
      setRecords(recs);

      // Aggregate impulse journal scenes from all items (冲动画像)
      const items = await StorageService.getItems();
      const sceneCount: Record<string, number> = {};
      items.forEach((it) => {
        if (it.journal?.scene) {
          sceneCount[it.journal.scene] = (sceneCount[it.journal.scene] || 0) + 1;
        }
      });
      const sorted = Object.entries(sceneCount).sort((a, b) => b[1] - a[1]);
      setJournalSceneStats(sorted);
    }
    loadRecords();
  }, [stats]);

  // Determine current and next defense rank
  const currentRank =
    DEFENSE_RANKS.find((r) => r.level === stats.defenseLevel) || DEFENSE_RANKS[0];
  const nextRank =
    DEFENSE_RANKS.find((r) => r.level === stats.defenseLevel + 1) || null;

  // Rank progress calculation
  const currentExp = stats.willpowerExp || 0;
  const rankProgress = nextRank
    ? Math.min(100, Math.round(((currentExp - currentRank.minExp) / Math.max(1, nextRank.minExp - currentRank.minExp)) * 100))
    : 100;

  const handleRedeemPress = (item: WishlistItem) => {
    HapticsService.lightTap();
    if (stats.totalSaved >= item.cost) {
      AudioService.playFanfareSound();
      HapticsService.victorySuccess();
      Alert.alert(
        '🎉 恭喜达成梦想心愿！',
        `你通过抵御冲动消费，已成功积攒足够资金兑换「${item.title}」！这是深思熟虑且完全值得拥有的梦想战利品！`,
        [
          {
            text: '立即达成兑换',
            onPress: () => onRedeemWish(item),
          },
          { text: '继续保留储蓄' },
        ]
      );
    } else {
      const needed = item.cost - stats.totalSaved;
      Alert.alert(
        '🔒 心愿储蓄充能中',
        `心愿目标：¥${item.cost.toLocaleString('zh-CN')}
当前金库可用：¥${stats.totalSaved.toLocaleString(
          'zh-CN'
        )}
还需省下 ¥${needed.toLocaleString('zh-CN')} 即可达成！

每一次克制冲动，都在为真正的梦想买单！`,
        [{ text: '继续加油！' }]
      );
    }
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
                  <Text style={styles.rankNextLabel}>
                    {nextRank ? `晋级需 ${nextRank.minExp}` : '已登顶'}
                  </Text>
                </View>
                <View style={styles.rankProgressTrack}>
                  <View style={[styles.rankProgressFill, { width: `${rankProgress}%` }]} />
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
                  const progress = Math.min(1, stats.totalSaved / item.cost);
                  const percent = Math.round(progress * 100);
                  const isReady = stats.totalSaved >= item.cost;

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

                      {/* Progress Bar */}
                      <View style={styles.progressBarBg}>
                        <View style={[styles.progressBarFill, { width: `${percent}%` }]} />
                      </View>
                      <Text style={styles.progressText}>{percent}% 已充能</Text>

                      {/* Action Button */}
                      <TouchableOpacity
                        style={[styles.redeemBtn, isReady && styles.redeemBtnReady]}
                        activeOpacity={0.8}
                        onPress={() => handleRedeemPress(item)}
                      >
                        <Text style={[styles.redeemBtnText, isReady && styles.redeemBtnTextReady]}>
                          {isReady ? '🎉 达成兑换' : '储蓄中...'}
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
                records.map((rec) => (
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
                    </View>
                  </View>
                ))
              )}
            </View>
          )}

          {/* 7 Medals Row */}
          <MedalRow unlockedMedals={stats.unlockedMedals} />
        </ScrollView>

        {/* Add Wish Modal */}
        <AddWishModal
          visible={addWishModalVisible}
          onClose={() => setAddWishModalVisible(false)}
          onAddWish={onAddWish}
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
});
