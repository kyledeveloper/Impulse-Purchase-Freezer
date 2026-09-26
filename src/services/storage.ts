import AsyncStorage from '@react-native-async-storage/async-storage';
import { FreezerItem, VaultStats, WishlistItem, DefenseRecord, InterventionSummary } from '../types';
import { INITIAL_ITEMS, INITIAL_VAULT_STATS, INITIAL_WISHLIST } from '../constants/mockData';
import { getImpulseTier, todayStr } from '../constants/intervention';
import {
  calculateAbandonExp,
  calculatePurchaseExp,
  currentMonthStr,
  projectAutoAllocation,
} from '../constants/decision';
import {
  isPerfectDefense,
  PERFECT_DEFENSE_BONUS,
  EXP_PERKS,
  EXP_PERK_COST,
  perkMinLevel,
} from '../constants/rewards';
import { RewardsService, resolveDefenseLevel, computeStreak } from './rewards';

const KEYS = {
  ITEMS: '@ipf_items_v1',
  VAULT: '@ipf_vault_stats_v1',
  WISHLIST: '@ipf_wishlist_v1',
  RECORDS: '@ipf_records_v1',
};

/** EXP 商店里的兑换入口（非"拥有型"特权），只能走 expToBalance */
const EXCHANGE_PERK_ID = 'exp_to_balance';

/** 情景特权的扣费结果：区分「段位不够」与「EXP 不足」，便于 UI 给出准确提示 */
export type SpendContextualPerkResult =
  | { ok: true; stats: VaultStats }
  | { ok: false; reason: 'level'; requiredLevel: number; currentLevel: number }
  | { ok: false; reason: 'exp'; cost: number };

/** EXP 兑换心愿金的返回结构 */
export interface ExpExchangeResult {
  stats: VaultStats;
  wishlist: WishlistItem[];
  /** 实际兑换掉的 EXP（= 获得的金额） */
  converted: number;
  /** 充入心愿的部分 */
  toWish: number;
  /** 进入可用余额的部分（无心愿可充时） */
  toBalance: number;
  /** 被充能的心愿标题 */
  wishTitle: string | null;
}

/**
 * Migrates legacy FreezerItem records to the intervention-module schema.
 * Fills in tier-based defaults for any missing new fields.
 */
export function migrateItem(item: FreezerItem): FreezerItem {
  const tierCfg = getImpulseTier(item.price);
  return {
    ...item,
    tier: item.tier ?? tierCfg.tier,
    breakTapsRemaining: item.breakTapsRemaining ?? tierCfg.maxTaps,
    calmWaitBonus: item.calmWaitBonus ?? 0,
    answeredQuizLevels: item.answeredQuizLevels ?? [],
    tapsToday: item.tapsToday ?? 0,
    chillToday: item.chillToday ?? 0,
    lastResetDate: item.lastResetDate ?? todayStr(),
    rationalMarks: item.rationalMarks ?? [],
    quizInsisted: item.quizInsisted ?? 0,
    interventionLog: item.interventionLog ?? [],
    notificationIds: item.notificationIds ?? [],
  };
}

/**
 * Migrates legacy VaultStats to the decision-module schema:
 * - availableBalance defaults to totalSaved (legacy: all savings were "usable")
 * - monthly purchase counters reset when the month rolls over
 * - reward-module fields (streak / perfect / perks) default to zero-state
 */
export function migrateVaultStats(parsed: any): VaultStats {
  const month = currentMonthStr();
  const sameMonth = parsed.purchaseMonth === month;
  return {
    totalSaved: parsed.totalSaved ?? 0,
    availableBalance: parsed.availableBalance ?? parsed.totalSaved ?? 0,
    allocatedToWishes: parsed.allocatedToWishes ?? 0,
    itemsDefended: parsed.itemsDefended ?? 0,
    defenseLevel: parsed.defenseLevel ?? 1,
    willpowerExp: parsed.willpowerExp ?? 0,
    unlockedMedals: parsed.unlockedMedals ?? [],
    monthlyPurchasedCount: sameMonth ? parsed.monthlyPurchasedCount ?? 0 : 0,
    monthlyPurchasedAmount: sameMonth ? parsed.monthlyPurchasedAmount ?? 0 : 0,
    purchaseMonth: month,
    currentStreak: parsed.currentStreak ?? 0,
    perfectDefenses: parsed.perfectDefenses ?? 0,
    ownedPerks: parsed.ownedPerks ?? [],
    lastDailyRewardDate: parsed.lastDailyRewardDate ?? '',
  };
}

