// 干预模块配置：档位、呼吸、通知文案、替代换算表
import { ImpulseTier } from '../types';

export interface TierConfig {
  tier: ImpulseTier;
  label: string;
  emoji: string;
  maxTaps: number;            // 破冰总次数
  dailyTapLimit: number;      // 每日有效敲击上限（超出后进入疲劳）
  dailyBreathLimit: number;   // 每日深呼吸上限
  quizLevels: number[];       // 拷问关卡
  hasFutureSelf: boolean;     // 是否有"未来自我"终极拷问
  notifyFractions: number[];  // 通知节点（进度百分比）
  notifyOneHourBefore: boolean;
}

export function getImpulseTier(price: number): TierConfig {
  if (price < 300) {
    return {
      tier: 'snack',
      label: '小雪糕',
      emoji: '🧊',
      maxTaps: 30,
      dailyTapLimit: 15,
      dailyBreathLimit: 3,
      quizLevels: [25, 75],
      hasFutureSelf: false,
      notifyFractions: [0.5],
      notifyOneHourBefore: false,
    };
  }
  if (price <= 2000) {
    return {
      tier: 'standard',
      label: '大冰块',
      emoji: '❄️',
      maxTaps: 60,
      dailyTapLimit: 20,
      dailyBreathLimit: 5,
      quizLevels: [25, 50, 75, 100],
      hasFutureSelf: false,
      notifyFractions: [0.25, 0.5, 0.75],
      notifyOneHourBefore: false,
    };
  }
  return {
    tier: 'glacier',
    label: '冰川级',
    emoji: '🏔️',
    maxTaps: 100,
    dailyTapLimit: 25,
    dailyBreathLimit: 8,
    quizLevels: [25, 50, 75, 100],
    hasFutureSelf: true,
    notifyFractions: [0.25, 0.5, 0.75],
    notifyOneHourBefore: true,
  };
}

// ---- 深呼吸冷静舱 ----
export const BREATH_CONFIG = {
  inhaleSec: 4,
  holdSec: 7,
  exhaleSec: 8,
  roundsRequired: 3,      // 完成 3 轮才算有效干预
  expReward: 10,
};

// ---- 跨天重置工具 ----
export function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

export function resetDailyCounters<T extends { tapsToday?: number; chillToday?: number; lastResetDate?: string }>(
  item: T
): T {
  const today = todayStr();
  if (item.lastResetDate !== today) {
    return { ...item, tapsToday: 0, chillToday: 0, lastResetDate: today };
  }
  return item;
}

// ---- 阶段通知文案 ----
export const NUDGE_MESSAGES: Record<string, (name: string) => { title: string; body: string }> = {
  '25': (name) => ({
    title: '❄️ 冷冻进度 1/4',
    body: `「${name}」已冷冻四分之一。冲动退散了吗？点我查看欲望曲线`,
  }),
  '50': (name) => ({
    title: '🧊 半程已过！',
    body: `「${name}」冷冻过半。来做 1 分钟深呼吸，理智值拉满`,
  }),
  '75': (name) => ({
    title: '🔥 解冻临近',
    body: `「${name}」即将解冻。最后冲刺，再想想这笔钱能换什么？`,
  }),
  '1h': (name) => ({
    title: '⏰ 还有 1 小时解冻',
    body: `「${name}」马上到期。给 3 个月后的自己留句话吧`,
  }),
  thaw: (name) => ({
    title: '❄️ 商品冷冻期已满！',
    body: `「${name}」已解冻。你现在还想买它吗？点击进行抉择！`,
  }),
};

// ---- 替代想象换算表 ----
export interface Substitution {
  emoji: string;
  unit: string;
  unitPrice: number;
  label: string;
}

export const SUBSTITUTION_TABLE: Substitution[] = [
  { emoji: '☕', unit: '杯', unitPrice: 35, label: '精品拿铁咖啡' },
  { emoji: '🍱', unit: '顿', unitPrice: 45, label: '营养轻食餐' },
  { emoji: '🎬', unit: '次', unitPrice: 60, label: '周末 IMAX 观影' },
  { emoji: '🏋️', unit: '个月', unitPrice: 300, label: '健身房会员' },
  { emoji: '📚', unit: '本', unitPrice: 50, label: '精装好书' },
  { emoji: '🚇', unit: '个月', unitPrice: 200, label: '通勤交通费' },
];

// 按价格挑出 3 个最有冲击力的换算（数量在 1~500 之间最有感知）
export function getSubstitutions(price: number): (Substitution & { count: number })[] {
  return SUBSTITUTION_TABLE.map((s) => ({
    ...s,
    count: Math.round(price / s.unitPrice),
  }))
    .filter((s) => s.count >= 1 && s.count <= 500)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
}

// ---- 冲动日记标签 ----
export const JOURNAL_SCENES = ['深夜刷手机', '直播间种草', '朋友推荐', '情绪低落', '打折促销', '其他'];
export const JOURNAL_MOODS = ['兴奋', '焦虑', '无聊', '压力大', '跟风'];
