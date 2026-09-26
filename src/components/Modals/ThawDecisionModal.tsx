import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  ScrollView,
} from 'react-native';
import { FreezerItem, WishlistItem, InterventionSummary } from '../../types';
import { ASSETS } from '../../constants/assets';
import { AudioService } from '../../services/audio';
import { HapticsService } from '../../services/haptics';
import {
  calculateAbandonExp,
  canRefreeze,
  refreezeLeft,
  REFREEZE,
  projectAutoAllocation,
} from '../../constants/decision';
import { buildInterventionSummary } from '../../services/storage';
import {
  EXP_PERK_COST,
  PERFECT_DEFENSE_BONUS,
  isPerfectDefense,
  perkMinLevel,
} from '../../constants/rewards';

interface ThawDecisionModalProps {
  visible: boolean;
  item: FreezerItem | null;
  wishlist: WishlistItem[];
  /** 当前 EXP（再冻一次 + 特权余额展示） */
  willpowerExp?: number;
  /** 当前段位（再冻一次 + 特权 Lv.7 门槛展示） */
  defenseLevel?: number;
  onAbandon: (item: FreezerItem) => void;
  onBuy: (item: FreezerItem) => void;
  onRefreeze: (item: FreezerItem) => void;
  /** 情景特权：突破再冻次数上限（100 EXP） */
  onExtraRefreeze?: (item: FreezerItem) => void;
  onClose: () => void;
}

