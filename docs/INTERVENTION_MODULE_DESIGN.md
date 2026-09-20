# 干预模块完整设计方案
# (Intervention System Design · 冷冻期内的主动行为干预)

> 目标：在冷冻倒计时期间，通过**科学原理可视化 + 分层交互 + 动态难度**，把"等待"从无聊的空窗期变成有反馈、有节奏、有成就感的"意志力训练期"。

---

## 一、现状问题诊断

| 问题 | 现状 | 后果 |
|---|---|---|
| 交互单一 | 只有"敲击破冰 100 次"和"长按冷静注冷" | 用户 2 分钟玩腻，之后再也不打开详情页 |
| 数值拍脑袋 | 所有商品固定 100 次敲击；注冷 +15 EXP；问答 +20~50 EXP | 与商品价格、冷冻时长完全脱钩 |
| 激励错位 | 问答选"理性答案"也加 EXP，且答完可继续破冰 | 用户学会"无脑点绿色按钮刷经验"，认知干预失效 |
| 无时间维度 | 干预全部集中在详情页，用户离开 App 后无任何触达 | 48 小时里 47 小时是"死时间" |
| 无个性化 | 多巴胺曲线是固定形状的插图 | 用户无法把曲线和"我这次的冲动"联系起来 |
| Alert 滥用 | 注冷成功、问答成功都弹系统 Alert | 打断心流，体验廉价 |

---

## 二、设计原则

1. **干预 = 替代多巴胺**：每个交互都要给出"比拆快递更持久"的即时反馈（视觉、音效、数值）。
2. **干预强度与冲动强度成正比**：商品价格越高、冷冻期越长，干预手段越多、越深。
3. **干预要有"成本-收益"权衡**：轻松的小干预给小奖励，需要思考的干预给大奖励，绝不能无脑刷。
4. **离开 App 干预仍在继续**：用通知把干预节奏延伸到后台。

---

## 三、干预手段矩阵（4 层 × 3 档）

### 3.1 四层干预体系

```
第 1 层 · 即时宣泄（被动，随时可做）
   └─ 敲击破冰 Tap Breaker —— 把"想买的冲动"物理化发泄

第 2 层 · 生理平复（主动，1~3 分钟）
   └─ 深呼吸冷静舱 Breath Chamber —— 4-7-8 呼吸法，降低生理唤醒

第 3 层 · 认知重构（主动，检查点触发）
   ├─ 理智拷问 Reality Check —— 现有 4 题，重做激励机制
   ├─ 替代想象 Substitution —— "这笔钱能换成什么"
   └─ 未来自我 Future Self —— "3 个月后的你怎么看"

第 4 层 · 环境干预（系统，后台进行）
   ├─ 阶段通知 Notification Nudges —— 25%/50%/75%/到期
   └─ 冲动日记 Impulse Journal —— 记录触发场景，形成自我认知
```

### 3.2 按商品价值分档（impulse tier）

| 档位 | 价格区间 | 破冰次数 | 呼吸次数上限 | 拷问关卡 | 通知节点 |
|---|---|---|---|---|---|
| 🧊 小雪糕 | < ¥300 | 30 次 | 3 次/天 | 25、75 两关 | 50%、到期 |
| ❄️ 大冰块 | ¥300 ~ ¥2000 | 60 次 | 5 次/天 | 25/50/75/100 四关 | 25/50/75、到期 |
| 🧊🧊 冰川级 | > ¥2000 | 100 次 | 8 次/天 | 四关 + 终极"未来自我" | 每 25% + 到期前 1 小时 |

> 实现：新增 `src/constants/intervention.ts`，导出 `getImpulseTier(price): TierConfig`。
> `FreezeModal` 创建商品时写入 `item.tier`，`FreezeDetailScreen` 按 tier 渲染。

---

## 四、各干预手段详细设计

### 4.1 敲击破冰（重做数值与反馈）

**现状**：固定 100 次，每点一次 -1，无差别。

**新方案**：
- 次数由档位决定（30/60/100），不再一刀切。
- **连击系统**：2 秒内连续敲击 ≥5 次触发"碎冰连击"，冰块震动幅度加大、裂纹跳变、音效升调，但**不加 EXP**——因为它是宣泄，不是思考。
- **疲劳曲线**：每天前 20 次敲击裂纹正常推进；超过后每次只推进 0.5 格（视觉变慢），文案提示"冲动发泄得差不多了，试试深呼吸？"
- **完成奖励**：敲满当天上限后，破冰按钮变为灰色，显示"今日宣泄已足够"。

