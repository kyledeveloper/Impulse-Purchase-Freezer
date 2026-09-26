#!/usr/bin/env node
/**
 * scripts/test-logic.mjs — 奖励 / 决策模块核心逻辑回归测试
 *
 * 用法：node scripts/test-logic.mjs
 *
 * 为什么不用 jest / tsc：
 *   - 仓库没有测试框架依赖，本机 tsc 6.0.3 在当前 Node 上不产出任何输出；
 *   - 所以这里用 Node 内置的类型擦除（module.stripTypeScriptTypes，需 Node >= 22.6）
 *     把 TS 模块转成 ESM 落到临时目录，注入 AsyncStorage / 图片资源桩后直接跑断言；
 *   - 覆盖：连胜判定、完美克制、EXP 公式、EXP 商店、月度兑换上限、奖章评估、旧数据迁移。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { stripTypeScriptTypes } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

if (typeof stripTypeScriptTypes !== 'function') {
  console.error('需要 Node >= 22.6（module.stripTypeScriptTypes）。当前：' + process.version);
  process.exit(1);
}

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'ipf-logic-'));
const MODULES = [
  'services/storage.ts',
  'services/rewards.ts',
  'constants/mockData.ts',
  'constants/rewards.ts',
  'constants/decision.ts',
  'constants/intervention.ts',
  'constants/assets.ts',
  'types/index.ts',
];

// ---- 1. 测试桩：AsyncStorage / 图片资源 ----
const STUB_DIR = path.join(OUT, 'node_modules/@react-native-async-storage/async-storage');
fs.mkdirSync(STUB_DIR, { recursive: true });
fs.writeFileSync(
  path.join(STUB_DIR, 'index.js'),
  [
    "const store = new Map();",
    "const api = {",
    "  getItem: async (k) => (store.has(k) ? store.get(k) : null),",
    "  setItem: async (k, v) => { store.set(k, String(v)); },",
    "  removeItem: async (k) => { store.delete(k); },",
    "  clear: async () => store.clear(),",
    "};",
    "api.default = api;",
    "api.__esModule = true;",
    "module.exports = api;",
    '',
  ].join('\n')
);
const ASSET_STUB = path.join(OUT, 'asset-stub.cjs');
fs.writeFileSync(ASSET_STUB, "module.exports = 'asset-stub';\n");
fs.writeFileSync(path.join(OUT, 'package.json'), '{"type":"module"}\n');

// ---- 2. TS -> ESM ----
const withExt = (spec) => {
  if (!spec.startsWith('.')) return spec;
  if (/\/types$/.test(spec)) return spec + '/index.mjs';
  return spec + '.mjs';
};

for (const rel of MODULES) {
  let code = stripTypeScriptTypes(fs.readFileSync(path.join(REPO, 'src', rel), 'utf8'), {
    mode: 'strip',
    sourceUrl: rel,
  });
  // types/index.ts 只导出类型，擦除后是空模块 -> 直接去掉这类 import
  code = code.replace(/^\s*import\s[^;]*?from\s+['"][^'"]*\/types['"];?\s*$/gm, '');
  code = code.replace(/(from\s+|import\s+)(['"])(\.\.?\/[^'"]+)\2/g, (m, pre, q, spec) => pre + q + withExt(spec) + q);
  code = code.replace(/require\((['"])[^'"]*\.(png|jpg|jpeg|gif|webp|mp3|wav)\1\)/g, `require(${JSON.stringify(ASSET_STUB)})`);
  if (/\brequire\(/.test(code)) {
    code =
      'import { createRequire as __createRequire } from "node:module";\nconst require = __createRequire(import.meta.url);\n' +
      code;
  }
  const dest = path.join(OUT, rel.replace(/\.ts$/, '.mjs'));
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, code);
}

const load = (rel) => import(pathToFileURL(path.join(OUT, rel)).href);
const { StorageService, migrateVaultStats } = await load('services/storage.mjs');
const { RewardsService, computeStreak, calculateDefenseLevel, resolveDefenseLevel } = await load('services/rewards.mjs');
const {
  isPerfectDefense,
  EXP_PERK_COST,
  PERFECT_DEFENSE_BONUS,
  perkMinLevel,
  streakProgress,
} = await load('constants/rewards.mjs');
const {
  calculateAbandonExp,
  calculatePurchaseExp,
  REFREEZE,
  refreezeLeft,
  projectAutoAllocation,
} = await load('constants/decision.mjs');
const { DEFENSE_RANKS, MEDAL_LIST } = await load('constants/mockData.mjs');
const AsyncStorage = (await import(pathToFileURL(path.join(STUB_DIR, 'index.js')).href)).default;

const DAY = 86400000;
const now = () => Date.now();
const pass = (m) => console.log('  \u2713', m);

const mkStats = (over = {}) => ({
  totalSaved: 0, availableBalance: 0, allocatedToWishes: 0, itemsDefended: 0,
  defenseLevel: 1, willpowerExp: 0, unlockedMedals: [],
  monthlyPurchasedCount: 0, monthlyPurchasedAmount: 0, purchaseMonth: '',
  currentStreak: 0, perfectDefenses: 0, ownedPerks: [], lastDailyRewardDate: '',
  ...over,
});
const mkRec = (outcome, timestamp) => ({
  id: 'r' + timestamp, itemId: 'i', itemName: 'n', price: 100, outcome,
  timestamp, freezeDurationHours: 48, calmBoostCount: 0,
});
const mkItem = (over = {}) => ({
  id: 'item-1', name: '测试商品', price: 1000, category: 'x', image: 1,
  freezeDurationHours: 48, frozenAt: now() - 3 * DAY, thawAt: now() - DAY,
  status: 'freezing', breakTapsRemaining: 60, calmWaitBonus: 2,
  rationalMarks: [25, 50, 75, 100], answeredQuizLevels: [25, 50, 75, 100],
  quizInsisted: 0, interventionLog: [{ type: 'breath', timestamp: now() }],
  ...over,
});

/** VaultScreen 里的段位进度条算法（必须夹在 0..100） */
function rankProgressOf(stats) {
  const currentRank = DEFENSE_RANKS.find((r) => r.level === stats.defenseLevel) || DEFENSE_RANKS[0];
  const nextRank = DEFENSE_RANKS.find((r) => r.level === stats.defenseLevel + 1) || null;
  const currentExp = stats.willpowerExp || 0;
  return nextRank
    ? Math.max(0, Math.min(100, Math.round(((currentExp - currentRank.minExp) / Math.max(1, nextRank.minExp - currentRank.minExp)) * 100)))
    : 100;
}

