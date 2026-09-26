// 决策模块配置：EXP 公式、再冻规则、使用反馈
import { FreezerItem, WishlistItem } from '../types';

// ---- 放弃购买 EXP 公式 ----
export const ABANDON_EXP = {
  base: 50,
  perMark: 15,          // 每个理智印记
  maxMarkBonus: 60,     // 印记加成上限（4 印记）
  fullCooldown: 30,     // 完整冷静期（到期后才决策，未提前破冰）
  glacierBonus: 20,     // 冰川级（>¥2000）额外加成
};

export interface ExpBreakdown {
  base: number;
  markBonus: number;
  markCount: number;
  fullCooldownBonus: number;
  glacierBonus: number;
  total: number;
}

export function calculateAbandonExp(item: FreezerItem, decidedAt = Date.now()): ExpBreakdown {
  const marks = item.rationalMarks || [];
  const markBonus = Math.min(ABANDON_EXP.maxMarkBonus, marks.length * ABANDON_EXP.perMark);
  const fullCooldownBonus = decidedAt >= item.thawAt ? ABANDON_EXP.fullCooldown : 0;
  const glacierBonus = item.price > 2000 ? ABANDON_EXP.glacierBonus : 0;
  return {
    base: ABANDON_EXP.base,
    markBonus,
    markCount: marks.length,
    fullCooldownBonus,
    glacierBonus,
    total: ABANDON_EXP.base + markBonus + fullCooldownBonus + glacierBonus,
  };
}

// ---- 确认购买 EXP：基础 20，冲动残留惩罚 quizInsisted × 5，最低 5 ----
export function calculatePurchaseExp(item: FreezerItem): number {
  const insisted = item.quizInsisted || 0;
  return Math.max(5, 20 - insisted * 5);
}

// ---- 再冻规则 ----
export const REFREEZE = {
  maxCount: 2,              // 最多再冻 2 次
  extendHours: 24,          // 每次延长 24 小时
};

export function canRefreeze(item: FreezerItem): boolean {
  return (item.refreezeCount || 0) < REFREEZE.maxCount;
}

export function refreezeLeft(item: FreezerItem): number {
  return Math.max(0, REFREEZE.maxCount - (item.refreezeCount || 0));
}

// ---- 放弃购买时的自动充入预测 ----
export interface AutoAllocationProjection {
  /** 命中的自动充入心愿（未开启自动充入 / 已充满 / 已兑换时为 null） */
  wish: WishlistItem | null;
  /** 进入该心愿的金额 */
  toWish: number;
  /** 剩余进入金库可用余额的金额 */
  toBalance: number;
  /** 该心愿充能后的进度百分比（无命中心愿时为 null） */
  wishAfterPercent: number | null;
}

/**
 * 放弃购买时这笔钱的实际去向（与 recordAbandonedPurchase 的自动充入规则一致）：
 * 命中「第一个开启自动充入且未充满的未兑换心愿」，多余部分进可用余额。
 * 决策弹窗与结算页都用它展示，避免出现"全部充入某个心愿"的误导。
 */
export function projectAutoAllocation(price: number, wishlist: WishlistItem[]): AutoAllocationProjection {
  const target =
    wishlist.find(
      (w) => w.autoAllocate && !w.redeemed && (w.allocatedAmount || 0) < w.cost
    ) || null;
  if (!target) {
    return { wish: null, toWish: 0, toBalance: price, wishAfterPercent: null };
  }
  const need = Math.max(0, target.cost - (target.allocatedAmount || 0));
  const toWish = Math.min(need, price);
  const after = (target.allocatedAmount || 0) + toWish;
  return {
    wish: target,
    toWish,
    toBalance: Math.max(0, price - toWish),
    wishAfterPercent: Math.min(100, Math.round((after / Math.max(1, target.cost)) * 100)),
  };
}

// ---- 使用反馈 ----
export const USAGE_FEEDBACK_DAYS = 30;
export const USAGE_FEEDBACK_OPTIONS = [
  { key: 'often', emoji: '🔥', label: '经常使用', exp: 15, msg: '理性消费的成功案例！' },
  { key: 'sometimes', emoji: '🌤️', label: '偶尔使用', exp: 10, msg: '还不错，物尽其用就是好购买' },
  { key: 'dusty', emoji: '🕸️', label: '吃灰了', exp: 5, msg: '诚实面对自己！下次冷冻时可以更严格哦' },
  { key: 'sold', emoji: '💱', label: '已转卖', exp: 5, msg: '及时止损也是一种智慧' },
] as const;

export type UsageFeedbackKey = (typeof USAGE_FEEDBACK_OPTIONS)[number]['key'];

// ---- 分享文案模板 ----
export function victoryShareText(item: FreezerItem, totalSaved: number): string {
  const hours = item.freezeDurationHours < 1 ? '10 秒(测试)' : `${item.freezeDurationHours} 小时`;
  return `我用 ${hours} 冷静期，成功抵御了 ¥${item.price.toLocaleString('zh-CN')} 的冲动消费「${item.name}」！累计已省下 ¥${totalSaved.toLocaleString('zh-CN')}。#冲动消费冷冻箱`;
}

// ---- 月度 key ----
export function currentMonthStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
