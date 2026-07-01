# Design Document

> Spec: sokoban-mvp-2-push · Design
> 需求见同目录 `requirements.md`；全局共识、Godot 参照、范式标记约定、"发表前 checklist" 见 `docs/paradigm-validation-sokoban-roadmap.md`。
> 前置基线（本设计直接沿用，不再论证）：
> - MVP-0 · `sokoban-mvp-0-k-state/design.md` 定的**状态承载方案 A**（state 作 `initialInput` 进 / `nextState` 出、块保持纯、调用方持状态）。
> - MVP-1 · `sokoban-mvp-1-walk/design.md` 定的**外部主循环**（K-LOOP 结论：主循环在浏览器 `keydown` 回调、引擎单趟确定性 `assemble`）+ 走路块 `move-step` + 转接件 `keyToDirection` + 渲染 `render` + 浏览器脚手架 `main.ts`。
> - MVP-1 · `experiments/exp06-sokoban/REPORT.md` 已复审：方案 A 在 10×9 网格 + 51 墙下**未触发复审**（配置未变重），继续沿用。
> 引擎现状基线：`engine/src/{types,assemble,check,registry}.ts` —— `assemble` 单趟顺序遍历 `config.steps`，`inputMap` 只做字段重命名（未触及 Q-024），无一等 loop step（Q-027 `resolved/avoided`）。

## Overview

MVP-2 在 MVP-1 走路基础上加两件事——**推箱** 与 **胜利判定**——并把整条链路兑现为"浏览器里能玩到通关"的最小可玩 demo。这同时是路线图 D-014 的**对外发表闸口**：本 MVP 不是普通功能增量，而是"别人认得出这是 Sokoban、且能上手玩"的最小对外门槛。

核心设计取舍：

1. **状态承载 = 直接沿用方案 A，不重议。** `GridState` 里加 `boxes: Position[]`（动态）与 `goals: Position[]`（静态），仍作 `initialInput` 整份进、`nextGrid` 整份出，调用方在回合间保管。MVP-1 REPORT 已给出复审结论（沿用 A，未触发条件），本 MVP 不再重新讨论承载方式。**"box on goal" 是派生态，不入字段**（单一真相：坐标；避免与真实坐标漂移）。
2. **主循环 = 直接沿用外部主循环，不改引擎。** MVP-1 已把 K-LOOP 结论钉死（引擎无一等 loop step、回合制下也不需要），本 MVP 完全落在同一模型：`keydown → adapter → 单趟 assemble → 更新 grid + won → render`。引擎**零改动**。
3. **推箱是"走 + 推"的合体，作为一个新块 `move-with-push` 存在。** 走一步和推一步在几何上是**同一趟 target 判定**（前方一格是什么决定动作分支），把它拆成两个块级联反而让接线变复杂却不消除任何耦合。**算法（一层推链判断）入块**，配置只接线，符合 AFP 硬边界。MVP-1 的 `move-step` **保留不删**——它仍在 `walk.jsonc` 与 MVP-1 单测里用作走路场景的对照/回归。（详见"块发现与复用讨论"。）
4. **胜利判定 = 独立纯块 `win-check`，织进装配流第二步。** `won = ∀ box ∈ boxes: box ∈ goals` 是一条纯机制、跨业务可复用，抽块比织入 `move-with-push` 更符合"机制/策略二分"。**规则在装配流里，控制流在浏览器侧**（见下条）。
5. **"关卡完成后不再响应移动" = 浏览器侧门控，不进引擎。** R5.2 明确要求"沿用 MVP-1 的外部主循环思路，控制流留在浏览器侧事件回调，优先不把控制流推进引擎"。`main.ts` 拿到 `won: true` 后 gate 掉 `keydown`；引擎保持"每次按键 = 一趟确定性装配"的单趟语义。这守住了"配置图静态可枚举"红线——不需要在 push 配置里塞条件分支或 loop step。
6. **渲染换 Sokoban 传统 ASCII 字符集（前置 MVP-3 的字符约定）。** 走路时 `.` 曾是地板，MVP-2 起改为目标格；地板改用空格。这是与 MVP-3 R1.1 完全一致的字符集，为下一 MVP 加关卡零改字符；同时把"箱子/箱子就位/玩家/玩家在目标"通过字符差异做出视觉区分（R4.1、R4.2）。**胜利提示走独立 DOM 元素**（状态栏），不混进网格。
7. **业务/装配逻辑层保持纯 AFP、零 `@paradigm` 标记；`main.ts` 因承载三条非 AFP 控制流打 `@paradigm NON-AFP: external-control-flow`。** 三个块（`move-step` 保留、新增 `move-with-push`、`win-check`）都是纯函数；配置只接线；转接件 `keyToDirection` 沿用——业务/装配层零标记。胜利门控（`won → 拒绝方向键`）+ 终局输入拦截 + `R/r` 重开落在 `main.ts` 里，是本 MVP 最重要的非 AFP 边界决定——它们是"跨回合的时间维度状态 + 事件级条件分支"，用 AFP 数据流表达要么塞进配置的条件分支（违反"配置图静态可枚举"红线）、要么把主循环推进引擎（违反 MVP-1 已钉的 K-LOOP 结论）。按 afp-core.md 判据（读者会不会因为不打标记而误以为这段是纯 AFP 数据流？会 → 标记）必须在 `main.ts` 头部打标记，作为 D-014 `docs/paradigm-comparison.md` 的正面证据（详见 §9）。**如果**将来门控扩到需要跨回合记忆的多态迁移（暂停/多存档/回放），按约定升级为 reducer / 状态机再重打标记；本设计不预造。

### 块发现与复用讨论（先跑 afp-discover-blocks 心智）

按 skill `afp-discover-blocks` 的纪律，加块前先问"能不能复用"：

| 候选做法 | 判读 | 决定 |
| :--- | :--- | :--- |
| **A. 扩展 `move-step` 兼顾推箱** | move-step 当前契约 `{grid, direction} → {nextGrid}` 里 `grid` 无 `boxes`。要"扩展"就必须改契约 → 本质是新块；且 MVP-1 走路配置/单测都在依赖旧契约，改动传染面大 | ❌ 不采 |
| **B. `push-step` + `move-step` 级联**（第一步判断"要不要推"，第二步再走） | 推与走在几何上是同一趟 target 判定——`grid.player + delta` 一算就同时决定走 vs 推 vs 停。级联要么让第二步重算一遍、要么让第一步先把决定塞进上下文再让第二步照做——两种都在配置里搭"if/else"，违反"算法不入配置" | ❌ 不采 |
| **C. 新增 `move-with-push` 独立块，`move-step` 保留** | 推箱=走的超集，用一个块承接整段回合动作最干净；旧块保留是"教学/回归"资产（走路装配流仍能跑），不与新块竞争 | ✅ **采** |
| **D. 从纯块 `win-check` 里再拆出"集合包含"这种更小机制** | `win-check` 本身已很薄；再拆一层引入接线开销却不换来复用（当前只有它一个 caller）——"拿不准时切细"是设计口子，但此处切细无收益 | ❌ 不预造，留后续（拿不准就先切在 `win-check` 内部，将来重复出现再挖块 · 治理关节放开零件） |

**结论**：新增两个块 `move-with-push`、`win-check`；保留 MVP-1 的 `move-step` + `walk.jsonc` 作对照资产；转接件 `keyToDirection`、渲染骨架 `render`、驱动 `stepWalk` 语义、`parseJsonc` 全部直接复用。