console.log('\n[1] 段位判定（EXP 与累计节省需同时达标）');
{
  assert.equal(calculateDefenseLevel(500, 1, 100), 2, '两条门槛同时达标 → Lv.2');
  assert.equal(calculateDefenseLevel(8000, 3, 0), 1, '只堆累计节省不够');
  assert.equal(calculateDefenseLevel(0, 0, 1300), 1, '只堆 EXP 也不够');
  assert.equal(calculateDefenseLevel(8000, 3, 1300), 5);
  assert.equal(calculateDefenseLevel(250000, 40, 16000), 12);
  assert.equal(resolveDefenseLevel(5, 8000, 3, 0), 5, '老玩家 OR 时代的高段位被保留（不掉段）');
  assert.equal(resolveDefenseLevel(1, 8000, 3, 1300), 5, '达标则照常升级');
  pass('AND 门槛 + 只升不降');

  // 进度条：老段位 + 低 EXP 也必须夹在 0..100
  assert.equal(rankProgressOf(mkStats({ totalSaved: 8000, itemsDefended: 3, defenseLevel: 5, willpowerExp: 0 })), 0);
  assert.equal(rankProgressOf(mkStats({ defenseLevel: 1, willpowerExp: 99999 })), 100);
  pass('进度条夹在 0..100（修复 width: -150% 非法样式）');
}

console.log('\n[2] 连胜判定（computeStreak）');
{
  const t = now();
  assert.equal(computeStreak([]), 0);
  assert.equal(computeStreak([mkRec('purchased', t)]), 0);
  assert.equal(computeStreak([mkRec('abandoned', t), mkRec('abandoned', t - DAY)]), 2);
  assert.equal(computeStreak([mkRec('abandoned', t - 3 * DAY)]), 4);
  assert.equal(computeStreak([mkRec('abandoned', t), mkRec('purchased', t - DAY), mkRec('abandoned', t - 2 * DAY)]), 1);
  pass('空记录 / 当天购买 / 连续 / 首条记录起算 / 购买断档');
}

