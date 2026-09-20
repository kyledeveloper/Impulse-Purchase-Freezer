export type ItemStatus = 'freezing' | 'thawed_abandoned' | 'thawed_purchased';

export type ImpulseTier = 'snack' | 'standard' | 'glacier';

export interface InterventionRecord {
  type: 'breath' | 'quiz_pass' | 'journal' | 'substitution' | 'tap_session';
  timestamp: number;
  detail?: string;
}

export interface ImpulseJournal {
  scene: string;
  mood: string;
  note?: string;
  createdAt: number;
}

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
  breakTapsRemaining: number; // starts at tier.maxTaps
  calmWaitBonus: number; // count of times user performed chill boost / calm interactions
  answeredQuizLevels?: number[]; // checkpoints e.g. [25, 50, 75, 100]

  // ---- 干预模块新增 ----
  tier?: ImpulseTier; // 档位（缺省按 price 推断，便于旧数据迁移）
  tapsToday?: number; // 今日已敲次数
  chillToday?: number; // 今日已完成呼吸次数
  lastResetDate?: string; // 'YYYY-MM-DD'，跨天重置 tapsToday/chillToday
  rationalMarks?: number[]; // 已通过的拷问关卡（印记）
  quizInsisted?: number; // 拷问中选择"坚持破冰"的次数
  futureSelfNote?: string; // 未来自我留言（冰川级）
  journal?: ImpulseJournal; // 冲动日记（每件商品限一次）
  interventionLog?: InterventionRecord[]; // 干预流水
  notificationIds?: string[]; // 已调度的通知 id，便于取消
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
