// 奖励模块配置：EXP 商店、连胜规则、完美克制判定
import { FreezerItem, VaultStats, AchievementMedal } from '../types';
import { getImpulseTier } from './intervention';
import { MEDAL_LIST } from './mockData';

// ---- EXP 商店特权 ----
export interface ExpPerk {
  id: string;
  emoji: string;
  title: string;
  desc: string;
  cost: number;
  contextual: boolean; // true = 需要在具体商品场景中使用（商店里只展示说明）
  /** 解锁所需段位（0 = 无门槛），对应 docs/REWARD_MODULE_DESIGN.md 4.3 段位特权 */
  minLevel: number;
}

export const EXP_PERKS: ExpPerk[] = [
  {
    id: 'early_thaw',
    emoji: '⚡',
    title: '提前解冻特权',
    desc: '不等倒计时结束，直接进入最终抉择（在冷冻中的商品详情页使用）',
    cost: 200,
    contextual: true,
    minLevel: 5, // Lv.5 理性大师解锁
  },
  {
    id: 'extra_refreeze',
    emoji: '🧊',
    title: '再冻一次 +',
    desc: '突破"最多再冻 2 次"限制，额外延长 24 小时（解冻抉择时使用）',
    cost: 100,
    contextual: true,
    minLevel: 7, // Lv.7 冰封领主解锁
  },
  {
    id: 'exp_to_balance',
    emoji: '💱',
    title: '心愿加速充能',
    desc: '把 EXP 按 1:1 折算充入心愿储蓄（每月上限 500 EXP，心愿已满则进可用余额）',
    cost: 100, // 每 100 EXP 起兑
    contextual: false,
    minLevel: 0,
  },
  {
    id: 'medal_frame_gold',
    emoji: '🖼️',
    title: '黄金奖章框',
    desc: '成就墙奖章展示框升级为鎏金样式（永久）',
    cost: 300,
    contextual: false,
    minLevel: 0,
  },
];

/** 情景特权的解锁段位（0 = 无门槛） */
export const PERK_MIN_LEVEL: Record<string, number> = EXP_PERKS.reduce(
  (acc, p) => ({ ...acc, [p.id]: p.minLevel }),
  {} as Record<string, number>
);

export function perkMinLevel(perkId: string): number {
  return PERK_MIN_LEVEL[perkId] ?? 0;
}

export const EXP_PERK_COST = {
  early_thaw: 200,
  extra_refreeze: 100,
  exp_to_balance_unit: 100,   // 每次兑换 100 EXP -> ¥100
  exp_to_balance_monthly_cap: 500,
  medal_frame_gold: 300,
};

// ---- 连胜规则 ----
export const STREAK = {
  dailyRewardExp: 5,
  minDaysForReward: 3,
};

/** 连胜奖章里程碑（按天数升序），单一数据源 = MEDAL_LIST 里的 streak 奖章 */
export const STREAK_MILESTONES: number[] = MEDAL_LIST.filter(
  (m) => m.type === 'streak' && typeof m.requiredStreak === 'number'
)
  .map((m) => m.requiredStreak as number)
  .sort((a, b) => a - b);

export interface StreakProgress {
  /** 当前连胜天数 */
  streak: number;
  /** 下一个待达成的里程碑（已全部达成则为 null） */
  nextMilestone: number | null;
  /** 冲向下一里程碑的进度（0-100） */
  percent: number;
  /** 距离下一里程碑还差几天 */
  remaining: number;
  /** 已解锁的连胜里程碑 */
  reached: number[];
}

/** 连胜进度（金库页「七日禅」进度条用） */
export function streakProgress(currentStreak: number): StreakProgress {
  const streak = Math.max(0, currentStreak || 0);
  const reached = STREAK_MILESTONES.filter((d) => streak >= d);
  const nextMilestone = STREAK_MILESTONES.find((d) => streak < d) ?? null;
  if (nextMilestone === null) {
    return { streak, nextMilestone: null, percent: 100, remaining: 0, reached };
  }
  const prev = reached.length ? reached[reached.length - 1] : 0;
  const span = Math.max(1, nextMilestone - prev);
  const percent = Math.max(0, Math.min(100, Math.round(((streak - prev) / span) * 100)));
  return { streak, nextMilestone, percent, remaining: nextMilestone - streak, reached };
}

// ---- 完美克制 ----
export const PERFECT_DEFENSE_BONUS = 50;

/**
 * 完美克制判定：① 集齐本档位全部理智印记 ② 到期后才决策（未提前破冰）③ 放弃
 * 提前解冻特权（earlyThawedAt）会跳过倒计时，因此明确排除在完美克制之外。
 */
export function isPerfectDefense(item: FreezerItem, decidedAt = Date.now()): boolean {
  if (item.earlyThawedAt) return false;
  const tierCfg = getImpulseTier(item.price);
  const marks = item.rationalMarks || [];
  const allMarks = tierCfg.quizLevels.every((lv) => marks.includes(lv));
  const maturedNaturally = decidedAt >= item.thawAt;
  return allMarks && maturedNaturally;
}

/** 按奖章类型判定是否达成 */
export function isMedalEarned(
  medal: AchievementMedal,
  stats: VaultStats,
  redeemedWishCount: number
): boolean {
  switch (medal.type) {
    case 'count':
      return stats.itemsDefended >= (medal.requiredDefended ?? Infinity);
    case 'saved':
      return stats.totalSaved >= (medal.requiredSaved ?? Infinity);
    case 'streak':
      return stats.currentStreak >= (medal.requiredStreak ?? Infinity);
    case 'perfect':
      return stats.perfectDefenses >= (medal.requiredPerfect ?? Infinity);
    case 'special':
      return redeemedWishCount >= (medal.requiredWishes ?? Infinity);
    default:
      return false;
  }
}

/** 奖章类型分组展示名 */
export const MEDAL_TYPE_LABELS: Record<AchievementMedal['type'], string> = {
  count: '🛡️ 防御次数',
  saved: '💰 累计节省',
  streak: '🔥 连续克制',
  perfect: '🌟 完美克制',
  special: '🎯 心愿达成',
};