### Godot 词汇映射（沿用路线图，仅增量）

| Godot 概念 | 本 MVP 新增/延续 |
| :--- | :--- |
| Resource（纯数据资源） | 一份 ASCII 关卡文本（含 `# . @ $ * + <space>`）→ 解析出的 `GridState`（含 `boxes` / `goals`） |
| Scene（场景） | `push.jsonc`（MVP-2 的 FlowConfig：`move-with-push → win-check`） |
| Input 映射 | 沿用 MVP-1 转接件 `keyToDirection` |
| `_process()` 主循环 | 沿用 MVP-1 外部主循环，新增"胜利后 gate 输入"的浏览器侧门控 |

明确拒绝（同路线图）：每帧 tick、Node 继承、Signal。

## Architecture

```
引擎现状（不改）：
  assemble(config, registry, initialInput) —— 单趟顺序执行 steps、无 loop step
  inputMap —— 仅字段重命名（Q-024）
  Ajv —— 校验 initialInput / block input / block output（引擎侧强契约）

┌──────────────────────── 浏览器（外部主循环 · 非 AFP 承诺范围） ────────────────────────┐
│                                                                                      │
│   keydown ──> [gate: if won then return]                                              │
│         │                                                                             │
│         ▼                                                                             │
│    input-adapter · keyToDirection   ──> Direction | null                              │
│         │  (null → 不触发回合，状态不前进)                                              │
│         │                                                                             │
│         │   currentGrid（方案 A：状态在调用方手里）                                     │
│         ▼                                                                             │
│    stepPush(config, registry, currentGrid, direction)                                 │
│         │                                                                             │
│         │   assemble(push.jsonc, registry, { grid: currentGrid, direction })          │
│         ▼                                                                             │
│    ┌──────────────────── 引擎（确定性 · 零 AI · 单趟）────────────────────┐            │
│    │ step 1  move-with-push                                              │            │
│    │   in  { grid, direction } ──Ajv──>                                  │            │
│    │   execute: nextGrid = moveWithPush(grid, direction) （算法入块）      │            │
│    │   out { nextGrid } ──Ajv──> 摊平 context.nextGrid                    │            │
│    │                                                                     │            │
│    │ step 2  win-check                                                   │            │
│    │   in  { grid: <context.nextGrid> } ──Ajv──>                          │            │
│    │   execute: won = checkWin(grid) （纯机制，∀box∈goals）                │            │
│    │   out { won: boolean } ──Ajv──> 摊平 context.won                    │            │
│    └─────────────────────────────────────────────────────────────────────┘            │
│         │                                                                             │
│         │  context.nextGrid（新网格）、context.won（是否通关）                          │
│         ▼                                                                             │
│    currentGrid = nextGrid; wonFlag = won                                              │
│         ▼                                                                             │
│    render(currentGrid, container, { won: wonFlag })                                   │
│    // 网格文本 + 胜利提示 DOM（win=true 时显示 "你赢了！按 R 重开"）                       │
│                                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────┘

数据流（方案 A · 网格里现在含 boxes/goals，仍整份进出）：
  GridState { walls, goals, player, boxes }
     ──initialInput.grid──> [move-with-push] ──nextGrid──>
     ──inputMap { grid: "nextGrid" }──> [win-check] ──won──>
     ──> 调用方保管 grid+won ──> 下一回合再进（若未 won）
```

### 装配流两步的 inputMap 接线说明

`push.jsonc` 两步之间需要把 step1 的输出 `nextGrid` 喂给 step2 作 `grid`。引擎 `inputMap` 只做字段重命名（Q-024 未解），刚好够用：

- **step1 · move-with-push** · `inputMap: { grid: "grid", direction: "direction" }` —— 从 `initialInput` 取 `grid` 和 `direction`
- **step2 · win-check** · `inputMap: { grid: "nextGrid" }` —— 从上下文取 step1 摊平出的 `nextGrid` 作为 win-check 的 `grid` 参数

引擎将 step1 输出的 `nextGrid` 摊平进 `context.nextGrid`（现有机制，见 `engine/src/assemble.ts` 末尾）。step2 通过 inputMap 从 `"nextGrid"` 字段读出，作为自己的 `grid` 输入——这是纯字段重命名，未触及 Q-024。

**注意**：`win-check` 的输入字段命名为 `grid`（不是 `nextGrid`），使 `win-check` 块本身与"是不是刚走完的"无关——它就是"给我任意 GridState，我告诉你是否 won"。跨业务复用性由块自身负责，接线由配置负责。

### 为什么不把 win-check 织进 move-with-push？（AFP 纪律解释）

若织入：
- `move-with-push` 契约变成 `{grid, direction} → {nextGrid, won}`——单块承担两件独立事：移动 + 胜利判定。
- 复用性下降：如果将来某场景想"移动但不判胜"（比如动画预览、AI 求解器 dry-run），就必须再抽一次；提前抽干净成本更低。
- 违背"机制/策略二分"：移动是纯机制、胜利判定也是纯机制，但它们是**两条**纯机制。放同一块 = 机制粒度过粗。

抽出成本极小（win-check 就是三行代码 + 一份 schema），坚持抽。

## Components and Interfaces

### 1. 网格数据与解析 `src/grid.ts`（AFP 纯数据 + 纯机制）—— **扩展 MVP-1**

在 MVP-1 现有 `GridState` 上加两个字段；`parseLevel` 支持 Sokoban 传统字符集：

```ts
export interface Position { readonly x: number; readonly y: number; }

// MVP-2 起：静态地形（walls + goals）+ 动态态（player + boxes）
export interface GridState {
  readonly width: number;
  readonly height: number;
  readonly walls: readonly Position[];   // 静态：跨回合恒定
  readonly goals: readonly Position[];   // 静态：跨回合恒定（NEW）
  readonly player: Position;             // 动态
  readonly boxes: readonly Position[];   // 动态：跨回合可变（NEW）
}

export type Direction = "up" | "down" | "left" | "right";

// Sokoban 传统 ASCII 字符集（对齐 MVP-3 R1.1，零改动衔接下一 MVP）：
//   '#' 墙 · ' ' 地板 · '.' 目标 · '$' 箱子 · '*' 箱子在目标上 · '@' 玩家 · '+' 玩家在目标上
// 装载期一次性纯函数。
export function parseLevel(ascii: string): GridState;

// 派生（不入字段，避免与坐标漂移）：某坐标是否为"箱子在目标上"
export function isBoxOnGoal(grid: GridState, pos: Position): boolean;

// 发表关额外校验（publication-gate）：仅对 MVP-2 发表关 level-push-1.txt 调用一次，
// base parseLevel 不做（详见下方"Publication-gate 关卡完整性校验"）。
export function assertPublishableLevel(grid: GridState): void;

// TypeBox schema（GridStateSchema 扩展 goals + boxes）
export const PositionSchema;
export const GridStateSchema;   // NEW: 含 goals + boxes
export const DirectionSchema;
```

**parseLevel 契约细化**（base 契约 = 通用装载契约；严格校验留 MVP-3；MVP-2 要求"畸形拒绝上手可玩关"）：