**数据变更**：
```ts
interface FreezerItem {
  // ...existing
  tier: 'snack' | 'standard' | 'glacier';
  tapsToday: number;
  lastTapDate: string;   // 'YYYY-MM-DD' 用于跨天重置
}
```

### 4.2 深呼吸冷静舱（重做：去 Alert、加引导动画）

**现状**：长按 3 秒 → 弹 Alert +15 EXP，每天无限刷。

**新方案**：
- **全屏呼吸引导层**：点击后进入半透明覆盖层，中央一个随 4-7-8 节奏缩放的光球：吸气 4 秒（放大，浅蓝）→ 屏息 7 秒（保持，青色）→ 呼气 8 秒（缩小，深蓝）。一轮 19 秒，完成 3 轮（约 1 分钟）才算一次有效干预。
- **奖励**：完成一次 +10 EXP，**每日上限由档位决定**（3/5/8 次）。达到上限后按钮显示"今日理智冷气已充足"。
- **反馈**：完成后光球化作雪花飘向冰块，冰块表面出现"霜花"叠加层 5 秒，`HapticsService.victorySuccess()`，无 Alert。
- **中途退出**：不足 3 轮退出，不给 EXP，文案"没关系，哪怕一次深呼吸也有用"。

**技术实现**：
- 新组件 `src/components/BreathChamber.tsx`，用 `Animated` + `Easing.inOut` 驱动光球。
- 每日次数存于 `item.chillToday` + `item.lastChillDate`，与敲击共用跨天重置工具函数 `resetDailyCounters(item)`。

### 4.3 理智拷问（重做激励机制）

**现状**：4 道固定题，选"理性"加 EXP 且可继续破冰，选"坚持"无后果。

**新方案——核心改变：选"理性"不再是"奖励点"，而是"决策点"**：

| 选择 | 后果 |
|---|---|
| 🛡️ 理性反思（放下锤子） | **本次拷问通过**，不再立即加 EXP，而是**解锁一个"理性印记"**；集齐印记在解冻时兑换大额奖励（见奖励模块）。同时弹出次级选项："直接放弃购买"或"放回冷冻舱"。 |
| 🔨 坚持破冰 | 正常继续，无 EXP、无惩罚，记录 `quizInsisted++`（用于战报画像）。 |

**关卡内容扩充**（按档位增加）：

| 关卡 | 主题 | 冰川级专属追加 |
|---|---|---|
| 25% | 替代性拷问 | 展示用户历史已购同类物品（如有记录） |
| 50% | 劳动时薪拷问 | 让用户输入自己时薪，精确计算 |
| 75% | 多巴胺半衰期 | 播放 5 秒"欲望曲线"动画，从峰值跌到基线 |
| 100% | 愿望权衡拷问 | 并列展示"本商品" vs "进度最高的心愿"，视觉冲击 |
| 追加 | 未来自我拷问（仅冰川级） | "给 3 个月后的自己留一句话"，解冻时展示 |

**数据变更**：
```ts
interface FreezerItem {
  rationalMarks: number[];     // 已通过的拷问关卡 [25, 50, 75, 100]
  quizInsisted: number;        // 选择坚持破冰的次数
  futureSelfNote?: string;     // 未来自我留言
}
```

### 4.4 替代想象 Substitution（新增）

- 在拷问关卡 50% 通过后自动出现一次。
- 展示 3 个"等价替代"卡片，数据来自预设换算表：`¥5999 手机 ≈ 200 杯精品咖啡 ≈ 12 个月健身卡 ≈ 1/2 次海岛旅行`。
- 换算表按价格区间配置在 `src/constants/substitutionTable.ts`。
- 用户点击任一替代卡片 → 弹出"把它加入心愿单？"，一键加入愿望单（打通干预 → 心愿 → 奖励闭环）。
- 无 EXP，奖励是"心愿进度可视化"本身。

### 4.5 冲动日记 Impulse Journal（新增）

- 入口：详情页底部"📝 记录这次冲动的来源"。
- 场景标签：深夜刷手机 / 直播间种草 / 朋友推荐 / 情绪低落 / 打折促销 / 其他。
- 情绪标签：兴奋 / 焦虑 / 无聊 / 压力大 / 跟风。
- 文本框可选，最多 140 字；提交后 +5 EXP（每个商品限一次），存入 `item.journal`。
- 在金库"防御战报"Tab 新增"冲动画像"：用图表展示触发场景分布。

### 4.6 阶段通知 Notification Nudges（重做）

**现状**：只有到期一条通知。

**新方案**：冷冻时一次性调度多条通知，每条文案对应不同干预引导：