export const ThawDecisionModal: React.FC<ThawDecisionModalProps> = ({
  visible,
  item,
  wishlist,
  willpowerExp = 0,
  defenseLevel = 1,
  onAbandon,
  onBuy,
  onRefreeze,
  onExtraRefreeze,
  onClose,
}) => {
  // Live "thaw elapsed" ticker for gentle time pressure
  const [elapsedSec, setElapsedSec] = useState(0);
  useEffect(() => {
    if (!visible || !item) return;
    const tick = () => setElapsedSec(Math.max(0, Math.floor((Date.now() - item.thawAt) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [visible, item]);

  if (!item) return null;

  const summary: InterventionSummary = buildInterventionSummary(item);
  const expPreview = calculateAbandonExp(item);
  // 完美克制额外 +50 EXP（与 recordAbandonedPurchase 的实际结算保持一致）
  const perfectPreview = isPerfectDefense(item);
  const expTotal = expPreview.total + (perfectPreview ? PERFECT_DEFENSE_BONUS : 0);
  const refreezable = canRefreeze(item);
  const extraRefreezeCost = EXP_PERK_COST.extra_refreeze;
  const extraRefreezeLevel = perkMinLevel('extra_refreeze');
  const extraRefreezeLocked = defenseLevel < extraRefreezeLevel;
  const canAffordExtraRefreeze =
    !extraRefreezeLocked && willpowerExp >= extraRefreezeCost;

  // 这笔钱的实际去向（与结算逻辑共用 projectAutoAllocation）
  const autoAlloc = projectAutoAllocation(item.price, wishlist);
  const topWishPreview = (() => {
    const active = wishlist.filter((w) => !w.redeemed && w.cost > 0);
    if (active.length === 0) return null;
    const top = active.reduce((best, w) =>
      (w.allocatedAmount || 0) / Math.max(1, w.cost) > (best.allocatedAmount || 0) / Math.max(1, best.cost)
        ? w
        : best
    );
    return {
      title: top.title,
      beforePct: Math.min(100, Math.round(((top.allocatedAmount || 0) / Math.max(1, top.cost)) * 100)),
    };
  })();
  const autoAllocBeforePct = autoAlloc.wish
    ? Math.min(
        100,
        Math.round(((autoAlloc.wish.allocatedAmount || 0) / Math.max(1, autoAlloc.wish.cost)) * 100)
      )
    : 0;
  const autoAllocAfterPct = autoAlloc.wishAfterPercent ?? 0;

  const pad = (n: number) => (n < 10 ? '0' + n : String(n));
  const elapsedText = `${pad(Math.floor(elapsedSec / 60))}:${pad(elapsedSec % 60)}`;

  const handleAbandon = () => {
    AudioService.playCoinSound();
    HapticsService.victorySuccess();
    onAbandon(item);
  };

  const handleBuy = () => {
    HapticsService.lightTap();
    onBuy(item); // App routes into the 3-step PurchaseConfirmSteps flow
  };

  const handleRefreeze = () => {
    HapticsService.mediumTap();
    AudioService.playIceCrackSound();
    onRefreeze(item);
  };

  const durationLabel =
    item.freezeDurationHours < 1 ? '10 秒(测试)' : `${item.freezeDurationHours} 小时`;
  const refrozenTimes = item.refreezeCount || 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.card}>
          <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
            {/* Header */}
            <View style={styles.iceHeader}>
              <Text style={styles.iceHeaderEmoji}>❄️ ➔ 🪙</Text>
              <Text style={styles.iceHeaderTitle}>冷冻期结束，冰层已消融</Text>
              <Text style={styles.elapsedText}>解冻已过去 {elapsedText}</Text>
            </View>

            {/* Item preview */}
            <View style={styles.itemBox}>
              <View style={styles.meltPuddleContainer}>
                <Image
                  source={ASSETS.iceCubeMeltPuddle}
                  style={styles.meltPuddleImg}
                  resizeMode="contain"
                />
                <Image
                  source={
                    item.rawCutout ||
                    (item.image === ASSETS.frozenPhone || item.image === ASSETS.icePhone || !item.image
                      ? ASSETS.phoneClean
                      : item.image)
                  }
                  style={styles.unencasedItemImg}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.itemName} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.itemPrice}>¥{item.price.toLocaleString('zh-CN')}</Text>
            </View>

            {/* Battle report */}
            <View style={styles.reportBox}>
              <Text style={styles.reportTitle}>📊 本次冷静期战报</Text>
              <View style={styles.reportRow}>
                <Text style={styles.reportLabel}>冷冻时长</Text>
                <Text style={styles.reportValue}>
                  {durationLabel}
                  {refrozenTimes > 0 ? `（含再冻 ×${refrozenTimes}）` : ''}
                </Text>
              </View>
              <View style={styles.reportRow}>
                <Text style={styles.reportLabel}>完成干预</Text>
                <Text style={styles.reportValue}>
                  呼吸 ×{summary.breathCount} · 印记 {summary.rationalMarks} 枚
                  {summary.journalScene ? ' · 日记 ✓' : ''}
                </Text>
              </View>
              <View style={styles.reportRow}>
                <Text style={styles.reportLabel}>冲动压平率</Text>
                <Text style={[styles.reportValue, styles.reportGreen]}>
                  -{summary.flattenedPercent}%
                </Text>
              </View>
              {summary.quizInsisted > 0 && (
                <View style={styles.reportRow}>
                  <Text style={styles.reportLabel}>坚持破冰次数</Text>
                  <Text style={[styles.reportValue, styles.reportAmber]}>
                    {summary.quizInsisted} 次（购买将扣减 EXP）
                  </Text>
                </View>
              )}
              {!!item.futureSelfNote && (
                <View style={styles.futureSelfBox}>
                  <Text style={styles.futureSelfLabel}>💌 冷冻时你给未来的留言：</Text>
                  <Text style={styles.futureSelfText}>{item.futureSelfNote}</Text>
                </View>
              )}
            </View>

            {/* Wish linkage —— 展示这笔钱的实际去向 */}
            {(autoAlloc.wish || topWishPreview) && (
              <View style={styles.wishBox}>
                <Text style={styles.wishTitle}>🎯 放弃后这笔钱的去向</Text>
                {autoAlloc.wish ? (
                  <>
                    <Text style={styles.wishText} numberOfLines={1}>
                      「{autoAlloc.wish.title}」充入 ¥{autoAlloc.toWish.toLocaleString('zh-CN')} →{' '}
                      {autoAlloc.wishAfterPercent}%
                      {autoAlloc.toBalance > 0
                        ? ` · 其余 ¥${autoAlloc.toBalance.toLocaleString('zh-CN')} 进可用余额`
                        : ''}
                    </Text>
                    <View style={styles.wishBarBg}>
                      <View style={[styles.wishBarBefore, { width: `${autoAllocBeforePct}%` }]} />
                      <View
                        style={[
                          styles.wishBarAfter,
                          {
                            width: `${Math.max(0, autoAllocAfterPct - autoAllocBeforePct)}%`,
                            left: `${autoAllocBeforePct}%`,
                          },
                        ]}
                      />
                    </View>
                  </>
                ) : (
                  <Text style={styles.wishText} numberOfLines={2}>
                    ¥{item.price.toLocaleString('zh-CN')} 将全额进入金库可用余额（未开启「放弃后自动充入」）
                    {topWishPreview ? `\n可在心愿「${topWishPreview.title}」里打开自动充入` : ''}
                  </Text>
                )}
              </View>
            )}

            {/* Psychological question */}
            <View style={styles.questionBox}>
              <Text style={styles.questionText}>你现在还想买它吗？</Text>
              <Text style={styles.questionSub}>
                经过多巴胺冷静期，非理性冲动往往已经消散。
              </Text>
            </View>

            {/* Three decision paths */}
            <View style={styles.btnColumn}>
              {/* A. Abandon — biggest, brightest, top */}
              <TouchableOpacity style={styles.abandonBtn} activeOpacity={0.85} onPress={handleAbandon}>
                <View style={styles.btnContent}>
                  <Text style={styles.abandonBtnEmoji}>🎉</Text>
                  <View style={styles.flex}>
                    <Text style={styles.abandonBtnTitle}>放弃购买，金币入袋</Text>
                    <Text style={styles.abandonBtnSub}>
                      +¥{item.price.toLocaleString('zh-CN')} 入库 · +{expTotal} EXP
                      {expPreview.markBonus > 0 ? `（含印记加成 +${expPreview.markBonus}）` : ''}
                      {perfectPreview ? `（含完美克制 +${PERFECT_DEFENSE_BONUS}）` : ''}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>

              {/* B. Refreeze — middle option */}
              {refreezable && (
                <TouchableOpacity style={styles.refreezeBtn} activeOpacity={0.8} onPress={handleRefreeze}>
                  <Text style={styles.refreezeBtnTitle}>
                    🧊 还没想好？再冻 {REFREEZE.extendHours} 小时（还可 {refreezeLeft(item)} 次）
                  </Text>
                </TouchableOpacity>
              )}

              {/* C. Buy — smallest, dimmest, bottom */}
              {!refreezable && onExtraRefreeze && (
                <TouchableOpacity
                  style={[
                    styles.refreezeBtn,
                    styles.extraRefreezeBtn,
                    !canAffordExtraRefreeze && styles.extraRefreezeDisabled,
                  ]}
                  activeOpacity={0.8}
                  disabled={!canAffordExtraRefreeze}
                  onPress={() => {
                    if (!canAffordExtraRefreeze) return;
                    HapticsService.lightTap();
                    onExtraRefreeze(item);
                  }}
                >
                  <Text style={styles.refreezeBtnTitle}>
                    {extraRefreezeLocked
                      ? `🧊 再冻次数已用完 · 需 Lv.${extraRefreezeLevel} 解锁（当前 Lv.${defenseLevel}）`
                      : canAffordExtraRefreeze
                      ? `🧊 再冻次数已用完 · 用 ${extraRefreezeCost} EXP 再冻一次 +（当前 ${willpowerExp} EXP）`
                      : `🧊 再冻次数已用完 · 需 ${extraRefreezeCost} EXP（当前 ${willpowerExp}，不足）`}
                  </Text>
                </TouchableOpacity>
              )}


              <TouchableOpacity style={styles.buyBtn} activeOpacity={0.8} onPress={handleBuy}>
                <Text style={styles.buyBtnTitle}>仍然想买（需通过最终确认）</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(7, 21, 39, 0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#0F1E36',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#38BDF8',
    padding: 20,
    width: '100%',
    maxHeight: '92%',
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  scroll: {
    width: '100%',
  },
  flex: { flex: 1 },
  iceHeader: {
    alignItems: 'center',
    marginBottom: 12,
  },
  iceHeaderEmoji: {
    fontSize: 28,
    marginBottom: 4,
  },
  iceHeaderTitle: {
    fontSize: 13,
    color: '#67E8F9',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  elapsedText: {
    fontSize: 10,
    color: '#F59E0B',
    fontWeight: '700',
    marginTop: 3,
    fontVariant: ['tabular-nums'],
  },
  itemBox: {
    alignItems: 'center',
    backgroundColor: '#13233F',
    borderRadius: 16,
    padding: 12,
    width: '100%',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1E3A5F',
  },
  meltPuddleContainer: {
    width: 140,
    height: 110,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  meltPuddleImg: {
    position: 'absolute',
    bottom: 0,
    width: 130,
    height: 65,
  },
  unencasedItemImg: {
    width: 68,
    height: 68,
    position: 'absolute',
    top: 6,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  itemPrice: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FBBF24',
  },
  reportBox: {
    width: '100%',
    backgroundColor: '#13233F',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1E3A5F',
    padding: 12,
    marginBottom: 12,
  },
  reportTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 8,
  },
  reportRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  reportLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  reportValue: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  reportGreen: {
    color: '#34D399',
  },
  reportAmber: {
    color: '#FBBF24',
  },
  futureSelfBox: {
    backgroundColor: 'rgba(103, 232, 249, 0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(103, 232, 249, 0.35)',
    padding: 8,
    marginTop: 8,
  },
  futureSelfLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#67E8F9',
    marginBottom: 2,
  },
  futureSelfText: {
    fontSize: 12,
    color: '#E0F2FE',
    lineHeight: 17,
  },
  wishBox: {
    width: '100%',
    backgroundColor: 'rgba(251, 191, 36, 0.08)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.35)',
    padding: 12,
    marginBottom: 12,
  },
  wishTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FBBF24',
    marginBottom: 4,
  },
  wishText: {
    fontSize: 11,
    color: '#E2E8F0',
    fontWeight: '700',
    marginBottom: 6,
  },
  wishBarBg: {
    height: 8,
    backgroundColor: '#1E293B',
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  wishBarBefore: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#F59E0B',
  },
  wishBarAfter: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: '#34D399',
  },
  questionBox: {
    alignItems: 'center',
    marginBottom: 16,
  },
  questionText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  questionSub: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
  },
  btnColumn: {
    width: '100%',
    gap: 10,
  },
  abandonBtn: {
    backgroundColor: '#10B981',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  abandonBtnEmoji: {
    fontSize: 22,
  },
  abandonBtnTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  abandonBtnSub: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 1,
  },
  refreezeBtn: {
    backgroundColor: 'rgba(56, 189, 248, 0.14)',
    borderRadius: 14,
    paddingVertical: 11,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#38BDF8',
  },
  refreezeBtnTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#7DD3FC',
  },
  extraRefreezeBtn: {
    borderColor: '#A78BFA',
    backgroundColor: 'rgba(167, 139, 250, 0.12)',
  },
  extraRefreezeDisabled: {
    opacity: 0.45,
  },
  buyBtn: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  buyBtnTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
  },
});
