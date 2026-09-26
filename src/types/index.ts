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

  // ---- 决策模块新增 ----
  refreezeCount?: number; // 已再冻次数（上限见 constants/decision.ts）
  purchasedFeedback?: 'often' | 'sometimes' | 'dusty' | 'sold'; // 购后使用反馈
  feedbackReminderId?: string; // 30 天使用反馈通知 id

  // ---- 奖励模块新增 ----
  earlyThawedAt?: number; // 已花 EXP 提前解冻的时间戳（每件商品限 1 次，避免重复扣费）
}

export interface InterventionSummary {
  breathCount: number;
  rationalMarks: number;
  quizInsisted: number;
  journalScene?: string;
  flattenedPercent: number; // 干预压平率（%）
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
  // ---- 决策模块新增 ----
  interventionSummary?: InterventionSummary;
  expEarned?: number;
}

export interface VaultStats {
  totalSaved: number; // 历史累计节省（只增不减，用于等级/奖章）
  availableBalance: number; // 可用余额（心愿充能/兑换时扣减）
  allocatedToWishes: number; // 已分配给心愿的总额
  itemsDefended: number; // starts at 0
  defenseLevel: number; // 1-12
  willpowerExp: number; // total EXP earned from calm boost & defending
  unlockedMedals: string[]; // medal IDs
  // ---- 决策模块新增 ----
  monthlyPurchasedCount: number; // 本月已确认购买件数
  monthlyPurchasedAmount: number; // 本月已确认购买金额
  purchaseMonth: string; // 'YYYY-MM'，跨月自动清零上面两项
  // ---- 奖励模块新增 ----
  currentStreak: number; // 连续无购买天数
  perfectDefenses: number; // 完美克制次数
  ownedPerks: string[]; // 已拥有的特权（如 'medal_frame_gold'）
  lastDailyRewardDate: string; // 'YYYY-MM-DD'，连胜每日奖励去重
}

export interface WishlistItem {
  id: string;
  title: string;
  cost: number;
  costLabel: string;
  iconType: 'grid' | 'headphone' | 'coffee' | 'flight' | 'game' | 'book';
  redeemed: boolean;
  createdAt: number;
  // ---- 决策模块新增 ----
  allocatedAmount?: number; // 已充入该心愿的金额（真实充能进度）
  autoAllocate?: boolean;   // 放弃购买时是否自动充入
}

export interface AchievementMedal {
  id: string;
  name: string;
  description: string;
  iconKey: string;
  type: 'count' | 'saved' | 'streak' | 'perfect' | 'special';
  requiredDefended?: number; // type='count'
  requiredSaved?: number;    // type='saved'
  requiredStreak?: number;   // type='streak' 连续无购买天数
  requiredPerfect?: number;  // type='perfect' 完美克制次数
  requiredWishes?: number;   // type='special' 心愿兑换数
}

/** EXP 流水：所有 EXP 变动的账本 */
export interface ExpTransaction {
  id: string;
  amount: number;   // 正为产出，负为消耗
  source: string;   // 'breath' | 'abandon' | 'purchase' | 'journal' | 'streak' | 'wish_redeem' | 'perfect' | 'early_thaw' | 'extra_refreeze' | 'exp_to_balance' | 'perk' | ...
  itemId?: string;
  timestamp: number;
}