console.log('\n[3] 确认购买：连胜立即清零 + 月度计数');
await AsyncStorage.clear();
{
  for (const r of [mkRec('abandoned', now() - 3 * DAY), mkRec('abandoned', now() - 2 * DAY), mkRec('abandoned', now() - DAY)]) {
    await StorageService.addDefenseRecord(r);
  }
  await StorageService.saveVaultStats(mkStats({ currentStreak: 4, willpowerExp: 100 }));
  const { stats, expEarned } = await StorageService.recordConfirmedPurchase(mkItem({ quizInsisted: 1 }));
  assert.equal(expEarned, 15, '基础 20 - 冲动残留 5');
  assert.equal(stats.currentStreak, 0, '购买当天即清零');
  assert.equal((await StorageService.getVaultStats()).currentStreak, 0, '已落盘');
  assert.equal(stats.monthlyPurchasedCount, 1);
  assert.equal(stats.monthlyPurchasedAmount, 1000);
  const recs = await StorageService.getDefenseRecords();
  assert.equal(recs[0].outcome, 'purchased');
  assert.equal(recs[0].expEarned, 15);
  pass('清零连胜 / 月度件数与金额 / 战报记录');
}

console.log('\n[4] 放弃购买：连胜重算 + 完美克制结算');
await AsyncStorage.clear();
{
  await StorageService.addDefenseRecord(mkRec('abandoned', now() - 2 * DAY));
  await StorageService.addDefenseRecord(mkRec('abandoned', now() - DAY));
  await StorageService.saveVaultStats(mkStats({ currentStreak: 0, willpowerExp: 0 }));
  const res = await StorageService.recordAbandonedPurchase(mkItem());
  assert.equal(res.stats.currentStreak, 3);
  assert.ok(res.newlyUnlocked.includes('medal_streak_3'), '连胜奖章用最新连胜判定');
  assert.ok(res.isPerfect, '集齐印记 + 自然到期 = 完美克制');
  assert.equal(res.stats.perfectDefenses, 1);
  assert.ok(res.newlyUnlocked.includes('medal_perfect_1'));
  assert.equal(res.expBreakdown.total, calculateAbandonExp(mkItem()).total + PERFECT_DEFENSE_BONUS, '完美克制 +50');
  assert.equal(res.stats.totalSaved, 1000);
  assert.equal(res.stats.availableBalance, 1000);
  pass('连胜 3 天 / 奖章 / 完美克制 +50 / 金库入账');
}

console.log('\n[5] 提前解冻：不计入完美克制，且不重复扣费');
await AsyncStorage.clear();
{
  assert.equal(isPerfectDefense(mkItem()), true);
  assert.equal(isPerfectDefense(mkItem({ earlyThawedAt: now() })), false, '提前破冰排除完美克制');
  await StorageService.saveVaultStats(mkStats({ willpowerExp: 400, defenseLevel: 5 }));
  await StorageService.saveItems([mkItem()]);
  const first = await StorageService.spendExpForContextualPerk('early_thaw');
  assert.equal(first.ok, true, 'Lv.5 解锁后可扣费');
  assert.equal(first.stats.willpowerExp, 200, '首次扣 200 EXP');
  const marked = { ...mkItem(), earlyThawedAt: now() };
  await StorageService.saveItems([marked]);
  const reloaded = (await StorageService.getItems())[0];
  assert.ok(reloaded.earlyThawedAt, 'earlyThawedAt 已持久化（App 据此跳过二次扣费）');
  assert.equal(isPerfectDefense(reloaded), false, '重新读取后依旧排除完美克制');
  assert.equal((await StorageService.getVaultStats()).willpowerExp, 200, '重复进入不再扣费');
  pass('完美克制排除 / 每件商品限 1 次');
}