| 节点 | 文案 | 点击后 |
|---|---|---|
| 25% | "❄️「XX」已冷冻 1/4。冲动退散了吗？点我查看欲望曲线" | 打开详情页，高亮多巴胺曲线 |
| 50% | "🧊 半程已过！来冷静舱做 1 分钟呼吸，理智值拉满" | 直接打开 BreathChamber |
| 75% | "🔥 解冻临近！最后冲刺，再想想这笔钱能换什么？" | 打开替代想象卡片 |
| 到期前 1 小时（仅冰川级） | "⏰ 还有 1 小时解冻。给 3 个月后的自己留句话吧" | 打开未来自我输入 |
| 到期 | 现有文案保留 | 打开决策弹窗 |

**技术实现**：
- `NotificationService.scheduleInterventionNudges(item)`：按 `frozenAt + duration * 0.25/0.5/0.75` 计算时间戳，批量调度。
- 通知 payload 带 `data: { screen: 'detail', itemId, action: 'breath' | 'substitution' | ... }`，App 端用 `Notifications.addNotificationResponseReceivedListener` 路由。
- 商品被提前处理时按 `item.notificationIds` 取消该商品的所有通知。

---

## 五、多巴胺曲线个性化（DopamineChart 升级）

**现状**：固定曲线插图。

**新方案**：
- 曲线形状 = f（商品价格, 冷冻时长, 已完成干预次数）：
  - 价格越高 → 峰值越高（冲动越强）
  - 每完成一次有效干预（呼吸/拷问通过/日记），曲线"砍一刀"下降 8%，直观反馈"你的干预正在起效"
  - 干预次数越多，曲线尾部越低（残余欲望越少）
- 解冻决策时，曲线下方显示总结："本次干预共压平冲动峰值 42%"。
- 实现：DopamineChart 接收 `item` 和干预计数，用 `react-native-svg` 的 Path 动态生成贝塞尔曲线，替换现有静态图。

---

## 六、数据模型与存储变更汇总

```ts
// types/index.ts 新增/修改
export type ImpulseTier = 'snack' | 'standard' | 'glacier';

export interface InterventionRecord {
  type: 'breath' | 'quiz_pass' | 'journal' | 'substitution';
  timestamp: number;
  detail?: string;
}

export interface FreezerItem {
  // ...existing fields
  tier: ImpulseTier;
  tapsToday: number;
  lastTapDate: string;
  chillToday: number;
  lastChillDate: string;
  rationalMarks: number[];
  quizInsisted: number;
  futureSelfNote?: string;
  journal?: { scene: string; mood: string; note?: string };
  interventionLog: InterventionRecord[];
  notificationIds: string[];
}
```

迁移策略：`StorageService.getItems()` 读取后做 `migrateItem(item)` 补默认值，一次性完成。

---

## 七、界面改动清单

| 文件 | 改动 |
|---|---|
| `FreezeDetailScreen.tsx` | 按 tier 渲染；新增 BreathChamber、日记入口；移除所有 Alert，改为行内反馈 |
| `TapShield.tsx` | 连击动画、疲劳曲线文案、次数按 tier；新增"霜花"覆盖动画 |
| `RealityCheckModal.tsx` | 激励机制重做（印记替代 EXP）；新增冰川级"未来自我"输入；时薪可输入 |
| 新增 `BreathChamber.tsx` | 全屏 4-7-8 呼吸引导 |
| 新增 `SubstitutionCards.tsx` | 等价替代卡片 + 一键加心愿 |
| 新增 `ImpulseJournalModal.tsx` | 场景/情绪标签 + 文本 |
| `DopamineChart.tsx` | 动态曲线，随干预下降 |
| `services/notifications.ts` | 新增 `scheduleInterventionNudges`、按商品取消 |
| `constants/intervention.ts`（新增） | 档位配置、换算表、通知文案、呼吸参数 |

---

## 八、验收标准（Definition of Done）

1. 不同价位商品的破冰次数、呼吸上限、拷问关卡数不同。
2. 呼吸完成 3 轮前退出不给 EXP；每日上限达到后按钮置灰。
3. 拷问选"理性"不再弹 EXP Alert，而是获得印记，UI 上有印记收集进度条（4 格）。
4. 冷冻商品后，`Notifications.getAllScheduledNotificationsAsync()` 能看到多条计划通知。
5. 多巴胺曲线随干预次数增加而下降，解冻时显示"压平百分比"。
6. 冲动日记提交后，金库 Tab 能看到画像数据。
7. 全程无系统 Alert（除破坏性操作确认外）。
