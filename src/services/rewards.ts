import AsyncStorage from '@react-native-async-storage/async-storage';
import { VaultStats, DefenseRecord, ExpTransaction } from '../types';
import { MEDAL_LIST, DEFENSE_RANKS } from '../constants/mockData';
import { STREAK, isMedalEarned, EXP_PERK_COST } from '../constants/rewards';
import { todayStr } from '../constants/intervention';
import { currentMonthStr } from '../constants/decision';

const EXP_LOG_KEY = '@ipf_exp_log_v1';
const EXP_LOG_MAX = 200;
/** 月度兑换累计计数器（独立于会被裁剪的 EXP 流水，保证月度上限不被绕过） */
const EXP_MONTH_KEY = '@ipf_exp_month_v1';

/**
 * 段位判定：**同时**满足「意志力 EXP」与「累计节省」两条门槛才达成（见
 * docs/REWARD_MODULE_DESIGN.md 4.3「等级判定同时看 EXP 和累计节省，防止只刷小商品升级」）。
 * `defended` 参数保留是为了兼容既有调用签名，当前不参与判定。
 */
export function calculateDefenseLevel(saved: number, defended: number, exp: number): number {
  let level = 1;
  for (const rank of DEFENSE_RANKS) {
    if (exp >= rank.minExp && saved >= rank.minSaved) {
      level = rank.level;
    }
  }
  return level;
}

/**
 * 段位只升不降：取「已持有段位」与「当前门槛算出的段位」的较大值。
 * - 花 EXP / 兑换心愿金会扣 EXP，但不应让玩家掉段；
 * - 旧版本用 OR 判定，老玩家可能持有高于 AND 门槛的段位 → 予以保留（grandfathering）。
 * 所有写库路径都应使用它，而不是直接调用 calculateDefenseLevel。
 */
export function resolveDefenseLevel(
  currentLevel: number,
  saved: number,
  defended: number,
  exp: number
): number {
  return Math.max(currentLevel || 1, calculateDefenseLevel(saved, defended, exp));
}

/**
 * 连胜判定：从今天往前数，连续没有任何「确认购买」记录的天数。
 * 从未购买过的用户从首条记录之日起算；无任何记录则为 0。
 * 直接从 DefenseRecord 派生，天然防作弊（基于自然日，与打开时间无关）。
 */
export function computeStreak(records: DefenseRecord[], now = Date.now()): number {
  const purchasedDays = new Set(
    records
      .filter((r) => r.outcome === 'purchased')
      .map((r) => dayKey(r.timestamp))
  );
  const firstRecordTs = records.length
    ? Math.min(...records.map((r) => r.timestamp))
    : null;

  const DAY = 86400000;
  const todayStart = startOfDay(now);
  let streak = 0;

  for (let d = todayStart; ; d -= DAY) {
    if (purchasedDays.has(dayKey(d))) break;
    if (firstRecordTs !== null && d < startOfDay(firstRecordTs)) break;
    streak += 1;
    if (firstRecordTs === null) break; // 无记录：今天算第 0 天 → streak 应为 0
  }
  // 无任何记录时循环会把今天数进去，这里修正
  if (firstRecordTs === null) return 0;
  return streak;
}