- 恰好一个 `@` 或一个 `+`（玩家位置）—— 零个 / 多个 → 抛 `Error`
- `$` 数（+ `*` 数）与 `.` 数（+ `*` 数 + `+` 数）—— 箱子数须等于目标数，否则抛 `Error`（不然胜利判定无解可言）。**允许 0=0 的合法特例**（零箱零目标），承接 `level-walk-only.txt`（MVP-1 走路对照资产）在新字符集下的表达；发表关额外的"至少 2 箱 2 目标 + 开局非通关"由 `assertPublishableLevel` 显式二次校验（见下）。
- `+` = 玩家在目标格上：`player = 该坐标`，同时把该坐标加进 `goals`
- `*` = 箱子在目标格上：`boxes` 添该坐标，同时把该坐标加进 `goals`
- 越界闭合（外圈墙是否闭合）在 MVP-2 **不强校验**，作为"能玩就行"的最小门槛；正式静态校验器留 MVP-3。

**Publication-gate 关卡完整性校验 `assertPublishableLevel(grid)`**（parseLevel 之外的显式二次断言，与 base parseLevel 契约分层）：

MVP-2 的**发表关** `level-push-1.txt` 必须额外满足以下三条硬约束——**parseLevel 不做自动强校验**（因为 parseLevel 需保持"允许 0=0"以承接 `level-walk-only.txt`），改由 `main.ts` 装载完发表关后显式调用一次：

- `grid.boxes.length >= 2`
- `grid.goals.length >= 2`
- `checkWin(grid) === false`（开局不能已处于通关态——防止"空洞发表关"）

命中任一条 → 抛 `Error`；调用方（`main.ts`）在模块图加载期即失败（fail-fast），页面不渲染，浏览器控制台可见错误。签名：

```ts
// 纯函数、纯断言；不返回值。命中任一条约束抛 Error（消息中说明命中了哪一条）。
export function assertPublishableLevel(grid: GridState): void;
```

**两层契约要分清**：base `parseLevel` = 通用装载契约（允许 0=0，承接 walk-only）；publication-gate = 发表关额外硬约束（≥2 箱 / ≥2 目标 / 开局非通关，仅对发表关调用）。分层的直接收益：一份 `parseLevel` 代码支撑两个 MVP 的关卡语义，不在 base 契约里塞条件分支。

### 2. 走路 + 推箱块 `src/blocks/move-with-push.ts`（AFP 纯机制，算法入块）—— **新块**

```ts
// 纯函数：一步动作 = 走 或 推箱 或 停。
//   前方一格（player + delta）：
//     - 越界 或 是墙                          → 停在原格
//     - 是地板/目标（无箱）                    → 玩家移动到目标格
//     - 是箱子，且箱子前方一格是地板/目标（无箱）→ 玩家和该箱子各前进一格
//     - 是箱子，且箱子前方一格是墙 / 越界 / 另一个箱子 → 停在原格（一次只推一个）
// 静态地形 width/height/walls/goals 原样带出；动态 player/boxes 按上述规则更新。
export function moveWithPush(grid: GridState, direction: Direction): GridState;

export const moveWithPushBlock: BlockDef = {
  name: "move-with-push",
  inputSchema: Type.Object({ grid: GridStateSchema, direction: DirectionSchema }),
  outputSchema: Type.Object({ nextGrid: GridStateSchema }),
  execute: ({ grid, direction }) => ({ nextGrid: moveWithPush(grid, direction) }),
};
```

**推链只允许一层**（R1.5）。判断顺序：目标格越界/墙 → 停；目标格无箱 → 走；目标格有箱且箱后是墙/越界/另一箱 → 停；箱后无箱且不越界不撞墙 → 走 + 推。

### 3. 胜利判定块 `src/blocks/win-check.ts`（AFP 纯机制）—— **新块**

```ts
// 纯函数：胜利 = 所有箱子都位于目标格上。
// 用坐标集合等价性判断：boxes 全集 ⊆ goals 全集（且已在 parseLevel 层保证箱数=目标数，
// 故这里的 "⊆" 与 "=" 等价，无需再算基数）。
export function checkWin(grid: GridState): boolean;

export const winCheckBlock: BlockDef = {
  name: "win-check",
  inputSchema: Type.Object({ grid: GridStateSchema }),
  outputSchema: Type.Object({ won: Type.Boolean() }),
  execute: ({ grid }) => ({ won: checkWin(grid) }),
};
```

**返回布尔而非 GridState**：win 是纯粹的派生态，不改地图；这样即使将来渲染或调用方读取，也可直接用 `context.won` 无需二次解构。

### 4. 组合注册函数 `src/blocks/register.ts`（AFP 纯机制骨架）—— **新增**

```ts
export function createPushRegistry(): BlockRegistry;
// 内部注册 move-with-push + win-check。
// createWalkRegistry（MVP-1）保留不删——走路装配流仍能跑。
```

### 5. 输入转接件 `src/adapters/input-adapter.ts`（Adapter · 防腐层）—— **完全复用 MVP-1**

`keyToDirection` 一字不改。除了方向键之外的键返回 `null`——包括即将新增的重开键 `R/r`；重开动作**不走装配流**（它不是"下一回合"，而是"重装载关卡"），转接件不掺和。

### 6. 装配流配置 `src/configs/push.jsonc`（AFP 配置 · Godot Resource）—— **新增**

```jsonc
{
  "flowName": "sokoban-push",
  "steps": [
    {
      "block": "move-with-push",
      "inputMap": { "grid": "grid", "direction": "direction" }
    },
    {
      "block": "win-check",
      "inputMap": { "grid": "nextGrid" }   // ← 承接 step1 摊平出的 nextGrid
    }
  ]
}
```

两条 inputMap 都是纯字段重命名，未触及 Q-024；没有条件分支/循环，守住"配置图静态可枚举"红线。`walk.jsonc`（MVP-1）保留不动，作为走路场景的对照资产。

### 7. 推箱驱动 `src/driver.ts`（纯 AFP，调用方持状态）—— **扩展 MVP-1**

`stepWalk`（MVP-1）保留。新增 `stepPush`——只在返回值上加 `won`：

```ts
export interface PushResult {
  readonly nextGrid: GridState;
  readonly won: boolean;
}
export function stepPush(
  config: FlowConfig, registry: BlockRegistry, grid: GridState, direction: Direction
): PushResult;
//   assemble(config, registry, { grid, direction })
//   → { nextGrid: context.nextGrid, won: context.won }
// 失败（Ajv 拦下非法方向等）抛 Error；调用方保留旧 grid、状态不前进。
```

**用一个 `stepPush` 返 `{nextGrid, won}` 而非拆两次调用**：装配流本身就是原子的（引擎单趟），暴露给调用方的接口也保持原子。

### 8. 渲染 `src/render.ts`（非 AFP 承诺范围 · 不打 @paradigm）—— **扩展 MVP-1**

```ts
export interface RenderOptions { readonly won?: boolean; }

// 把 GridState 画成 DOM 文本网格 + 可选胜利提示 DOM。
export function render(grid: GridState, container: HTMLElement, opts?: RenderOptions): void;
```

**每格字符优先级**（同一格多态取上）：`+` > `@` > `*` > `$` > `.` > `#` > `' '`

- `+` 玩家在目标：`grid.player == 该坐标 && 该坐标 ∈ goals`
- `@` 玩家（不在目标）：`grid.player == 该坐标`
- `*` 箱子在目标：该坐标 ∈ boxes && 该坐标 ∈ goals
- `$` 箱子（未就位）：该坐标 ∈ boxes
- `.` 目标（未占）：该坐标 ∈ goals
- `#` 墙：该坐标 ∈ walls
- `' '` 地板：其它