console.log('\n[6] 花费 EXP 不会让段位倒退');
await AsyncStorage.clear();
{
  assert.equal(calculateDefenseLevel(0, 0, 1100), 1, '只靠 EXP 已不足以维持 And 门槛');
  await StorageService.saveVaultStats(mkStats({ willpowerExp: 1300, defenseLevel: 5 }));
  const a = await StorageService.spendExpForContextualPerk('early_thaw');
  assert.equal(a.ok, true);
  assert.equal(a.stats.willpowerExp, 1100);
  assert.equal(a.stats.defenseLevel, 5, '情景特权后段位不倒退');
  await StorageService.saveVaultStats(mkStats({ willpowerExp: 1300, defenseLevel: 5 }));
  const b = await StorageService.purchasePerk('medal_frame_gold');
  assert.equal(b.willpowerExp, 1000);
  assert.equal(b.defenseLevel, 5, '购买特权后段位不倒退');
  assert.deepEqual(b.ownedPerks, ['medal_frame_gold']);
  pass('花 EXP / 买特权都不会掉段位');
}

console.log('\n[7] EXP 商店购买路径白名单');
await AsyncStorage.clear();
{
  await StorageService.saveVaultStats(mkStats({ willpowerExp: 600 }));
  assert.equal(await StorageService.purchasePerk('exp_to_balance'), null, '兑换入口不能买');
  const s = await StorageService.getVaultStats();
  assert.equal(s.willpowerExp, 600, '未被扣 EXP');
  assert.deepEqual(s.ownedPerks, [], '不会永久变「已拥有」而禁用兑换');
  assert.equal(await StorageService.purchasePerk('early_thaw'), null, '情景特权不能买');
  assert.equal(await StorageService.purchasePerk('extra_refreeze'), null, '情景特权不能买');
  assert.equal(await StorageService.purchasePerk('nope'), null, '未知特权');
  assert.ok(await StorageService.purchasePerk('medal_frame_gold'), '余额充足可购买');
  assert.equal(await StorageService.purchasePerk('medal_frame_gold'), null, '不可重复购买');
  await StorageService.saveVaultStats(mkStats({ willpowerExp: 50 }));
  assert.equal(await StorageService.purchasePerk('medal_frame_gold'), null, 'EXP 不足');
  pass('兑换 / 情景 / 未知 / 成功 / 重复 / 余额不足');
}

console.log('\n[8] EXP 兑换心愿金：充入心愿 + 月度上限（不受流水裁剪影响）');
await AsyncStorage.clear();
{
  const cap = EXP_PERK_COST.exp_to_balance_monthly_cap;
  await StorageService.saveVaultStats(mkStats({ willpowerExp: 1200 }));
  await StorageService.saveWishlist([
    { id: 'w1', title: '海岛旅行基金', cost: 1000, allocatedAmount: 0, autoAllocate: false, redeemed: false },
  ]);
  let converted = 0;
  for (let i = 0; i < 5; i++) {
    const r = await StorageService.expToBalance(100, 'w1');
    assert.ok(r, '第 ' + (i + 1) + ' 次兑换成功');
    assert.equal(r.toWish, 100, '全额充入心愿（而不是可用余额）');
    assert.equal(r.toBalance, 0);
    converted += r.converted;
  }
  assert.equal(converted, cap, '1 EXP = ¥1，共兑换 500');
  assert.equal(await RewardsService.getMonthlyExpConverted(), cap);
  const s1 = await StorageService.getVaultStats();
  assert.equal(s1.availableBalance, 0, '设计文档：折算后充入心愿');
  assert.equal(s1.willpowerExp, 700);
  assert.equal(s1.allocatedToWishes, 500);
  const wl = await StorageService.getWishlist();
  assert.equal(wl.find((w) => w.id === 'w1').allocatedAmount, 500, '心愿进度已推进');
  for (let i = 0; i < 220; i++) await RewardsService.appendExpLog(1, 'breath'); // 冲掉 200 条流水窗口
  const log = await RewardsService.getExpLog();
  assert.equal(log.length, 200);
  assert.equal(log.filter((t) => t.source === 'exp_to_balance').length, 0, '兑换流水已被挤掉');
  assert.equal(await RewardsService.getMonthlyExpConverted(), cap, '独立计数器仍准确');
  await StorageService.saveVaultStats(mkStats({ willpowerExp: 700 }));
  assert.equal(await StorageService.expToBalance(100), null, '超额兑换被拒绝');
  assert.equal((await StorageService.getVaultStats()).willpowerExp, 700, '超额请求不扣 EXP');
  pass('上限 500 生效且不可被流水裁剪绕过');

  // 无心愿可充时回落到可用余额（用全新一份存储重置月度额度窗口）
  await AsyncStorage.clear();
  await StorageService.saveWishlist([]);
  await StorageService.saveVaultStats(mkStats({ willpowerExp: 300 }));
  const fallback = await StorageService.expToBalance(100);
  assert.equal(fallback.toBalance, 100, '无心愿 → 进可用余额');
  assert.equal((await StorageService.getVaultStats()).availableBalance, 100);
  assert.equal(await RewardsService.getMonthlyExpConverted(), 100);
  pass('无心愿时自动回落到可用余额');
}

