import { FreezerItem, VaultStats, WishlistItem, AchievementMedal } from '../types';
import { ASSETS } from './assets';

export const INITIAL_VAULT_STATS: VaultStats = {
  totalSaved: 0, // Explicitly 0 as requested by user
  availableBalance: 0, // 可用余额
  allocatedToWishes: 0, // 已分配给心愿的总额
  itemsDefended: 0, // Starts at 0
  defenseLevel: 1, // Base level 1
  willpowerExp: 0, // Base exp 0
  unlockedMedals: [], // Unlocked upon saving
  monthlyPurchasedCount: 0, // 本月已确认购买件数
  monthlyPurchasedAmount: 0, // 本月已确认购买金额
  purchaseMonth: '', // 由 migrateVaultStats 填充为当前月份
  currentStreak: 0,
  perfectDefenses: 0,
  ownedPerks: [],
  lastDailyRewardDate: '',
};

export const DEFENSE_RANKS = [
  { level: 1, name: '萌新守门员', title: 'Impulse Novice', minExp: 0, minSaved: 0, desc: '初入理智冷冻舱，开启对抗多巴胺第一步' },
  { level: 2, name: '降温学徒', title: 'Cooling Apprentice', minExp: 100, minSaved: 500, desc: '开始理解延迟满足的力量，掌握冰封呼吸' },
  { level: 3, name: '冰霜卫士', title: 'Frost Guardian', minExp: 300, minSaved: 1500, desc: '多次成功阻断冲动，构建坚固心理防线' },
  { level: 4, name: '钢铁意志', title: 'Iron Willpower', minExp: 700, minSaved: 3500, desc: '面对大额诱惑心如止水，理智掌控钱包' },
  { level: 5, name: '理性大师', title: 'Rational Master', minExp: 1200, minSaved: 8000, desc: '心愿金库充盈，解锁提前解冻特权' },
  { level: 6, name: '欲望征服者', title: 'Desire Conqueror', minExp: 2000, minSaved: 15000, desc: '消费自由与精神自由的终极强者' },
  { level: 7, name: '冰封领主', title: 'Frost Lord', minExp: 3000, minSaved: 25000, desc: '解锁"再冻一次 +"特权，冰川听你号令' },
  { level: 8, name: '冷静先知', title: 'Serenity Prophet', minExp: 4500, minSaved: 40000, desc: '看透每一次多巴胺陷阱的先知' },
  { level: 9, name: '心智主宰', title: 'Mind Master', minExp: 6500, minSaved: 60000, desc: '意志如钢，欲望不过掌中之物' },
  { level: 10, name: '财务自由者', title: 'Financially Free', minExp: 9000, minSaved: 100000, desc: '省下的钱足以改变生活轨迹' },
  { level: 11, name: '欲望驯兽师', title: 'Desire Tamer', minExp: 12000, minSaved: 150000, desc: '驯服每一头冲动野兽的驯兽师' },
  { level: 12, name: '生活炼金术士', title: 'Life Alchemist', minExp: 16000, minSaved: 250000, desc: '把每一次克制炼成真正想要的人生' },
];

export const INITIAL_ITEMS: FreezerItem[] = [
  {
    id: 'item-phone-1',
    name: '最新款旗舰曲面屏手机',
    price: 5999,
    category: '数码潮电',
    image: ASSETS.phoneClean,
    rawCutout: ASSETS.phoneClean,
    originalUrl: 'https://item.jd.com/100012345.html',
    freezeDurationHours: 48,
    frozenAt: Date.now() - 47.9 * 3600 * 1000, // 5 min 41 sec left! Matches 00:05:41
    thawAt: Date.now() + 341 * 1000,
    status: 'freezing',
    breakTapsRemaining: 100,
    calmWaitBonus: 0,
    answeredQuizLevels: [],
  },
  {
    id: 'item-headphone-2',
    name: '无线降噪头戴耳机 Pro',
    price: 1899,
    category: '影音数码',
    image: ASSETS.eggCarton,
    rawCutout: ASSETS.btnItemHeadphone,
    originalUrl: 'https://item.jd.com/100067890.html',
    freezeDurationHours: 72,
    frozenAt: Date.now() - 24 * 3600 * 1000,
    thawAt: Date.now() + 48 * 3600 * 1000,
    status: 'freezing',
    breakTapsRemaining: 100,
    calmWaitBonus: 0,
    answeredQuizLevels: [],
  },
  {
    id: 'item-drone-3',
    name: '4K航拍轻量折叠无人机',
    price: 3499,
    category: '户外数码',
    image: ASSETS.groceries,
    rawCutout: ASSETS.groceries,
    originalUrl: 'https://item.jd.com/100099999.html',
    freezeDurationHours: 48,
    frozenAt: Date.now() - 12 * 3600 * 1000,
    thawAt: Date.now() + 36 * 3600 * 1000,
    status: 'freezing',
    breakTapsRemaining: 100,
    calmWaitBonus: 0,
    answeredQuizLevels: [],
  },
  {
    id: 'item-coffee-4',
    name: '复古复刻半自动意式咖啡机',
    price: 1280,
    category: '品质家电',
    image: ASSETS.icePhone,
    rawCutout: ASSETS.btnItemCoffee,
    originalUrl: 'https://item.jd.com/100055555.html',
    freezeDurationHours: 72,
    frozenAt: Date.now() - 2 * 3600 * 1000,
    thawAt: Date.now() + 70 * 3600 * 1000,
    status: 'freezing',
    breakTapsRemaining: 100,
    calmWaitBonus: 0,
    answeredQuizLevels: [],
  },
];