**胜利提示**：`won === true` 时在 container 内追加一个独立的 `<div class="sokoban-win">` 元素（内容如"🎉 你赢了！按 R 重开"）——不塞进网格文本，读起来更清楚（R4.3）。`won === false / undefined` 时不出现该元素。

**渲染仍是全量替换**（`replaceChildren`）：重渲染永远反映最新 `GridState` + 最新 `won`，无残留。

### 9. 浏览器入口 `src/main.ts`（**打 `@paradigm NON-AFP: external-control-flow`**）—— **扩展 MVP-1**

`main.ts` 承接三条**非 AFP 控制流**——回合门控（`won → 拒绝方向键`）、终局输入拦截、`R/r` 重开——它们是"跨回合的时间维度状态 + 事件级条件分支"，是本 MVP 最重要的非 AFP 边界决定，必须按 afp-core.md「范式混合标记约定」在文件头部打标记：

```ts
/**
 * @paradigm NON-AFP: external-control-flow
 * @reason 回合门控（won → 拒绝方向键）、终局输入拦截、R/r 重开三条控制流是"跨回合的时间维度状态 + 事件级条件分支"，
 *         用 AFP 数据流表达要么塞进配置的条件分支（违反"配置图静态可枚举"红线），
 *         要么把主循环推进引擎（违反 MVP-1 已钉的 K-LOOP 结论）。
 *         把它留在浏览器 keydown 回调里、用 currentGrid + won 两个模块级可变引用承载，是最简解。
 * @afp-debt 验证期结论：AFP 数据流不承担回合控制流是**合理边界**，非 AFP 在此处胜出。
 *          本 debt 不打算偿还——它是 D-013 目标的正面证据，将进 docs/paradigm-comparison.md。
 *          若将来门控扩到"暂停/多存档/回放"，需重评升级为 reducer / 状态机再重打标记。
 */

// 装载：levelText 来自 level-push-1.txt（MVP-2 发表关；MVP-1 走路对照资产 level-walk-only.txt 由 walk.jsonc 单测/回归路径消费，不走 main.ts）
const config = parseJsonc<FlowConfig>(pushConfigRaw);
const registry = createPushRegistry();
let currentGrid: GridState = parseLevel(levelText);
assertPublishableLevel(currentGrid);   // 发表关额外硬约束：≥2 箱 / ≥2 目标 / 开局非通关；命中即抛 Error，页面不渲染
let won = false;
render(currentGrid, container);

// 外部主循环 + 胜利门控 + 重开
window.addEventListener("keydown", (event) => {
  // 重开：R/r —— 不是"下一回合"，是"重装载"，绕开装配流
  if (event.key === "r" || event.key === "R") {
    currentGrid = parseLevel(levelText);
    // assertPublishableLevel 只需在初始装载期跑一次；重开走同一份 levelText，无需重复断言
    won = false;
    render(currentGrid, container);
    return;
  }

  // 胜利门控：R5.2 —— 控制流留在浏览器侧，不进引擎
  if (won) return;

  const direction = keyToDirection(event.key);
  if (!direction) return;
  event.preventDefault();

  let result;
  try {
    result = stepPush(config, registry, currentGrid, direction);
  } catch (err) {
    // 装配流失败（例如引擎 Ajv 拦下非法 direction）——保留旧 currentGrid/won，控制台记录，不整页崩
    console.error("[sokoban] stepPush failed:", err);
    return;
  }
  currentGrid = result.nextGrid;
  won = result.won;
  render(currentGrid, container, { won });
});
```

**门控是布尔判断而非独立状态机，但它承载的是回合级控制流**：`won` 只有两个态、迁移只有"通关 → 锁定"和"重开 → 解锁"两条显式分支——不需要 reducer / 状态机的抽象成本。但它落在浏览器侧承担"引擎装配流之外的时间维度控制"这一角色，是本 MVP 关键的范式取舍——因此打 `@paradigm NON-AFP: external-control-flow` 标记，记入 D-014 `docs/paradigm-comparison.md` 的正面证据（"AFP 数据流不承担回合控制流是合理边界，非 AFP 在此处胜出"）。判据依 afp-core.md：读者会不会因为不打标记而误以为这段是纯 AFP 数据流？会 → 标记。

**若将来门控扩到"暂停/多存档/回放"**（需要跨回合记忆的多态迁移），按约定升级为 reducer / 状态机并重打标记（`@paradigm NON-AFP: state-machine`）；本设计不预造。

### 10. index.html（脚手架）—— **微改 MVP-1**

- 标题从 "Sokoban MVP-1 · 网格走路" → "Sokoban MVP-2 · 推箱 + 胜利判定"
- 说明栏加一行 "按 R 重开"、"把所有 `$` 推到 `.` 上（变成 `*`）即胜利"
- 新增 `.sokoban-win` 简朴样式（醒目色 + 大字，纯 CSS，够看清就行）

### 11. 关卡文件（数据）—— **拆两个独立文件，MVP-1 关卡不共享、不污染**

MVP-1 的 `src/levels/level-1.txt` 是纯走路关，字符集里 `.` = 地板；MVP-2 引入 Sokoban 传统字符集后 `.` = 目标格、空格 = 地板——两种语义直接冲突。若原地覆盖 `level-1.txt` 并改 `parseLevel` 字符语义，MVP-1 的走路回归资产（`walk.jsonc` / `assemble-walk.test.ts` / `level-1.txt`）会站在被污染的语义上跑。因此本 MVP **不覆盖 MVP-1 的关卡文件**，改用两个独立文件承载两个 MVP 的关卡语义：

**（a）MVP-1 关卡重命名 + `.` → 空格替换**：把 `src/levels/level-1.txt` 重命名为 `src/levels/level-walk-only.txt`，并把其中的 `.` 全部替换为空格。语义等价性由此保证——新字符集下 `.` = 目标格（会误增 goals，破坏 MVP-1 走路语义）、空格 = 地板（与 MVP-1 中"`.` 与空格都是地板"完全等价）；替换后新 `parseLevel` 装出的 `GridState` 里 `goals = []`、`boxes = []`（因此 base parseLevel 契约必须允许 0=0 合法，见 §1），与 MVP-1 走路语义无差。`walk.jsonc` 的装配拓扑**不动**；MVP-1 的 `walk.jsonc` 里对关卡文件的引用（若有）、`tests/assemble-walk.test.ts` 中对旧文件名的引用、`index.html` 若引用则一并改到 `level-walk-only.txt`。MVP-1 spec 已 resolved 的走路语义结论与此改名不冲突——这只是把"MVP-1 落地物与 MVP-2 落地物在同一实验目录里共处"这件事的物理路径整理清楚。

**（b）MVP-2 发表关新建独立文件** `src/levels/level-push-1.txt`（Sokoban 字符集，至少 2 箱 + 2 目标 + 可通关，由 `assertPublishableLevel` 装载期守住前两条），示意如下：

```
##########
#@       #
# ##.    #
#    #   #
# ## # # #
#  #  $# #
# ######.#
#   $    #
##########
```

（示意，最终关面由 tasks 阶段落地时手工调平衡；MVP-3 才是"5 关关卡集"，MVP-2 只要一关能玩通到胜利。）