function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export const RewardsService = {
  /** 追加一条 EXP 流水（裁剪到最近 200 条） */
  async appendExpLog(amount: number, source: string, itemId?: string): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(EXP_LOG_KEY);
      const log: ExpTransaction[] = raw ? JSON.parse(raw) : [];
      log.unshift({ id: 'exp-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6), amount, source, itemId, timestamp: Date.now() });
      await AsyncStorage.setItem(EXP_LOG_KEY, JSON.stringify(log.slice(0, EXP_LOG_MAX)));
    } catch (e) {
      console.warn('Failed to append EXP log:', e);
    }
  },

  async getExpLog(): Promise<ExpTransaction[]> {
    try {
      const raw = await AsyncStorage.getItem(EXP_LOG_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  },

  /** 本月已用 EXP 转余额的总量（月度上限控制） */
  async getMonthlyExpConverted(): Promise<number> {
    const month = currentMonthStr();
    try {
      const raw = await AsyncStorage.getItem(EXP_MONTH_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { month?: string; converted?: number };
        if (parsed.month === month) return Math.max(0, parsed.converted || 0);
      }
    } catch (e) {
      console.warn('Failed to read monthly EXP conversion counter:', e);
    }
    // 迁移 / 兜底：旧版本没有独立计数器，用本月流水回推
    return this.sumLogConvertedForMonth(month);
  },

  /** 用 EXP 流水回推指定月份已兑换量（仅在不存独立计数器时使用） */
  async sumLogConvertedForMonth(month: string): Promise<number> {
    const log = await this.getExpLog();
    return log
      .filter((t) => t.source === 'exp_to_balance' && monthKey(t.timestamp) === month)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  },

  /**
   * 记录一次 EXP→心愿金兑换（累加到本月计数器，跨月自动归零）。
   * `baseTotal` 传入本次兑换前的本月累计值（调用方已读取过，避免与刚写入的流水重复计算）。
   * 返回记录后的本月累计值。
   */
  async recordExpConversion(amount: number, baseTotal?: number): Promise<number> {
    const month = currentMonthStr();
    if (amount <= 0) return this.getMonthlyExpConverted();
    const base = typeof baseTotal === 'number' ? Math.max(0, baseTotal) : await this.getMonthlyExpConverted();
    const total = base + amount;
    try {
      await AsyncStorage.setItem(EXP_MONTH_KEY, JSON.stringify({ month, converted: total }));
    } catch (e) {
      console.warn('Failed to save monthly EXP conversion counter:', e);
    }
    return total;
  },

  /** 清空 EXP 流水与月度计数器（重置全部数据时调用） */
  async clearExpLog(): Promise<void> {
    try {
      await AsyncStorage.removeItem(EXP_LOG_KEY);
      await AsyncStorage.removeItem(EXP_MONTH_KEY);
    } catch (e) {
      console.warn('Failed to clear EXP log:', e);
    }
  },

  /**
   * 奖章评估引擎：返回新解锁的奖章 id 列表。
   * 所有 EXP / 次数 / 金额 / 连胜 / 完美克制 / 心愿 变动后都应调用。
   */
  evaluateMedals(stats: VaultStats, redeemedWishCount: number): string[] {
    const unlocked = new Set(stats.unlockedMedals);
    const newly: string[] = [];
    for (const medal of MEDAL_LIST) {
      if (!unlocked.has(medal.id) && isMedalEarned(medal, stats, redeemedWishCount)) {
        unlocked.add(medal.id);
        newly.push(medal.id);
      }
    }
    return newly;
  },

  /**
   * 每日连胜奖励：streak >= 3 时每日首次打开 +5 EXP（按自然日去重）。
   * 返回 null 表示今天已发过或未达条件。
   */
  async claimDailyStreakReward(
    stats: VaultStats,
    records: DefenseRecord[],
    persist: (s: VaultStats) => Promise<void>
  ): Promise<{ stats: VaultStats; streak: number; expGained: number; newlyUnlocked: string[] } | null> {
    const streak = computeStreak(records);
    const today = todayStr();

    let expGained = 0;
    if (streak >= STREAK.minDaysForReward && stats.lastDailyRewardDate !== today) {
      expGained = STREAK.dailyRewardExp;
      await this.appendExpLog(expGained, 'streak');
    }

    const newExp = (stats.willpowerExp || 0) + expGained;
    const next: VaultStats = {
      ...stats,
      currentStreak: streak,
      willpowerExp: newExp,
      defenseLevel: resolveDefenseLevel(stats.defenseLevel, stats.totalSaved, stats.itemsDefended, newExp),
      lastDailyRewardDate: expGained > 0 ? today : stats.lastDailyRewardDate,
    };

    const newlyUnlocked = this.evaluateMedals(next, 0);
    next.unlockedMedals = [...next.unlockedMedals, ...newlyUnlocked];

    if (
      streak === stats.currentStreak &&
      expGained === 0 &&
      newlyUnlocked.length === 0
    ) {
      return null; // 无变化
    }

    await persist(next);
    return { stats: next, streak, expGained, newlyUnlocked };
  },
};

function monthKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export { EXP_PERK_COST };
