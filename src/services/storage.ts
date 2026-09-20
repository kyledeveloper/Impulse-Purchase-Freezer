import AsyncStorage from '@react-native-async-storage/async-storage';
import { FreezerItem, VaultStats, WishlistItem, DefenseRecord } from '../types';
import { INITIAL_ITEMS, INITIAL_VAULT_STATS, INITIAL_WISHLIST, MEDAL_LIST, DEFENSE_RANKS } from '../constants/mockData';
import { getImpulseTier, todayStr } from '../constants/intervention';

const KEYS = {
  ITEMS: '@ipf_items_v1',
  VAULT: '@ipf_vault_stats_v1',
  WISHLIST: '@ipf_wishlist_v1',
  RECORDS: '@ipf_records_v1',
};

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

function calculateDefenseLevel(saved: number, defended: number, exp: number): number {
  let level = 1;
  for (const rank of DEFENSE_RANKS) {
    if (exp >= rank.minExp || saved >= rank.minSaved) {
      level = rank.level;
    }
  }
  return level;
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
        const parsed = JSON.parse(data);
        return {
          totalSaved: parsed.totalSaved ?? 0,
          itemsDefended: parsed.itemsDefended ?? 0,
          defenseLevel: parsed.defenseLevel ?? 1,
          willpowerExp: parsed.willpowerExp ?? 0,
          unlockedMedals: parsed.unlockedMedals ?? [],
        };
      }
      await AsyncStorage.setItem(KEYS.VAULT, JSON.stringify(INITIAL_VAULT_STATS));
      return INITIAL_VAULT_STATS;
    } catch (e) {
      console.warn('Failed to load vault stats:', e);
      return INITIAL_VAULT_STATS;
    }
  },

  async saveVaultStats(stats: VaultStats): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.VAULT, JSON.stringify(stats));
    } catch (e) {
      console.warn('Failed to save vault stats:', e);
    }
  },

  async addWillpowerExp(amount: number): Promise<VaultStats> {
    const current = await this.getVaultStats();
    const newExp = (current.willpowerExp || 0) + amount;
    const newLevel = calculateDefenseLevel(current.totalSaved, current.itemsDefended, newExp);

    const updatedStats: VaultStats = {
      ...current,
      willpowerExp: newExp,
      defenseLevel: newLevel,
    };

    await this.saveVaultStats(updatedStats);
    return updatedStats;
  },

  async getWishlist(): Promise<WishlistItem[]> {
    try {
      const data = await AsyncStorage.getItem(KEYS.WISHLIST);
      if (data) {
        return JSON.parse(data);
      }
      await AsyncStorage.setItem(KEYS.WISHLIST, JSON.stringify(INITIAL_WISHLIST));
      return INITIAL_WISHLIST;
    } catch (e) {
      console.warn('Failed to load wishlist:', e);
      return INITIAL_WISHLIST;
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
   * Helper called when an item is abandoned (resisted purchase):
   * 1. Increases totalSaved by item.price
   * 2. Increases itemsDefended by 1
   * 3. Increases willpowerExp by +80
   * 4. Recalculates defense level
   * 5. Checks and unlocks any newly earned medals
   * 6. Records to Defense Log
   */
  async recordAbandonedPurchase(item: FreezerItem): Promise<{ stats: VaultStats; newlyUnlocked: string[] }> {
    const current = await this.getVaultStats();
    const newSaved = current.totalSaved + item.price;
    const newDefended = current.itemsDefended + 1;
    const newExp = (current.willpowerExp || 0) + 80;
    const newLevel = calculateDefenseLevel(newSaved, newDefended, newExp);

    // Check newly unlocked medals
    const unlocked = new Set(current.unlockedMedals);
    const newlyUnlocked: string[] = [];

    for (const medal of MEDAL_LIST) {
      if (!unlocked.has(medal.id)) {
        if (newDefended >= medal.requiredDefended || newSaved >= medal.requiredSaved) {
          unlocked.add(medal.id);
          newlyUnlocked.push(medal.id);
        }
      }
    }

    const updatedStats: VaultStats = {
      totalSaved: newSaved,
      itemsDefended: newDefended,
      defenseLevel: newLevel,
      willpowerExp: newExp,
      unlockedMedals: Array.from(unlocked),
    };

    await this.saveVaultStats(updatedStats);

    // Save record to log
    await this.addDefenseRecord({
      id: 'rec-' + Date.now(),
      itemId: item.id,
      itemName: item.name,
      price: item.price,
      outcome: 'abandoned',
      timestamp: Date.now(),
      freezeDurationHours: item.freezeDurationHours,
      calmBoostCount: item.calmWaitBonus || 0,
    });

    return { stats: updatedStats, newlyUnlocked };
  },

  async recordConfirmedPurchase(item: FreezerItem): Promise<{ stats: VaultStats }> {
    const current = await this.getVaultStats();
    // Award +20 EXP for surviving full delay period even if purchased
    const newExp = (current.willpowerExp || 0) + 20;
    const newLevel = calculateDefenseLevel(current.totalSaved, current.itemsDefended, newExp);

    const updatedStats: VaultStats = {
      ...current,
      willpowerExp: newExp,
      defenseLevel: newLevel,
    };
    await this.saveVaultStats(updatedStats);

    await this.addDefenseRecord({
      id: 'rec-' + Date.now(),
      itemId: item.id,
      itemName: item.name,
      price: item.price,
      outcome: 'purchased',
      timestamp: Date.now(),
      freezeDurationHours: item.freezeDurationHours,
      calmBoostCount: item.calmWaitBonus || 0,
    });

    return { stats: updatedStats };
  },

  async resetAll(): Promise<void> {
    await AsyncStorage.removeItem(KEYS.ITEMS);
    await AsyncStorage.removeItem(KEYS.VAULT);
    await AsyncStorage.removeItem(KEYS.WISHLIST);
    await AsyncStorage.removeItem(KEYS.RECORDS);
  },
};