**分层动机重述**：base `parseLevel` 保持通用装载契约（允许 0=0，承接 `level-walk-only.txt`），发表关额外的"至少 2 箱 2 目标 + 开局非通关"硬约束由 `main.ts` 装载后显式调用 `assertPublishableLevel(currentGrid)` 二次校验（见 §1 与 §9）——一份 `parseLevel` 代码支撑两个 MVP 的关卡语义，避免让 `parseLevel` 内部塞条件分支支持两种"`.` 语义"（那才是"算法入配置"式的坏做法）。

### 12. REPORT.md（追加 MVP-2 段）—— **追加**

MVP-1 REPORT 保留不动，末尾追加"MVP-2 段"，内容包括：

- 推箱 + 胜利判定通关的真人浏览器验收记录（截图 / 动图）
- 装配流两步（move-with-push → win-check）的运行轨迹样例
- 方案 A 在 boxes 加入后的**再复审**（体量观察点：boxes 数量的 JSON 增量、可读性、AI 推测）——若仍未触发复审，明说"沿用 A"；若触发，按 exp04 预置出口评估方案 C
- 引擎缺口 / 非 AFP 范式的如实记录：`grep "@paradigm" src/` 预期**恰有 1 处命中且在 `src/main.ts`**（`NON-AFP: external-control-flow`，承接回合门控 / 终局拦截 / R/r 重开三条控制流，含 `@reason` + `@afp-debt`），业务/装配层零命中——这是 D-014 `paradigm-comparison.md` 的正面证据（"AFP 数据流不承担回合控制流是合理边界，非 AFP 在此处胜出"）。若实现期额外冒出未预见的非 AFP 范式则按约定标记并如实登记；若门控被迫升级为 reducer / 状态机则改标 `@paradigm NON-AFP: state-machine` 并在 REPORT 里说明触发条件。
- **发表前 checklist 打钩状态**——按 `docs/paradigm-validation-sokoban-roadmap.md` D-014 逐项确认；条目**只引用不复制**（守 SSOT）。

## Data Models

```ts
interface Position { x: number; y: number; }

// MVP-2 GridState（相对 MVP-1 增量：goals + boxes）
interface GridState {
  width: number;
  height: number;
  walls:  Position[];   // 静态
  goals:  Position[];   // 静态（NEW）
  player: Position;     // 动态
  boxes:  Position[];   // 动态（NEW）
}

type Direction = "up" | "down" | "left" | "right";

// 方向增量（沿用 MVP-1）
const DELTA: Record<Direction, Position> = {
  up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
};

// 块 I/O（引擎 Ajv 校验）
//   move-with-push:  in { grid: GridState, direction: Direction } → out { nextGrid: GridState }
//   win-check:       in { grid: GridState }                       → out { won: boolean }

// 引擎上下文流转（assemble 内部，已有机制）
//   initialInput { grid, direction }
//     → move-with-push → out { nextGrid }         → 摊平进 context.nextGrid
//     → win-check(inputMap { grid: "nextGrid" }) → out { won }  → 摊平进 context.won
```

### 派生态而非独立字段

`isBoxOnGoal` 是**函数**、不是 `GridState` 里的字段：

- **单一真相**：状态里只存"箱子在哪 / 目标在哪"两个坐标集合；就位与否由坐标匹配派生。
- **避免漂移**：如果加一个 `boxOnGoal: Position[]` 字段，`move-with-push` 每次要同步更新它、`parseLevel` 要计算它——多一份"来源",多一份错位机会。
- **性能不成问题**：MVP-2 一关箱子数 ≤ 10 量级，`boxes.some(...)` 线性查找可忽略；MVP-3 有更多关卡时再评估。这与 MVP-1 决定用 `Position[]` 而非 `Set` 的理由一脉相承（配置即图/状态即可见数据）。

### 方案 A 在 GridState 变大后的物理体现

MVP-1 REPORT 实测：10×9 网格 + 51 墙的 `initialInput` 紧凑 JSON ≈ 799 字符。MVP-2 在此基础上：
- 加 `goals: Position[]`（假设 2–4 个目标 ≈ +30 字符）
- 加 `boxes: Position[]`（假设 2–4 个箱子 ≈ +30 字符）

即每回合 `initialInput` 约增至 **~860 字符**，仍在 1 KB 量级。**配置那一行 `"grid":"grid"` 依旧一行**——变重的仍是运行期数据搬运，不是配置文本。REPORT 追加段需实测这个值并对比 MVP-1，作为方案 A 复审的定量证据。

## Error Handling

- **非法方向**：Ajv 在 `assemble` 入口按 `DirectionSchema` 拦截 → `stepPush` 抛错。实践中已被 `keyToDirection` 过滤为 `null`，通常到不了引擎。
- **越界 / 撞墙 / 撞不动的推箱**：**不是错误**，是合法游戏规则。`moveWithPush` 返回"角色与箱子都停在原格"的 `GridState`，`assemble` 成功。这与 MVP-1 走路撞墙不动同源。
- **箱子被推到墙 / 越界 / 另一箱**：同上，返回原状态。
- **一次推两箱**：不允许（R1.5）。`moveWithPush` 里显式判"箱后是另一个箱子 → 停"。
- **胜利判定后仍收到方向键**：`main.ts` 的 `won` 门控直接 `return`，装配流不触发、状态不前进（R2.3）。
- **重开键 R/r**：`main.ts` 直接调 `parseLevel(levelText)` 重装载，`won` 复位为 `false`，绕开装配流（R2.3 的"加载新关卡或重置"分支）。
- **parseLevel 畸形输入**：零个/多个玩家、箱子数≠目标数——`parseLevel` 抛 `Error`，`main.ts` 的模块图加载期即失败（fail-fast）；此时页面不渲染，浏览器控制台可见错误。严格静态校验（更精确的行列定位、边界闭合等）留 MVP-3。
- **发表关未达门槛**：`level-push-1.txt` 若不满足 `boxes.length >= 2` / `goals.length >= 2` / `checkWin(initial) === false`——`assertPublishableLevel` 抛 `Error`，`main.ts` 装载期失败（fail-fast），页面不渲染。base `parseLevel` 允许 0=0（承接 `level-walk-only.txt`），发表关的三条硬约束不放进 base 契约，由 `main.ts` 显式调用二次校验。
- **确定性**：`moveWithPush` / `checkWin` / `parseLevel` 全部纯函数，不读时钟 / 不随机 / 不调 AI——同输入同输出，由属性测试守。
- **失败不前进**：若装配流失败（理论上的非法方向），`stepPush` 抛错——如 §9 示例所示，`main.ts` 在 `stepPush` 外围以 try-catch 保留旧 `currentGrid`/`won`、控制台记录，不整页崩。

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

> 本节由 prework 分析导出。Property Reflection 已做以下合并/降级，避免重复守同一条不变量：
>
> - **合并**：AC 1.2（一趟确定性）与 AC 1.6（方案 A 块无跨回合记忆）在物理上同源——两者都要求 `nextGrid/won` 只由当回合 `(grid, direction)` 决定、块内无残留状态。合并为 Property 2（用交叉输入的形式一并覆盖）。
> - **合并**：AC 3.1 / 4.1 / 4.2（render 字符正确 + 就位态区分 + 各角色区分）都是"字符优先级表正确性"的不同切面——用同一个属性（对随机 GridState 断言 DOM 每格字符符合优先级表）一并覆盖。
> - **降级**：AC 3.3（回合后 DOM 反映最新 grid）被 Property 8 的字符正确性 + `main.ts` 的一句 `render(...)` 蕴含，仅补一条 EXAMPLE（jsdom 集成）验证 stepPush → render 集成路径通即可，不单列 Property。
> - **新增（未直接对应单条 AC）**：Property 3 "网格不变式 + 箱子守恒"——把"玩家/箱子在界内、不重墙、箱子之间不重叠、静态地形恒定、箱子数守恒"打包成一条聚合不变式，是所有回合都应满足的通用性质，比逐 AC 单独守更廉价、更能抓漏洞。

