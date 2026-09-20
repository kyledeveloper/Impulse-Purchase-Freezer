export type ItemStatus = 'freezing' | 'thawed_abandoned' | 'thawed_purchased';

export interface FreezerItem {
  id: string;
  name: string;
  price: number;
  category: string;
  image: any; // local require or { uri: string }
  rawCutout?: any; // raw transparent product cutout before ice embedding
  originalUrl?: string;
  freezeDurationHours: number; // e.g. 48, 72, or 0.0028 (10s)
  frozenAt: number; // timestamp ms
  thawAt: number; // timestamp ms
  status: ItemStatus;
  breakTapsRemaining: number; // starts at 100
  calmWaitBonus: number; // count of times user performed chill boost / calm interactions
  answeredQuizLevels?: number[]; // checkpoints e.g. [25, 50, 75, 100]
}

export interface DefenseRecord {
  id: string;
  itemId: string;
  itemName: string;
  price: number;
  outcome: 'abandoned' | 'purchased';
  timestamp: number;
  freezeDurationHours: number;
  calmBoostCount: number;
}

export interface VaultStats {
  totalSaved: number; // starts at 0
  itemsDefended: number; // starts at 0
  defenseLevel: number; // starts at 1
  willpowerExp: number; // total EXP earned from calm boost & defending
  unlockedMedals: string[]; // medal IDs
}

export interface WishlistItem {
  id: string;
  title: string;
  cost: number;
  costLabel: string;
  iconType: 'grid' | 'headphone' | 'coffee' | 'flight' | 'game' | 'book';
  redeemed: boolean;
  createdAt: number;
}

export interface AchievementMedal {
  id: string;
  name: string;
  description: string;
  iconKey: string;
  requiredDefended: number;
  requiredSaved: number;
}