console.log('\n[9] 情景特权余额校验 + resetAll 清理账本');
await AsyncStorage.clear();
{
  await StorageService.saveVaultStats(mkStats({ willpowerExp: 1000, defenseLevel: 4 }));
  const locked = await StorageService.spendExpForContextualPerk('early_thaw');
  assert.equal(locked.ok, false);
  assert.equal(locked.reason, 'level', 'Lv.5 以下被拦');
  assert.equal(locked.requiredLevel, 5);
  assert.equal((await StorageService.getVaultStats()).willpowerExp, 1000, '段位不足不扣 EXP');
  await StorageService.saveVaultStats(mkStats({ willpowerExp: 100, defenseLevel: 5 }));
  const poor = await StorageService.spendExpForContextualPerk('early_thaw');
  assert.equal(poor.ok, false);
  assert.equal(poor.reason, 'exp', 'EXP 不足被拦');
  assert.equal((await StorageService.getVaultStats()).willpowerExp, 100);
  await StorageService.saveVaultStats(mkStats({ willpowerExp: 100, defenseLevel: 7 }));
  assert.equal((await StorageService.spendExpForContextualPerk('early_thaw')).reason, 'exp', 'Lv.7 但 EXP 不足');
  const ok = await StorageService.spendExpForContextualPerk('extra_refreeze');
  assert.equal(ok.ok, true, 'Lv.7 解锁再冻一次 +');
  assert.equal(ok.stats.willpowerExp, 0);
  assert.equal((await RewardsService.getExpLog())[0].source, 'perk_extra_refreeze');
  await StorageService.resetAll();
  assert.equal((await RewardsService.getExpLog()).length, 0, 'EXP 流水已清空');
  assert.equal(await RewardsService.getMonthlyExpConverted(), 0, '月度计数器已清空');
  assert.equal((await StorageService.getDefenseRecords()).length, 0);
  pass('余额不足拦截 / resetAll 清理流水与计数器');
}

console.log('\n[10] 每日连胜奖励 + 心愿兑换奖章 + 旧数据迁移');
await AsyncStorage.clear();
{
  const recs2 = [mkRec('abandoned', now()), mkRec('abandoned', now() - DAY)];
  const c0 = await RewardsService.claimDailyStreakReward(mkStats(), recs2, (s) => StorageService.saveVaultStats(s));
  assert.equal(c0.streak, 2);
  assert.equal(c0.expGained, 0, '连胜 < 3 不发奖励');
  const recs3 = [...recs2, mkRec('abandoned', now() - 2 * DAY)];
  const c1 = await RewardsService.claimDailyStreakReward(mkStats(), recs3, (s) => StorageService.saveVaultStats(s));
  assert.equal(c1.expGained, 5, '连胜 3 天 +5 EXP');
  assert.equal(await RewardsService.claimDailyStreakReward(c1.stats, recs3, (s) => StorageService.saveVaultStats(s)), null, '同日只发一次');
  pass('连胜每日奖励 +5、按自然日去重');

  await AsyncStorage.clear();
  await StorageService.saveVaultStats(mkStats({ willpowerExp: 100 }));
  await StorageService.saveWishlist([{ id: 'w1', title: '旅行', cost: 200, allocatedAmount: 200, autoAllocate: false, redeemed: false }]);
  const r = await StorageService.redeemWish('w1');
  assert.equal(r.stats.willpowerExp, 150, '兑换 +50 EXP');
  assert.ok(r.newlyUnlocked.includes('medal_wish_1'));
  assert.equal(await StorageService.redeemWish('w1'), null, '不可重复兑换');
  pass('心愿兑换 +50 EXP / 奖章 / 防重复');

  const legacy = migrateVaultStats({ totalSaved: 6000, itemsDefended: 4 });
  assert.equal(legacy.availableBalance, 6000, '旧数据可用余额回填');
  assert.equal(legacy.currentStreak, 0);
  assert.deepEqual(legacy.ownedPerks, []);
  pass('旧数据迁移默认值');
}

