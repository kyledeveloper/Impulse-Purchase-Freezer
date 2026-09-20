# 决策模块完整设计方案
# (Decision System Design · 解冻时刻的终极抉择)

> 目标：把"时间到了，买还是不买"从两个孤零零的按钮，升级为一场**有仪式感、有信息密度、有真实后果**的决策仪式。让"放弃"更有成就感，让"购买"真正代表理性确认而非冲动残留。

---

## 一、现状问题诊断

| 问题 | 现状 | 后果 |
|---|---|---|
| 决策信息单薄 | 弹窗只显示商品图、名称、价格 | 用户决策时缺乏"这段冷静期我经历了什么"的回顾 |
| 两个选项无差异化后果 | 放弃 +80 EXP，购买 +20 EXP，都是拍脑袋 | 无法体现"干预做得越多，放弃奖励越高"的公平性 |
| 购买路径零摩擦 | 点"仍然想买"直接跳转购买链接 | 最后的防线形同虚设，冲动残留者一秒破功 |
| 放弃反馈廉价 | 一个 Alert + 彩带 | 与"省下 ¥5999"的成就感不匹配 |
| 心愿兑换无真实扣减 | 心愿进度用累计总节省计算，兑换只标记 redeemed 不扣钱 | 用户可"兑换"所有心愿，金库数字永不减少，经济系统崩溃 |
| 无"再冻一次"选项 | 犹豫不决的用户只能二选一 | 大量"还没想好"的用户被迫选择，体验断裂 |
| 无后悔/复购机制 | 购买后商品永远消失 | 无法形成"冷冻→购买→使用反馈→更懂自己"的闭环 |

---

## 二、设计原则

1. **决策前先回顾**：展示完整干预历程，让用户基于"事实"而非"残留冲动"做决定。
2. **三个选项，不是两个**：放弃 / 购买 / 再冻一次——承认"还没想好"是真实且合理的状态。
3. **奖励与努力挂钩**：干预做得越充分，放弃的奖励越高；冲动残留越多，购买的摩擦越大。
4. **经济系统必须守恒**：心愿兑换必须扣减金库余额，否则一切奖励数字都失去意义。

---

## 三、决策时刻信息架构（ThawDecisionModal 重做）

### 3.1 弹窗结构（自上而下）

```
┌─────────────────────────────────────┐
│  ❄️ 冰层已消融 · 抉择时刻            │
├─────────────────────────────────────┤
│  [商品图 + 融化水渍]                 │
│  商品名 / ¥价格                      │
├─────────────────────────────────────┤
│  📊 本次冷静期战报（新增）            │
│  ├─ 冷冻时长：48 小时                │
│  ├─ 完成干预：呼吸 ×3 · 印记 ×2/4     │
│  ├─ 冲动压平率：-42%（多巴胺曲线）    │
│  └─ 未来自我留言：「...」（如有）     │
├─────────────────────────────────────┤
│  🎯 你的心愿进度（新增）              │
│  「海岛旅行」当前 67% → 放弃后 92%   │
├─────────────────────────────────────┤
│  🛡️ 放弃购买                         │
│     预计获得：¥5999 入库 + 120 EXP   │
│     （含印记加成 +40）               │
│                                     │
│  🧊 再冻一次（新增）                  │
│     延长 24 小时，每天限 1 次         │
│                                     │
│  🛒 仍然想买                          │
│     需通过「最终确认」                │
└─────────────────────────────────────┘
```

### 3.2 关键新增模块

**（a）冷静期战报**：从 `item.interventionLog`、`rationalMarks`、`journal` 汇总，让用户看到自己 48 小时的努力。这是放弃时成就感的来源，也是购买时"我确实认真想过了"的心理支撑。

**（b）心愿进度联动**：实时计算"如果放弃，进度最高的心愿会前进多少"。把抽象的"省钱"转化为具体的"离梦想更近一步"。

**（c）印记加成**：放弃的基础 EXP 从固定 +80 改为：

```
放弃EXP = 基础50 + 印记加成（每个理性印记 +15，最多 +60）+ 完整冷静期加成 +30
```

印记加成让"认真做拷问"的用户得到明显更多回报，解决激励错位。

---

## 四、三个决策路径详细设计

### 4.1 路径 A：放弃购买（理性胜利）