### Property 1: 装载正确

*For any* 合法的 Sokoban ASCII 关卡（恰一个玩家、箱数=目标数（**含 0=0 特例，承接 `level-walk-only.txt`**）、字符集在 `#/./ /@/$/*/+` 内），`parseLevel` 输出的 `GridState` 满足：`walls`/`goals`/`boxes` 集合与 ASCII 中对应字符（含 `*` 同时进 boxes+goals、`+` 同时定位 player+goals）的坐标位置一一对应；`width` = 最长行长度、`height` = 行数；`player` = 唯一 `@` 或 `+` 的坐标。

**Validates: Requirements 1.1**

### Property 2: 一回合确定性 + 块无残留状态（方案 A 纯性）

*For any* 合法 `GridState` 与合法 `Direction` 序列 `[d1, d2, ..., dn]`，用同一 `push.jsonc` + 同一 `createPushRegistry()` 出的 `registry`：

- (a) 同一 `(grid, direction)` 跑两遍 `stepPush`，两次结果 `(nextGrid, won)` 逐项相等；
- (b) 交叉喂入 `stepPush(cfg, reg, gridA, d)` → 保存结果 → 中间穿插 `stepPush(cfg, reg, gridB, d)` → 再次 `stepPush(cfg, reg, gridA, d)`，前后两次 gridA 的结果 `(nextGrid, won)` 恒等（块无跨回合记忆）；
- (c) 无时钟 / 无随机 / 无 AI —— 上述 (a)(b) 在任意机器 / 任意时间点跑均成立。

**Validates: Requirements 1.2, 1.6**

### Property 3: 网格不变式 + 箱子守恒

*For any* 合法 `GridState` 与合法 `Direction`，`moveWithPush(grid, direction)` 输出的 `nextGrid` 满足：

- (a) `player` 恒在 `[0,width) × [0,height)` 界内、且 `player` 坐标不与任何 `walls` 坐标重合；
- (b) 每个 `boxes[i]` 恒在界内、不与任何 `walls` 坐标重合、且 `boxes` 内部两两不重合（无两个箱子挤同一格）；
- (c) `nextGrid.width/height/walls/goals` 与 `grid` 恒等（静态地形跨回合不变）；
- (d) `nextGrid.boxes.length === grid.boxes.length`（箱子守恒：既不创造也不毁灭）；
- (e) `nextGrid.player` 不与 `nextGrid.boxes` 中任何箱子同格（推箱后玩家与箱一前一后，绝不同格）。

**Validates: Requirements 1.3, 1.4, 1.6**

### Property 4: 推可走时前进

*For any* 合法 `GridState` 与合法 `Direction`，若"玩家前方一格 = `boxes` 中某个箱、且该箱前方再一格既不越界、不在 `walls`、也不在 `boxes` 中"：`moveWithPush` 后玩家坐标 = 原玩家 + Δ(direction)、该箱新坐标 = 原箱 + Δ(direction)、其余 `boxes` 与静态地形不变。

**Validates: Requirements 1.3**

### Property 5: 推不动时都停

*For any* 合法 `GridState` 与合法 `Direction`，若"玩家前方一格 = `boxes` 中某个箱、且该箱前方再一格越界 / 在 `walls` / 在其他 `boxes` 之一中"（三个子情况的任意一个）：`moveWithPush` 后玩家坐标不变、`boxes` 集合不变、静态地形不变。

**Validates: Requirements 1.4, 1.5**

### Property 6: 走路（前方无箱）规则在扩展 GridState 上仍成立

*For any* 合法 `GridState` 与合法 `Direction`，若"玩家前方一格既不在 `walls` 也不在 `boxes` 中且不越界"：`moveWithPush` 后玩家前进一格、`boxes` 不变、静态地形不变。若前方越界或在 `walls`：玩家不动、`boxes` 不变、静态地形不变。

**Validates: Requirements 1.3**（继承 MVP-1 R1.4/R1.5 在扩展 GridState 下的成立）

### Property 7: 胜利判定 = 所有箱子在目标格

*For any* 合法 `GridState`，`checkWin(grid) === true` 当且仅当 `∀ b ∈ grid.boxes: ∃ g ∈ grid.goals with g.x === b.x ∧ g.y === b.y`（每个箱子的坐标都能在 `goals` 里找到匹配）。在 `parseLevel` 已保证"箱数=目标数"的前提下，该等价条件与"boxes 全集与 goals 全集在坐标上相等"等价。

**Validates: Requirements 2.1**

### Property 8: 渲染字符优先级正确

*For any* 合法 `GridState`，`render(grid, container)` 后 DOM 内 `<pre class="sokoban-grid">` 文本的第 `y` 行第 `x` 列字符满足优先级表：

- `player == (x,y) ∧ (x,y) ∈ goals` → `+`
- 否则 `player == (x,y)` → `@`
- 否则 `(x,y) ∈ boxes ∧ (x,y) ∈ goals` → `*`
- 否则 `(x,y) ∈ boxes` → `$`
- 否则 `(x,y) ∈ goals` → `.`
- 否则 `(x,y) ∈ walls` → `#`
- 否则 → `' '`（地板）

**Validates: Requirements 3.1, 4.1, 4.2**

### Property 9: 发表关满足 publication-gate 硬约束（EXAMPLE 级）

具体断言（EXAMPLE 级，非全称量化——仅对发表关文件 `level-push-1.txt`）：对 `parseLevel(levelPushRaw)`（`levelPushRaw` 由 Vite `?raw` import 从 `../src/levels/level-push-1.txt?raw` 获得，与 `main.ts` 同套装载路径，避开 vitest cwd 依赖）装出的 `initialGrid`，`assertPublishableLevel(initialGrid)` **不抛错**，即三条硬约束同时成立：

- `initialGrid.boxes.length >= 2`
- `initialGrid.goals.length >= 2`
- `checkWin(initialGrid) === false`（开局非通关态）

任一失败 → `assertPublishableLevel` 抛 `Error`、`main.ts` 装载期失败。同时以三份**故意畸形**的关卡文本（少于 2 箱 / 少于 2 目标 / 开局即通关）作为反例，断言 `assertPublishableLevel` 命中对应约束时抛错，并在错误消息里能看出命中的是哪一条。

**Validates: Requirements 2.4**（发表闸口"单关可从开局在浏览器玩到通关"的最低门槛在装载期即被守住）

## Testing Strategy

> 遵守 `.kiro/steering/status-sync.md`：任何"通过"断言必须有同轮真实测试输出。守 `test-and-acceptance.md` 门禁三项（typecheck / 相关测试 / 端到端有可运行入口的单元跑一趟）。

**双层测试 · 属性 + 例子 · 分工**

