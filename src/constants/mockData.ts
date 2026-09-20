import { FreezerItem, VaultStats, WishlistItem, AchievementMedal } from '../types';
import { ASSETS } from './assets';

export const INITIAL_VAULT_STATS: VaultStats = {
  totalSaved: 0, // Explicitly 0 as requested by user
  itemsDefended: 0, // Starts at 0
  defenseLevel: 1, // Base level 1
  willpowerExp: 0, // Base exp 0
  unlockedMedals: [], // Unlocked upon saving
};

export const DEFENSE_RANKS = [
  { level: 1, name: '萌新守门员', title: 'Impulse Novice', minExp: 0, minSaved: 0, desc: '初入理智冷冻舱，开启对抗多巴胺第一步' },
  { level: 2, name: '降温学徒', title: 'Cooling Apprentice', minExp: 50, minSaved: 500, desc: '开始理解延迟满足的力量，掌握冰封呼吸' },
  { level: 3, name: '冰霜卫士', title: 'Frost Guardian', minExp: 150, minSaved: 1500, desc: '多次成功阻断冲动，构建坚固心理防线' },
  { level: 4, name: '钢铁意志', title: 'Iron Willpower', minExp: 350, minSaved: 3500, desc: '面对大额诱惑心如止水，理智掌控钱包' },
  { level: 5, name: '理性大师', title: 'Rational Master', minExp: 700, minSaved: 8000, desc: '心愿金库充盈，彻底远离盲目剁手与伪需求' },
  { level: 6, name: '欲望征服者', title: 'Desire Conqueror', minExp: 1200, minSaved: 15000, desc: '消费自由与精神自由的终极强者' },
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
  {
    id: 'medal_bronze_shield',
    name: '青铜盾甲',
    description: '首次成功抵御冲动消费',
    iconKey: 'medalBronzeShield',
    requiredDefended: 1,
    requiredSaved: 100,
  },
  {
    id: 'medal_gold_shield',
    name: '黄金屏障',
    description: '成功抵御 3 次非理性剁手',
    iconKey: 'medalGoldShield',
    requiredDefended: 3,
    requiredSaved: 1000,
  },
  {
    id: 'medal_cyan_energy',
    name: '理性超能',
    description: '累计省下超过 ¥2,000 资金',
    iconKey: 'medalCyanEnergy',
    requiredDefended: 5,
    requiredSaved: 2000,
  },
  {
    id: 'medal_gold_coin',
    name: '金库富翁',
    description: '战利品金库突破 ¥5,000 大关',
    iconKey: 'medalGoldCoin',
    requiredDefended: 8,
    requiredSaved: 5000,
  },
  {
    id: 'medal_ribbon_bronze',
    name: '耐心铜勋',
    description: '成功完成一次完整 48 小时冷静期',
    iconKey: 'medalRibbonBronze',
    requiredDefended: 2,
    requiredSaved: 500,
  },
  {
    id: 'medal_ribbon_silver',
    name: '定力银勋',
    description: '成功完成一次 72 小时超强冷静期',
    iconKey: 'medalRibbonSilver',
    requiredDefended: 6,
    requiredSaved: 3000,
  },
  {
    id: 'medal_ribbon_gold',
    name: '欲望征服者',
    description: '累计抵御 10 件以上冲动商品',
    iconKey: 'medalRibbonGold',
    requiredDefended: 10,
    requiredSaved: 8000,
  },
];