export const INITIAL_WISHLIST: WishlistItem[] = [
  {
    id: 'wish-trip',
    title: '文艺海岛治愈系旅行基金',
    cost: 12000,
    costLabel: '目标 ¥12,000',
    iconType: 'flight',
    redeemed: false,
    createdAt: Date.now() - 7 * 86400000,
  },
  {
    id: 'wish-headphone',
    title: '次时代次世代游戏主机 Switch 2',
    cost: 2800,
    costLabel: '目标 ¥2,800',
    iconType: 'game',
    redeemed: false,
    createdAt: Date.now() - 5 * 86400000,
  },
  {
    id: 'wish-coffee',
    title: '专业商用级旋转泵咖啡机',
    cost: 6500,
    costLabel: '目标 ¥6,500',
    iconType: 'coffee',
    redeemed: false,
    createdAt: Date.now() - 3 * 86400000,
  },
];

export const MEDAL_LIST: AchievementMedal[] = [
  // ---- 防御次数 ----
  { id: 'medal_bronze_shield', name: '青铜盾甲', description: '首次成功抵御冲动消费', iconKey: 'medalBronzeShield', type: 'count', requiredDefended: 1 },
  { id: 'medal_gold_shield', name: '黄金屏障', description: '成功抵御 3 次非理性剁手', iconKey: 'medalGoldShield', type: 'count', requiredDefended: 3 },
  { id: 'medal_diamond_heart', name: '钻石心盾', description: '成功抵御 10 次冲动消费', iconKey: 'medalCyanEnergy', type: 'count', requiredDefended: 10 },
  // ---- 累计节省 ----
  { id: 'medal_ribbon_bronze', name: '耐心铜勋', description: '累计省下 ¥500', iconKey: 'medalRibbonBronze', type: 'saved', requiredSaved: 500 },
  { id: 'medal_ribbon_silver', name: '定力银勋', description: '累计省下 ¥3,000', iconKey: 'medalRibbonSilver', type: 'saved', requiredSaved: 3000 },
  { id: 'medal_gold_coin', name: '金库富翁', description: '累计省下 ¥10,000', iconKey: 'medalGoldCoin', type: 'saved', requiredSaved: 10000 },
  // ---- 连续克制 ----
  { id: 'medal_streak_3', name: '三日清心', description: '连续 3 天无任何确认购买', iconKey: 'medalCyanEnergy', type: 'streak', requiredStreak: 3 },
  { id: 'medal_streak_7', name: '七日禅', description: '连续 7 天无任何确认购买', iconKey: 'medalGoldShield', type: 'streak', requiredStreak: 7 },
  { id: 'medal_streak_30', name: '月度圣人', description: '连续 30 天无任何确认购买', iconKey: 'medalRibbonGold', type: 'streak', requiredStreak: 30 },
  // ---- 完美克制 ----
  { id: 'medal_perfect_1', name: '完美克制 · 铜', description: '达成 1 次完美克制（集齐印记 + 完整冷静 + 放弃）', iconKey: 'medalRibbonBronze', type: 'perfect', requiredPerfect: 1 },
  { id: 'medal_perfect_3', name: '完美克制 · 银', description: '达成 3 次完美克制', iconKey: 'medalRibbonSilver', type: 'perfect', requiredPerfect: 3 },
  { id: 'medal_perfect_10', name: '完美克制 · 金', description: '达成 10 次完美克制', iconKey: 'medalRibbonGold', type: 'perfect', requiredPerfect: 10 },
  // ---- 心愿达成 ----
  { id: 'medal_wish_1', name: '心愿实现家', description: '首次兑换梦想心愿', iconKey: 'medalGoldCoin', type: 'special', requiredWishes: 1 },
  { id: 'medal_wish_3', name: '理性生活家', description: '累计兑换 3 个心愿', iconKey: 'medalGoldShield', type: 'special', requiredWishes: 3 },
];