- **属性测试（fast-check，≥100 iterations）**：守 Property 1–8。每条属性一个测试，测试内加注释 `// Feature: sokoban-mvp-2-push, Property N: <property title>` 建立与 design 的追溯。
- **例子测试（vitest）**：守具体分支、边界、集成路径与 UI 行为。
- **jsdom**：渲染与浏览器门控相关的例子测试（沿用 MVP-1 pattern）。
- **端到端**：一条完整通关方向序列驱动 `stepPush` 达 `won=true`，作 EXAMPLE 存进 `assemble-push.test`。
- **真人浏览器验收**：`npm run dev` 起服务，走完通关流程 + 通关后按方向键无反应 + R 重开 + 再玩一次，截图/动图记入 REPORT 追加段（浏览器可玩断言按 status-sync 铁律 1 需有同轮真实运行佐证）。

**属性测试实现约束**（与 MVP-1 一致）：

- 库：fast-check（`experiments/exp06-sokoban/` 已装）。
- 最小迭代：≥100（fast-check 默认即可；生成器复杂时不下调）。
- 每个属性测试的标签注释指向 design 中对应 Property。
- Ajv 校验、TypeBox schema 与 MVP-1 同一套流程复用（无新增契约基础设施）。

**测试文件与属性映射**：

| 测试文件 | 类型 | 守的 Property / AC |
| :--- | :--- | :--- |
| `parse-level.test.ts`（改） | PROPERTY + EXAMPLE | Property 1（含 0=0 合法特例）+ 具体 `*`/`+`/畸形关（缺角色 / 多角色 / 箱数≠目标数）例子 + Property 9：`assertPublishableLevel` 对发表关的三条硬约束校验（正例 `level-push-1.txt` + 三份故意畸形反例：<2 箱 / <2 目标 / 开局即通关） |
| `move-with-push.test.ts`（新） | PROPERTY + EDGE_CASE | Property 3 / 4 / 5 / 6 + 并排两箱不推、拉动作向的箱不动、边界推 |
| `win-check.test.ts`（新） | PROPERTY + EXAMPLE | Property 7 + "全在目标"/"差一个"/"空 boxes" 具体例子 |
| `determinism.test.ts`（改） | PROPERTY | Property 2（含交叉输入 (a)(b)(c) 三段） |
| `invariants.test.ts`（改） | PROPERTY | Property 3 的聚合不变式在方向序列下持续成立 |
| `assemble-push.test.ts`（新） | EXAMPLE | 装配流两步端到端（含通关一步）+ AC 1.2 在引擎上的贯通 |
| `render.test.ts`（改） | PROPERTY + EXAMPLE | Property 8 + 胜利提示 DOM 出现/消失例子（AC 2.2 / 4.3）+ 就位态 `$ → *` 前后对比 EDGE_CASE |
| `win-lockout.test.ts`（新） | EXAMPLE（jsdom） | AC 2.3：通关后 keydown 不触发装配流；R 键重开、`won` 复位、方向键再度生效 |
| `input-adapter.test.ts` / `jsonc.test.ts` / `move-step.test.ts` / `assemble-walk.test.ts` | 沿用 MVP-1 | 回归 |

**不写自动化测试的项目**（SMOKE，靠代码评审 + 真人验收）：

- AC 3.4 / 4.4 · "可见性在浏览器画面、非仅控制台、渲染无美术" —— 代码评审 render.ts 无 console 主渲染路径、无 img/svg 美术资产。
- AC 5.1 · "推箱逻辑用纯装配块 + 配置表达" —— 代码评审 + 靠 Property 2 间接守（不纯的块过不了）。
- AC 5.2 · "控制流在浏览器侧、引擎不改" —— 代码评审 `push.jsonc` 无条件/循环 step、`main.ts` 承接门控、`engine/` 零 diff。
- AC 5.3 · "非 AFP 范式打 `@paradigm`" —— `grep "@paradigm" src/` 扫描预期**恰有 1 处命中且在 `src/main.ts`**（含 `@reason` + `@afp-debt` 两个子字段），承接本 MVP 最重要的非 AFP 边界（回合门控 + 终局拦截 + R/r 重开，详见 §9）；业务/装配层（`src/blocks/**`、`src/configs/**`、`src/adapters/**`、`src/grid.ts`、`src/driver.ts`）零命中即为达标。若命中数或位置与预期不符，写进 REPORT 追加段并追根究底（多命中：多打了？漏了 `@reason`？；少命中或位置不对：main.ts 头部标记被误删？）。
- AC 5.4 · "渲染/脚手架/引擎不打标记" —— `src/render.ts`、`index.html`、`vite.config.ts`、`engine/**` 均零 `@paradigm` 命中，同上 grep + 代码评审。

**方案 A 复审再观察点（非 pass/fail，进 REPORT 追加段）**：

按 MVP-1 REPORT 建立的三个观察点框架，在 boxes/goals 加入后重跑一遍：

1. **体量**：`initialInput` 紧凑 JSON 字符数（相对 MVP-1 的 ~800 增加多少？boxes/goals 每个坐标对象约 15 字符，2+2 目标+2+2 箱 ≈ +60 字符）
2. **可读性**：`push.jsonc` 的接线读起来是否仍清晰？两条 inputMap 都是纯重命名，仍是"一望即知"
3. **AI 推测**：若让 AI 照此 pattern 产新关卡（MVP-3 的核心场景），"箱数=目标数"约束是否增加出错风险？（推测，不下结论，留交付物 A 实测）

结论按 exp04 REPORT 预置触发条件裁定：**未触发**则明写"沿用 A"；**触发**则按方案 C 出口评估——但设计预判 MVP-2 尺度下不会触发。

## 落地结构（`experiments/exp06-sokoban/` 的 MVP-2 增量）

> exp06 承载 MVP-1 ~ 4；本 spec 只落地推箱 + 胜利相关的**增量**文件，MVP-1 的走路资产保留不动。