/** Migrates legacy WishlistItem (adds allocation fields). */
export function migrateWish(wish: WishlistItem): WishlistItem {
  return {
    ...wish,
    allocatedAmount: wish.allocatedAmount ?? 0,
    autoAllocate: wish.autoAllocate ?? false,
  };
}

/** Builds the intervention summary snapshot stored on a DefenseRecord. */
export function buildInterventionSummary(item: FreezerItem): InterventionSummary {
  const log = item.interventionLog || [];
  const effectiveCount = log.filter(
    (r) => r.type === 'breath' || r.type === 'quiz_pass' || r.type === 'journal'
  ).length;
  return {
    breathCount: log.filter((r) => r.type === 'breath').length,
    rationalMarks: (item.rationalMarks || []).length,
    quizInsisted: item.quizInsisted || 0,
    journalScene: item.journal?.scene,
    flattenedPercent: Math.min(60, effectiveCount * 8),
  };
}

export const StorageService = {
  async getItems(): Promise<FreezerItem[]> {
    try {
      const data = await AsyncStorage.getItem(KEYS.ITEMS);
      if (data) {
        const parsed: FreezerItem[] = JSON.parse(data);
        return parsed.map(migrateItem);
      }
      const seeded = INITIAL_ITEMS.map(migrateItem);
      await AsyncStorage.setItem(KEYS.ITEMS, JSON.stringify(seeded));
      return seeded;
    } catch (e) {
      console.warn('Failed to load items from storage:', e);
      return INITIAL_ITEMS.map(migrateItem);
    }
  },

  async saveItems(items: FreezerItem[]): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.ITEMS, JSON.stringify(items));
    } catch (e) {
      console.warn('Failed to save items to storage:', e);
    }
  },

  async getVaultStats(): Promise<VaultStats> {
    try {
      const data = await AsyncStorage.getItem(KEYS.VAULT);
      if (data) {
        return migrateVaultStats(JSON.parse(data));
      }
      await AsyncStorage.setItem(KEYS.VAULT, JSON.stringify(INITIAL_VAULT_STATS));
      return migrateVaultStats(INITIAL_VAULT_STATS);
    } catch (e) {
      console.warn('Failed to load vault stats:', e);
      return migrateVaultStats(INITIAL_VAULT_STATS);
    }
  },

  async saveVaultStats(stats: VaultStats): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.VAULT, JSON.stringify(stats));
    } catch (e) {
      console.warn('Failed to save vault stats:', e);
    }
  },

  async addWillpowerExp(amount: number, source = 'intervention'): Promise<VaultStats> {
    const current = await this.getVaultStats();
    const newExp = (current.willpowerExp || 0) + amount;
    const newLevel = resolveDefenseLevel(current.defenseLevel, current.totalSaved, current.itemsDefended, newExp);

    const updatedStats: VaultStats = {
      ...current,
      willpowerExp: newExp,
      defenseLevel: newLevel,
    };

    await this.saveVaultStats(updatedStats);
    await RewardsService.appendExpLog(amount, source);
    return updatedStats;
  },

  async getWishlist(): Promise<WishlistItem[]> {
    try {
      const data = await AsyncStorage.getItem(KEYS.WISHLIST);
      if (data) {
        const parsed: WishlistItem[] = JSON.parse(data);
        return parsed.map(migrateWish);
      }
      const seeded = INITIAL_WISHLIST.map(migrateWish);
      await AsyncStorage.setItem(KEYS.WISHLIST, JSON.stringify(seeded));
      return seeded;
    } catch (e) {
      console.warn('Failed to load wishlist:', e);
      return INITIAL_WISHLIST.map(migrateWish);
    }
  },

  async saveWishlist(list: WishlistItem[]): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.WISHLIST, JSON.stringify(list));
    } catch (e) {
      console.warn('Failed to save wishlist:', e);
    }
  },

  async addWishlistItem(item: WishlistItem): Promise<WishlistItem[]> {
    const list = await this.getWishlist();
    const updated = [item, ...list];
    await this.saveWishlist(updated);
    return updated;
  },

  async deleteWishlistItem(id: string): Promise<WishlistItem[]> {
    const list = await this.getWishlist();
    const updated = list.filter((w) => w.id !== id);
    await this.saveWishlist(updated);
    return updated;
  },

  async getDefenseRecords(): Promise<DefenseRecord[]> {
    try {
      const data = await AsyncStorage.getItem(KEYS.RECORDS);
      if (data) {
        return JSON.parse(data);
      }
      return [];
    } catch (e) {
      console.warn('Failed to load defense records:', e);
      return [];
    }
  },

  async addDefenseRecord(record: DefenseRecord): Promise<DefenseRecord[]> {
    try {
      const records = await this.getDefenseRecords();
      const updated = [record, ...records];
      await AsyncStorage.setItem(KEYS.RECORDS, JSON.stringify(updated));
      return updated;
    } catch (e) {
      console.warn('Failed to save defense record:', e);
      return [];
    }
  },

  /**
   * Called when an item is abandoned (resisted purchase):
   * 1. totalSaved += price, availableBalance += price
   * 2. Dynamic EXP: base + rational-mark bonus + full-cooldown + glacier bonus
   * 3. Auto-allocates the saved amount into wishes with autoAllocate enabled
   * 4. Recalculates defense level, checks medal unlocks
   * 5. Records DefenseRecord with intervention summary & expEarned
   */
  async recordAbandonedPurchase(
    item: FreezerItem
  ): Promise<{
    stats: VaultStats;
    newlyUnlocked: string[];
    expBreakdown: ReturnType<typeof calculateAbandonExp>;
    wishlist: WishlistItem[];
    autoAllocatedWishId: string | null;
    isPerfect: boolean;
  }> {
    const current = await this.getVaultStats();
    const expBreakdown = calculateAbandonExp(item);

    // Perfect defense: all tier marks + matured naturally + abandoned
    const isPerfect = isPerfectDefense(item);
    if (isPerfect) {
      expBreakdown.total += PERFECT_DEFENSE_BONUS;
    }

    const newSaved = current.totalSaved + item.price;
    const newDefended = current.itemsDefended + 1;
    const newExp = (current.willpowerExp || 0) + expBreakdown.total;
    await RewardsService.appendExpLog(expBreakdown.total, isPerfect ? 'perfect' : 'abandon', item.id);

    // Auto-allocate into the first autoAllocate-enabled, unredeemed & not-yet-full wish
    // （与 ThawDecisionModal / VictorySettlement 共用 projectAutoAllocation，口径完全一致）
    let wishlist = (await this.getWishlist()).map(migrateWish);
    let availableBalance = current.availableBalance + item.price;
    let allocatedToWishes = current.allocatedToWishes;
    let autoAllocatedWishId: string | null = null;

    const projection = projectAutoAllocation(item.price, wishlist);
    if (projection.wish && projection.toWish > 0) {
      const targetIdx = wishlist.findIndex((w) => w.id === projection.wish!.id);
      if (targetIdx >= 0) {
        const wish = wishlist[targetIdx];
        wishlist[targetIdx] = {
          ...wish,
          allocatedAmount: (wish.allocatedAmount || 0) + projection.toWish,
        };
        availableBalance -= projection.toWish;
        allocatedToWishes += projection.toWish;
        autoAllocatedWishId = wish.id;
        await this.saveWishlist(wishlist);
      }
    }

    const newLevel = resolveDefenseLevel(current.defenseLevel, newSaved, newDefended, newExp);

    // 先落盘战报，再用最新记录重算连胜（连胜基于自然日，与打开 App 的时间无关）
    await this.addDefenseRecord({
      id: 'rec-' + Date.now(),
      itemId: item.id,
      itemName: item.name,
      price: item.price,
      outcome: 'abandoned',
      timestamp: Date.now(),
      freezeDurationHours: item.freezeDurationHours,
      calmBoostCount: item.calmWaitBonus || 0,
      interventionSummary: buildInterventionSummary(item),
      expEarned: expBreakdown.total,
    });
    const currentStreak = computeStreak(await this.getDefenseRecords());

    // Typed medal evaluation (count / saved / streak / perfect)
    const statsSnapshot: VaultStats = {
      ...current,
      totalSaved: newSaved,
      itemsDefended: newDefended,
      willpowerExp: newExp,
      perfectDefenses: current.perfectDefenses + (isPerfect ? 1 : 0),
      currentStreak,
    };
    const newlyUnlocked = RewardsService.evaluateMedals(statsSnapshot, 0);
    const unlocked = new Set([...current.unlockedMedals, ...newlyUnlocked]);

    const updatedStats: VaultStats = {
      ...current,
      totalSaved: newSaved,
      availableBalance,
      allocatedToWishes,
      itemsDefended: newDefended,
      defenseLevel: newLevel,
      willpowerExp: newExp,
      perfectDefenses: statsSnapshot.perfectDefenses,
      currentStreak,
      unlockedMedals: Array.from(unlocked),
    };
    await this.saveVaultStats(updatedStats);

    return { stats: updatedStats, newlyUnlocked, expBreakdown, wishlist, autoAllocatedWishId, isPerfect };
  },

  /**
   * Called when an item is purchased after the cooling period:
   * EXP = base 20 - impulse-residue penalty (quizInsisted × 5), min 5.
   * Also tracks monthly purchase counters (auto-reset on month rollover) and
   * clears the streak immediately (购买行为会清零连胜).
   */
  async recordConfirmedPurchase(item: FreezerItem): Promise<{ stats: VaultStats; expEarned: number }> {
    const current = await this.getVaultStats(); // migrateVaultStats handles month rollover
    const expEarned = calculatePurchaseExp(item);
    const newExp = (current.willpowerExp || 0) + expEarned;

    // 先落盘战报，再用最新记录重算连胜（购买当天即清零）
    await this.addDefenseRecord({
      id: 'rec-' + Date.now(),
      itemId: item.id,
      itemName: item.name,
      price: item.price,
      outcome: 'purchased',
      timestamp: Date.now(),
      freezeDurationHours: item.freezeDurationHours,
      calmBoostCount: item.calmWaitBonus || 0,
      interventionSummary: buildInterventionSummary(item),
      expEarned,
    });
    const currentStreak = computeStreak(await this.getDefenseRecords());

    const updatedStats: VaultStats = {
      ...current,
      willpowerExp: newExp,
      defenseLevel: resolveDefenseLevel(current.defenseLevel, current.totalSaved, current.itemsDefended, newExp),
      monthlyPurchasedCount: current.monthlyPurchasedCount + 1,
      monthlyPurchasedAmount: current.monthlyPurchasedAmount + item.price,
      currentStreak,
    };
    await this.saveVaultStats(updatedStats);
    await RewardsService.appendExpLog(expEarned, 'purchase', item.id);

    return { stats: updatedStats, expEarned };
  },

  // ---- 心愿金库余额调配 ----

  /** Moves amount from availableBalance into a wish (clamped to need & balance). */
  async allocateToWish(
    wishId: string,
    amount: number
  ): Promise<{ stats: VaultStats; wishlist: WishlistItem[]; allocated: number }> {
    const stats = await this.getVaultStats();
    const wishlist = (await this.getWishlist()).map(migrateWish);
    const idx = wishlist.findIndex((w) => w.id === wishId);
    if (idx < 0) return { stats, wishlist, allocated: 0 };

    const wish = wishlist[idx];
    const need = Math.max(0, wish.cost - (wish.allocatedAmount || 0));
    const allocated = Math.max(0, Math.min(amount, need, stats.availableBalance));
    if (allocated > 0) {
      wishlist[idx] = { ...wish, allocatedAmount: (wish.allocatedAmount || 0) + allocated };
      const updatedStats: VaultStats = {
        ...stats,
        availableBalance: stats.availableBalance - allocated,
        allocatedToWishes: stats.allocatedToWishes + allocated,
      };
      await this.saveWishlist(wishlist);
      await this.saveVaultStats(updatedStats);
      return { stats: updatedStats, wishlist, allocated };
    }
    return { stats, wishlist, allocated: 0 };
  },

  /** Moves amount back from a wish into availableBalance. */
  async withdrawFromWish(
    wishId: string,
    amount: number
  ): Promise<{ stats: VaultStats; wishlist: WishlistItem[]; withdrawn: number }> {
    const stats = await this.getVaultStats();
    const wishlist = (await this.getWishlist()).map(migrateWish);
    const idx = wishlist.findIndex((w) => w.id === wishId);
    if (idx < 0) return { stats, wishlist, withdrawn: 0 };

    const wish = wishlist[idx];
    const withdrawn = Math.max(0, Math.min(amount, wish.allocatedAmount || 0));
    if (withdrawn > 0) {
      wishlist[idx] = { ...wish, allocatedAmount: (wish.allocatedAmount || 0) - withdrawn };
      const updatedStats: VaultStats = {
        ...stats,
        availableBalance: stats.availableBalance + withdrawn,
        allocatedToWishes: Math.max(0, stats.allocatedToWishes - withdrawn),
      };
      await this.saveWishlist(wishlist);
      await this.saveVaultStats(updatedStats);
      return { stats: updatedStats, wishlist, withdrawn };
    }
    return { stats, wishlist, withdrawn: 0 };
  },

  /** Toggles auto-allocate flag on a wish. */
  async setWishAutoAllocate(wishId: string, autoAllocate: boolean): Promise<WishlistItem[]> {
    const wishlist = (await this.getWishlist()).map(migrateWish);
    const updated = wishlist.map((w) => (w.id === wishId ? { ...w, autoAllocate } : w));
    await this.saveWishlist(updated);
    return updated;
  },

  /**
   * Redeems a fully-charged wish: deducts the allocated funds, marks redeemed,
   * awards +50 EXP. Returns null if the wish is not fully charged.
   */
  async redeemWish(
    wishId: string
  ): Promise<{ stats: VaultStats; wishlist: WishlistItem[]; newlyUnlocked: string[] } | null> {
    const stats = await this.getVaultStats();
    const wishlist = (await this.getWishlist()).map(migrateWish);
    const idx = wishlist.findIndex((w) => w.id === wishId);
    if (idx < 0) return null;

    const wish = wishlist[idx];
    if ((wish.allocatedAmount || 0) < wish.cost || wish.redeemed) return null;

    wishlist[idx] = { ...wish, redeemed: true, allocatedAmount: 0 };
    const newExp = (stats.willpowerExp || 0) + 50;
    const updatedStats: VaultStats = {
      ...stats,
      allocatedToWishes: Math.max(0, stats.allocatedToWishes - wish.cost),
      willpowerExp: newExp,
      defenseLevel: resolveDefenseLevel(stats.defenseLevel, stats.totalSaved, stats.itemsDefended, newExp),
    };
    await this.saveWishlist(wishlist);
    await this.saveVaultStats(updatedStats);
    await RewardsService.appendExpLog(50, 'wish_redeem', wish.id);

    // 心愿达成类（special）奖章评估：以已兑换心愿数为依据
    const redeemedWishCount = wishlist.filter((w) => w.redeemed).length;
    const newlyUnlocked = RewardsService.evaluateMedals(updatedStats, redeemedWishCount);
    if (newlyUnlocked.length > 0) {
      const merged: VaultStats = {
        ...updatedStats,
        unlockedMedals: Array.from(new Set([...updatedStats.unlockedMedals, ...newlyUnlocked])),
      };
      await this.saveVaultStats(merged);
      return { stats: merged, wishlist, newlyUnlocked };
    }
    return { stats: updatedStats, wishlist, newlyUnlocked: [] };
  },

  /**
   * 购买非情景特权（EXP 商店）。成功返回更新后的 stats，失败返回 null。
   * - medal_frame_gold: 一次性解锁
   * - early_thaw / extra_refreeze: 情景特权由 App 层直接花 EXP 触发，不走此方法
   * - exp_to_balance: 兑换入口，不是"拥有型"特权，禁止走购买路径（否则会永久变成"已拥有"）
   */
  async purchasePerk(perkId: string): Promise<VaultStats | null> {
    const perk = EXP_PERKS.find((p) => p.id === perkId);
    if (!perk || perk.contextual) return null;
    if (perkId === EXCHANGE_PERK_ID) return null; // 兑换类走 expToBalance

    const current = await this.getVaultStats();
    if (current.ownedPerks.includes(perkId)) return null; // 已拥有
    if ((current.willpowerExp || 0) < perk.cost) return null; // EXP 不足

    const newExp = current.willpowerExp - perk.cost;
    const updated: VaultStats = {
      ...current,
      willpowerExp: newExp,
      ownedPerks: [...current.ownedPerks, perkId],
      defenseLevel: resolveDefenseLevel(current.defenseLevel, current.totalSaved, current.itemsDefended, newExp),
    };
    await this.saveVaultStats(updated);
    await RewardsService.appendExpLog(-perk.cost, 'perk_' + perkId);
    return updated;
  },

  /**
   * EXP 兑换心愿金：1 EXP = ¥1，每月上限 500 EXP。
   * 按设计文档「折算充入心愿」：优先充进指定心愿（wishId），未指定时充进
   * 当前进度最高的未兑换心愿；心愿已满 / 无心愿可充的部分转入可用余额。
   */
  async expToBalance(amount: number, wishId?: string): Promise<ExpExchangeResult | null> {
    if (amount <= 0) return null;
    const current = await this.getVaultStats();
    const monthlyUsed = await RewardsService.getMonthlyExpConverted();
    const cap = EXP_PERK_COST.exp_to_balance_monthly_cap;
    const remaining = Math.max(0, cap - monthlyUsed);
    const convertible = Math.floor(Math.min(amount, remaining, current.willpowerExp || 0));
    if (convertible <= 0) return null;

    // 选目标心愿：显式指定 → 进度最高（比例）的未兑换且未充满心愿
    let wishlist = (await this.getWishlist()).map(migrateWish);
    const candidates = wishlist.filter(
      (w) => !w.redeemed && (w.allocatedAmount || 0) < w.cost
    );
    let target = wishId ? wishlist.find((w) => w.id === wishId && !w.redeemed) : undefined;
    if (target && (target.allocatedAmount || 0) >= target.cost) target = undefined;
    if (!target && candidates.length > 0) {
      target = candidates.reduce((best, w) =>
        (w.allocatedAmount || 0) / Math.max(1, w.cost) > (best.allocatedAmount || 0) / Math.max(1, best.cost)
          ? w
          : best
      );
    }

    let toWish = 0;
    let toBalance = convertible;
    let allocatedToWishes = current.allocatedToWishes;
    if (target) {
      const need = Math.max(0, target.cost - (target.allocatedAmount || 0));
      toWish = Math.min(need, convertible);
      toBalance = convertible - toWish;
      if (toWish > 0) {
        const idx = wishlist.findIndex((w) => w.id === target!.id);
        wishlist[idx] = { ...wishlist[idx], allocatedAmount: (wishlist[idx].allocatedAmount || 0) + toWish };
        allocatedToWishes += toWish;
        await this.saveWishlist(wishlist);
      }
    }

    const newExp = (current.willpowerExp || 0) - convertible;
    const updated: VaultStats = {
      ...current,
      willpowerExp: newExp,
      availableBalance: current.availableBalance + toBalance,
      allocatedToWishes,
      defenseLevel: resolveDefenseLevel(current.defenseLevel, current.totalSaved, current.itemsDefended, newExp),
    };
    await this.saveVaultStats(updated);
    await RewardsService.appendExpLog(-convertible, 'exp_to_balance');
    // 累加独立月度计数器（EXP 流水会被裁剪到 200 条，不能作为上限依据）；
    // 传入兑换前的累计值，避免与刚写入的流水重复计算
    await RewardsService.recordExpConversion(convertible, monthlyUsed);
    return {
      stats: updated,
      wishlist,
      converted: convertible,
      toWish,
      toBalance,
      wishTitle: target && toWish > 0 ? target.title : null,
    };
  },

  /**
   * 情景特权扣 EXP（提前解冻 / 再冻一次 +）：不记录所有权，直接扣减。
   * 段位门槛见 constants/rewards.ts 的 PERK_MIN_LEVEL（提前解冻 Lv.5 / 再冻一次+ Lv.7）。
   * 返回结构化结果，便于 UI 区分「段位不够」与「EXP 不足」。
   */
  async spendExpForContextualPerk(
    perkId: 'early_thaw' | 'extra_refreeze'
  ): Promise<SpendContextualPerkResult> {
    const cost = EXP_PERK_COST[perkId];
    const current = await this.getVaultStats();
    const requiredLevel = perkMinLevel(perkId);
    if (current.defenseLevel < requiredLevel) {
      return {
        ok: false,
        reason: 'level',
        requiredLevel,
        currentLevel: current.defenseLevel,
      };
    }
    if ((current.willpowerExp || 0) < cost) {
      return { ok: false, reason: 'exp', cost };
    }

    const newExp = current.willpowerExp - cost;
    const updated: VaultStats = {
      ...current,
      willpowerExp: newExp,
      defenseLevel: resolveDefenseLevel(current.defenseLevel, current.totalSaved, current.itemsDefended, newExp),
    };
    await this.saveVaultStats(updated);
    await RewardsService.appendExpLog(-cost, 'perk_' + perkId);
    return { ok: true, stats: updated };
  },

  async resetAll(): Promise<void> {
    await AsyncStorage.removeItem(KEYS.ITEMS);
    await AsyncStorage.removeItem(KEYS.VAULT);
    await AsyncStorage.removeItem(KEYS.WISHLIST);
    await AsyncStorage.removeItem(KEYS.RECORDS);
    await RewardsService.clearExpLog();
  },
};