**流程**：
1. 点击"放弃购买" → 播放 `AudioService.playCoinSound()` + `HapticsService.victorySuccess()`。
2. 进入**结算动画**（新组件 `VictorySettlement.tsx`）：
   - 金币从商品图位置飞入顶部金库图标，数字滚动 `+¥5,999`
   - EXP 条增长，显示明细：`基础 +50 · 印记 ×2 +30 · 完整冷静 +30 = 110 EXP`
   - 若解锁新奖章，奖章从底部升起旋转展示
   - 若心愿进度跨过 100%，心愿卡片闪烁金光
3. 动画结束后显示**战报卡片**（可分享）：
   - 标题："我成功抵御了一次 ¥5,999 的冲动消费"
   - 包含：商品名、节省金额、干预次数、压平率、当前金库总额、防御等级
   - 按钮："保存图片" / "分享给朋友"（用 `react-native-view-shot` 截图 + 系统分享）

**数据流转**：
```
StorageService.recordAbandonedPurchase(item)
  → totalSaved += item.price
  → availableBalance += item.price（新增）
  → itemsDefended += 1
  → willpowerExp += calculatedExp（含印记加成）
  → 检查奖章解锁
  → 写入 DefenseRecord（含 interventionSummary、expEarned）
  → 若心愿开启"自动分配"：availableBalance -= price，wish.allocatedAmount += price
```

### 4.2 路径 B：再冻一次（新增）

**定位**：承认"还没想好"是合理状态，但防止无限拖延。

**规则**：
- 每次解冻最多再冻 1 次，延长 24 小时。
- 再冻次数记录在 `item.refreezeCount`，最多 2 次（即最长可冻 48+24+24 小时）。
- 第 2 次解冻时，"再冻一次"按钮消失，强制二选一。
- 再冻期间干预手段重置（可再次呼吸、拷问），但印记不重复获得。

**UI 反馈**：按钮文案显示剩余次数："再冻 24 小时（还可 1 次）"。

**心理价值**：给"真还没想好"的用户一个出口，避免他们因被迫选择而产生负面情绪流失。

### 4.3 路径 C：仍然想买（理性确认，增加摩擦）

**现状**：一键跳转购买链接，零摩擦。

**新方案——三步确认仪式**：

**第 1 步：确认意图**
- 点击"仍然想买"后，不直接跳转，而是弹出确认层：
  > "经过 48 小时冷静期和 3 次干预，你依然确定需要它吗？"
  > - "是的，我认真想过了" → 进入第 2 步
  > - "再想想" → 返回决策弹窗

**第 2 步：预算检视**
- 显示："本月已确认购买 X 件冷冻商品，合计 ¥Y。"
- 若用户时薪已输入，显示："这相当于你工作 N 小时的收入"。
- 勾选框："我已确认这是理性需求，而非冲动残留"（必须勾选才能继续）。

**第 3 步：完成购买**
- 点击"确认购买" → `Linking.openURL(originalUrl)`。
- 记录 `recordConfirmedPurchase(item)`：
  - EXP 从固定 +20 改为：`基础 +20 - 冲动残留惩罚（quizInsisted × 5）`，最低 +5。
  - 写入 DefenseRecord，标记 `outcome: 'purchased'`。
- 显示："祝购物愉快！30 天后欢迎回来记录使用体验。" → 新增"使用反馈"入口。

---

## 五、使用反馈闭环（新增，低风险高价值）

购买 30 天后，系统发通知："你买的「XX」用得怎么样？"

- 入口：金库"防御战报"中该记录出现"记录使用反馈"按钮。
- 选项：经常使用 / 偶尔使用 / 吃灰了 / 已转卖。
- 若选"吃灰了"：提示"下次冷冻时可以更严格哦"，该商品品类计入"高风险品类"（未来同品类商品自动升一档干预强度）。
- 若选"经常使用"：提示"理性消费的成功案例！"，+15 EXP。

这让"购买"不再是终点，而是自我认知的数据点。

---

## 六、心愿兑换与经济系统修复（关键）

**现状致命缺陷**：心愿进度 = `totalSaved / cost`，而 `totalSaved` 只增不减，兑换只标记 `redeemed` 不扣钱 → 用户可"兑换"所有心愿，系统失去意义。

**修复方案：引入"可用金库余额"与"已分配金额"**：

```ts
interface VaultStats {
  // ...existing
  totalSaved: number;        // 历史累计节省（只增不减，用于等级/奖章）
  availableBalance: number;  // 可用余额（兑换心愿时扣减）
  allocatedToWishes: number; // 已分配给心愿的总额
}

interface WishlistItem {
  // ...existing
  allocatedAmount: number;   // 已充入该心愿的金额
  autoAllocate: boolean;     // 放弃购买时是否自动充入
}
```