console.log('\n[11] EXP 公式 / 再冻规则 / 奖章清单');
{
  const exp = calculateAbandonExp(mkItem({ price: 3000 }));
  assert.deepEqual(
    { base: exp.base, markBonus: exp.markBonus, cool: exp.fullCooldownBonus, glacier: exp.glacierBonus, total: exp.total },
    { base: 50, markBonus: 60, cool: 30, glacier: 20, total: 160 }
  );
  assert.equal(calculatePurchaseExp(mkItem({ quizInsisted: 3 })), 5, '购买 EXP 最低 5');
  assert.equal(REFREEZE.maxCount, 2);
  assert.equal(refreezeLeft(mkItem({ refreezeCount: 2 })), 0);
  assert.equal(MEDAL_LIST.length, 14);
  pass('放弃购买 160 EXP / 购买最低 5 / 再冻 2 次 / 14 枚奖章');
}

console.log('\n[12] 自动充入预测 / 连胜里程碑进度');
{
  const wishes = [
    { id: 'a', title: 'A', cost: 1000, allocatedAmount: 0, autoAllocate: false, redeemed: false },
    { id: 'b', title: 'B', cost: 800, allocatedAmount: 300, autoAllocate: true, redeemed: false },
    { id: 'c', title: 'C', cost: 500, allocatedAmount: 0, autoAllocate: true, redeemed: false },
  ];
  const p1 = projectAutoAllocation(400, wishes);
  assert.equal(p1.wish.id, 'b', '命中第一个开启自动充入的心愿');
  assert.equal(p1.toWish, 400);
  assert.equal(p1.toBalance, 0);
  assert.equal(p1.wishAfterPercent, 88, '300+400 / 800');
  const p2 = projectAutoAllocation(900, wishes);
  assert.equal(p2.toWish, 500, '只充到心愿满额');
  assert.equal(p2.toBalance, 400, '多出来的进可用余额');
  assert.equal(p2.wishAfterPercent, 100);
  const p3 = projectAutoAllocation(400, [wishes[0], { ...wishes[1], autoAllocate: false }]);
  assert.equal(p3.wish, null, '没有开启自动充入 → 全额进可用余额');
  assert.equal(p3.toBalance, 400);
  pass('projectAutoAllocation 与结算口径一致');

  const s0 = streakProgress(0);
  assert.equal(s0.nextMilestone, 3);
  assert.equal(s0.percent, 0);
  assert.equal(s0.remaining, 3);
  const s5 = streakProgress(5);
  assert.equal(s5.nextMilestone, 7, '过了 3 天里程碑后冲 7 天');
  assert.equal(s5.percent, 50, '(5-3)/(7-3)');
  assert.deepEqual(s5.reached, [3]);
  const s30 = streakProgress(30);
  assert.equal(s30.nextMilestone, null);
  assert.equal(s30.percent, 100);
  assert.deepEqual(s30.reached, [3, 7, 30]);
  pass('streakProgress 里程碑与进度');
  assert.equal(perkMinLevel('early_thaw'), 5);
  assert.equal(perkMinLevel('extra_refreeze'), 7);
  assert.equal(perkMinLevel('medal_frame_gold'), 0);
  pass('特权段位门槛配置');
}

fs.rmSync(OUT, { recursive: true, force: true });
console.log('\nALL LOGIC TESTS PASSED\n');