```
experiments/exp06-sokoban/
├── package.json               # 沿用（无新依赖）
├── tsconfig.json              # 沿用
├── vite.config.ts             # 沿用
├── index.html                 # 微改：标题 + 说明 + .sokoban-win 样式
├── src/
│   ├── grid.ts                # 【改】GridState 加 goals+boxes；parseLevel 支持 Sokoban 字符集 + 允许 0=0；新增 isBoxOnGoal + assertPublishableLevel
│   ├── jsonc.ts               # 沿用
│   ├── blocks/
│   │   ├── move-step.ts       # 沿用（MVP-1 走路对照）
│   │   ├── move-with-push.ts  # 【新】走+推合体块 + moveWithPush 纯算法
│   │   ├── win-check.ts       # 【新】胜利判定纯块 + checkWin
│   │   └── register.ts        # 【新】createPushRegistry（注册 move-with-push + win-check）
│   ├── adapters/
│   │   └── input-adapter.ts   # 沿用（keyToDirection 一字不改）
│   ├── configs/
│   │   ├── walk.jsonc         # 沿用（MVP-1 走路对照）
│   │   └── push.jsonc         # 【新】move-with-push → win-check 装配流
│   ├── levels/
│   │   ├── level-walk-only.txt   # 【改自 level-1.txt】重命名 + `.` 全部替换为空格；MVP-1 走路对照资产
│   │   └── level-push-1.txt      # 【新】MVP-2 发表关（Sokoban 字符集，≥2 箱 + ≥2 目标 + 可通关，由 assertPublishableLevel 装载期守住）
│   ├── driver.ts              # 【改】保留 stepWalk；新增 stepPush 返 {nextGrid, won}
│   ├── render.ts              # 【改】新字符集 + 就位态区分 + 胜利提示 DOM
│   └── main.ts                # 【改】装载 push.jsonc + level-push-1.txt；调 assertPublishableLevel；胜利门控；R/r 重开；stepPush 外围 try-catch；头部打 @paradigm NON-AFP: external-control-flow
├── tests/
│   ├── parse-level.test.ts        # 【改】覆盖新字符集 + 箱数=目标数校验（含 0=0 合法）+ assertPublishableLevel 三条硬约束（正例 + 三个反例，Property 9）
│   ├── move-step.test.ts          # 沿用
│   ├── move-with-push.test.ts     # 【新】走 / 推 / 各类阻挡的表驱动
│   ├── win-check.test.ts          # 【新】全在目标上=win；任一未就位=not win；空箱子边界
│   ├── determinism.test.ts        # 【改/新】push 版本：随机方向序列跑两遍逐项相等
│   ├── invariants.test.ts         # 【改/新】不变式：玩家/箱子恒在界内不重墙、静态地形恒定、箱子数守恒
│   ├── input-adapter.test.ts      # 沿用
│   ├── jsonc.test.ts              # 沿用
│   ├── assemble-walk.test.ts      # 【改路径引用】MVP-1 走路装配流回归；关卡引用从 level-1.txt 改到 level-walk-only.txt
│   ├── assemble-push.test.ts      # 【新】push 装配流端到端（含通关一步）
│   ├── render.test.ts             # 【改】覆盖 `$`/`*`/`+`/`.`/胜利提示 DOM
│   └── win-lockout.test.ts        # 【新】jsdom 中模拟通关后 keydown 不触发回合
└── REPORT.md                       # 【追加】MVP-2 段（含发表前 checklist 状态）
```

## Requirements 覆盖映射

| 需求 AC | 设计落点 |
| :--- | :--- |
| R1.1 装载含箱子+目标格的初始网格 | `parseLevel` 新字符集（`#/./ /@/$/*/+`）+ `parse-level.test`（含 `*`/`+` 交叉） |
| R1.2 确定性 `f(grid, direction)` 一趟装配 | `moveWithPush` + `checkWin` 纯函数 + `push.jsonc` 两步 + `stepPush` + `determinism.test` |
| R1.3 推：箱前是地板/目标 → 箱走、人跟 | `moveWithPush` 分支 + `move-with-push.test` |
| R1.4 推：箱前是墙/另一箱 → 都停 | `moveWithPush` 分支 + `move-with-push.test` |
| R1.5 一次只推一个、不拉 | `moveWithPush` 只判"箱前一格"、无逆向逻辑 + `move-with-push.test` 覆盖并排两箱 |
| R1.6 方案 A 全量穿透 + 块保持纯 | `push.jsonc` 显式接线 `grid` + `stepPush` + REPORT 追加段实测数据 |
| R2.1 全部箱子在目标 → 判定完成 | `win-check` 块 + `win-check.test` |
| R2.2 通关后浏览器可见胜利提示 | `render` 新增 `.sokoban-win` DOM + `render.test` |
| R2.3 通关后不响应方向键、可加载新关卡 / 重置 | `main.ts` `won` 门控 + `R/r` 重开 + `win-lockout.test` |
| R2.4 单关可从开局在浏览器玩到通关 | 落地物 `level-push-1.txt` + `assertPublishableLevel` 装载期校验（≥2 箱 / ≥2 目标 / 开局非通关）+ 真人浏览器验收（REPORT 追加段） |
| R3.1 浏览器加载显示初始网格（墙/地板/目标/玩家/箱子） | `index.html` + `render` 新字符集 + `main.ts` 装载 |
| R3.2 方向键 / WASD → 一次回合 | `keyToDirection`（沿用）+ `main.ts` `keydown` 处理器 |
| R3.3 回合后重渲染，移动当场可见 | `main.ts` `render(...)` 每回合调用 + jsdom 回归 `assemble-push.test` |
| R3.4 可见性体现在浏览器画面、非仅控制台 | `render` DOM 输出 + REPORT 追加段的真人浏览器验收 |
| R4.1 墙/地板/目标/玩家/箱子可区分字符 | `render` 字符优先级表 + `render.test` |
| R4.2 就位箱子（`*`）与未就位（`$`）视觉可区分 | `render` 字符优先级 + `render.test` |
| R4.3 胜利提示可见 | `render` `.sokoban-win` DOM + `render.test` + 真人验收 |
| R4.4 朴素渲染、无美术 | DOM `<pre>` 文本网格 + 简朴 CSS |
| R5.1 推箱逻辑纯块 + 配置接线 | `move-with-push` / `win-check` 块 + `push.jsonc` 只做重命名 |
| R5.2 控制流留浏览器侧、不推进引擎 | `main.ts` `won` 门控 + R/r 重开、引擎零改动 |
| R5.3 非 AFP 范式打 `@paradigm` | `main.ts` 打 `@paradigm NON-AFP: external-control-flow`（含 `@reason` + `@afp-debt`，承接回合门控 / 终局拦截 / R/r 重开三条非 AFP 控制流）；业务/装配层（`src/blocks/**`、`src/configs/**`、`src/adapters/**`、`src/grid.ts`、`src/driver.ts`）零标记 |
| R5.4 渲染 / 脚手架 / 引擎不打标记 | `render.ts` / index.html / Vite 脚手架 / 引擎 均不打标记；`main.ts` 例外——它承载非 AFP 控制流，见 R5.3 |
| **发表闸口**（需求文首 + 交付物） | REPORT 追加段按路线图 D-014"发表前 checklist"逐项确认，只引用不复制条目 |

## 设计阶段未决、留给 Tasks/实现的问题

- **`level-push-1.txt` 的具体关面**：设计只约束"至少 2 箱 + 2 目标 + 可通关 + 尺寸够玩"（前两条由 `assertPublishableLevel` 装载期守住），具体地图布局由 tasks 阶段落地时手工调平衡；不预设"多难"。
- **`.sokoban-win` 具体样式**：够醒目就行，色与字号在 tasks 阶段就近调；不做美术。
- **胜利提示的位置**：设计定"独立 DOM 元素、不塞网格里"，具体挂在 container 之内还是之外由 tasks 决定（若挂之内注意 `render` 全量替换的清空语义）。
- **重开键**：设计定 `R/r`；若与后续输入映射冲突再评估。当前实现 `keyToDirection` 里 R 会返回 `null`（不触发回合），门控优先级足够。
- **发表前 checklist 中"文章"一项**：`docs/paradigm-comparison.md` 骨架落地时机由路线图整体推进，非本 MVP 的验收前置。REPORT 追加段只需勾选"工程与门面"两栏。
- **方案 A 是否触发复审**：设计预判"不触发"（配置未变重），实测由 REPORT 追加段裁定；若触发，按 exp04 REPORT 预置的方案 C（reducer 风格结构化状态演化）出口评估，本 MVP 不预造。
- **`isBoxOnGoal` 是否要升级成块**：目前只是 `grid.ts` 内的纯函数，被 render 与 win-check 调用；若未来出现"某处需要在配置里显式接线'是否就位'"的需求，届时按 skill `afp-extract-block` 挖块。本 MVP 不预造。