**规则**：
- 放弃购买时：`totalSaved += price`，`availableBalance += price`。
- 若某心愿开启"自动分配"：`availableBalance -= price`，`allocatedToWishes += price`，`wish.allocatedAmount += price`。
- 心愿进度 = `allocatedAmount / cost`（真实充能），而非 `totalSaved / cost`（虚假繁荣）。
- 心愿进度满 100% 后，"兑换"按钮可点击，点击后 `redeemed = true`，`allocatedAmount` 清零，`allocatedToWishes -= cost`（钱被"花掉"了）。
- 手动管理：心愿卡片上增加"充入 ¥100"和"取出"按钮，让用户在金库余额和心愿之间自由调配。

**迁移**：老数据 `availableBalance = totalSaved - 已兑换心愿总额`，`allocatedAmount` 按 progress 反推。

---

## 七、决策时刻的防冲动设计细节

| 细节 | 说明 |
|---|---|
| **按钮不对称** | "放弃购买"用最大、最亮、最上位置；"再冻一次"中等；"仍然想买"最小、最暗、最下 |
| **倒计时压迫感** | 决策弹窗顶部显示"解冻已过去 00:03:42"，暗示"快点决定，不要一直纠结" |
| **损失框架** | "放弃购买"按钮文案强调"将 ¥5,999 存入金库"，而非"不买了"——强调获得而非失去 |
| **社会证明**（预留） | 弹窗底部小字："昨天有 1,284 位用户成功抵御了冲动"（假数据占位，未来接后端） |

---

## 八、数据模型变更汇总

```ts
export interface FreezerItem {
  // ...existing + 干预模块新增字段
  refreezeCount: number;              // 已再冻次数
  purchasedFeedback?: 'often' | 'sometimes' | 'dusty' | 'sold';
}

export interface VaultStats {
  totalSaved: number;
  availableBalance: number;           // 新增
  allocatedToWishes: number;          // 新增
  itemsDefended: number;
  defenseLevel: number;
  willpowerExp: number;
  unlockedMedals: string[];
  monthlyPurchasedCount: number;      // 新增
  monthlyPurchasedAmount: number;     // 新增
}

export interface WishlistItem {
  // ...existing
  allocatedAmount: number;            // 新增
  autoAllocate: boolean;              // 新增
}

export interface DefenseRecord {
  // ...existing
  interventionSummary: {              // 新增
    breathCount: number;
    rationalMarks: number;
    quizInsisted: number;
    journalScene?: string;
  };
  expEarned: number;                  // 新增
}
```

---

## 九、界面改动清单

| 文件 | 改动 |
|---|---|
| `ThawDecisionModal.tsx` | 完全重做：战报汇总、心愿联动、三按钮、三步确认流程 |
| 新增 `VictorySettlement.tsx` | 放弃后的金币飞入、EXP 明细、奖章展示、可分享战报卡片 |
| 新增 `PurchaseConfirmSteps.tsx` | 购买的三步确认（意图→预算→完成） |
| 新增 `UsageFeedbackModal.tsx` | 30 天后使用反馈 |
| `VaultScreen.tsx` | 心愿卡片改为真实充能进度、充入/取出按钮；战报 Tab 显示干预汇总 |
| `services/storage.ts` | 重做 `recordAbandonedPurchase`（动态 EXP）、新增余额调配方法、月度统计 |
| `services/notifications.ts` | 新增 30 天后使用反馈提醒 |
| `constants/decision.ts`（新增） | 决策文案、EXP 计算公式、再冻规则 |

---

## 十、验收标准（Definition of Done）

1. 解冻弹窗能看到完整的干预战报（时长、干预次数、印记数、压平率）。
2. 放弃 EXP 按公式计算（基础 + 印记 + 完整冷静），不再是固定 +80。
3. "再冻一次"最多 2 次，第 3 次解冻时消失。
4. 购买需经过三步确认，且第二步必须勾选"理性确认"才能继续。
5. 心愿进度基于 `allocatedAmount` 而非 `totalSaved`；兑换后可用余额减少。
6. 放弃购买后有结算动画，且能保存/分享战报图片。
7. 购买 30 天后能收到使用反馈通知，反馈结果写入记录。
8. 月度购买统计在金库可见，用于决策时提示。
