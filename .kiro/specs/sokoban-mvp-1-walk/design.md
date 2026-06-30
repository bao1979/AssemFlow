# Design Document

> Spec: sokoban-mvp-1-walk · Design
> 需求见同目录 `requirements.md`；全局共识、Godot 参照、范式标记约定见 `docs/paradigm-validation-sokoban-roadmap.md`。
> 引擎现状基线（本设计据此而非凭记忆）：`engine/src/{types,assemble,check,registry}.ts`。
> 状态承载默认起点见 `experiments/exp04-k-state/REPORT.md`（方案 A，阶段性默认、MVP-1 可复审）。

## Overview

MVP-1 做"角色在网格里走路 + 能在浏览器里玩到"。它把三件事一次性钉到引擎上：

1. **网格状态跑在引擎上**：用纯装配块表达 `下一网格 = f(当前网格, 方向键)`，与 MVP-0 的 `f(state,input)` 同形，证明 AFP 数据流能承载比单枚举大得多的"网格状态"。
2. **按键→回合→渲染的循环成立**：给 K-LOOP（Q-027）一个结论。
3. **浏览器里可玩**：为 MVP-2 发表闸口"浏览器里可玩"打地基。

核心设计取舍：

1. **走路逻辑 = 一个纯装配块。** 碰撞判定（目标格是墙则不动、是地板则移动、出界则不动）这套算法留在块 `move-step` 内，配置只接线。块无记忆、确定性，符合 AFP"算法入块、配置只接线"。
2. **状态承载沿用 MVP-0 默认起点 A（调用方持久化）。** 网格状态作 `initialInput` 进、`nextGrid` 出，由浏览器侧调用方在回合间保管，块保持纯。**这正是 MVP-0 留给 MVP-1 的"大体量状态"轴**——本 MVP 要如实观察并记录"全量网格状态每回合穿进穿出是否变笨重"，若不可接受则按 exp04 REPORT 的约定触发复审。
3. **K-LOOP 走"外部主循环"。** 引擎只有单趟 `assemble`、没有 loop step（见 Architecture 的引擎现状）。回合制天然适配事件驱动：浏览器 `keydown` 每次按键驱动一趟 `assemble`，回合后刷新渲染。引擎**不**为此引入 loop step——这既保持引擎简单、运行期零 AI 与确定性，也是 Q-027 的结论材料（如实记录"引擎当前无一等 loop step，回合制下无需它"）。
4. **输入是转接件（防腐层），渲染是引擎外的派生视图。** 物理按键→方向动作名由转接件 `input-adapter` 承接；渲染层与浏览器脚手架不在"配置即图"承诺范围内，不打 `@paradigm` 标记（判据见 `afp-core.md`）。
5. **MVP-1 业务逻辑层是纯 AFP，无需 `@paradigm` 标记。** 与 MVP-0 的方案 B 不同，走路用方案 A 即可保持纯——业务层不引入有状态块/reducer，故全程无非 AFP 范式。仅当后续某处不得不引入时才标记。

### Godot 词汇映射（沿用路线图）

| Godot 概念 | 本 MVP 对应 |
| :--- | :--- |
| Resource（纯数据资源） | 单关 ASCII `levels/level-1.txt` → 解析出的 `GridState` |
| Input 映射（动作名） | 物理按键 `ArrowUp/...` → 方向动作 `up/down/left/right`（转接件） |
| Scene（场景） | `walk.jsonc`（一份 FlowConfig） |
| `_process()` 主循环 | 外部主循环：浏览器 `keydown` 每次按键调一趟 `assemble`（回合驱动，非帧驱动） |

明确拒绝（同路线图）：每帧 tick、Node 继承、Signal。

## Architecture

```
引擎现状基线（不臆造）：
  assemble(config, registry, initialInput) —— 单趟执行 steps，无 loop step、无内建主循环
  inputMap —— 仅字段重命名（Q-024），不做取值变换
  BlockDef = { name, inputSchema, outputSchema, execute }；输出摊平进 context 顶层

┌──────────────────────────── 浏览器（外部主循环 · 非 AFP 承诺范围）────────────────────────────┐
│                                                                                              │
│   keydown 事件 ──> input-adapter（转接件）──> direction: up/down/left/right                   │
│        │                                                                                     │
│        │   持有 currentGrid（方案 A：状态在调用方手里）                                       │
│        ▼                                                                                     │
│   driver.stepWalk(config, registry, currentGrid, direction)                                  │
│        │                                                                                     │
│        │   assemble(walk.jsonc, registry, { grid: currentGrid, direction })                  │
│        ▼                                                                                     │
│   ┌──────────────── 引擎（确定性 · 零 AI · 单趟）────────────────┐                            │
│   │  step: move-step                                            │                            │
│   │   in  { grid, direction }  ──Ajv校验──>                     │                            │
│   │   execute: nextGrid = move(grid, direction)  （纯算法在块内）│                            │
│   │   out { nextGrid }         ──Ajv校验──> 摊平进 context      │                            │
│   └────────────────────────────────────────────────────────────┘                            │
│        │  context.nextGrid                                                                   │
│        ▼                                                                                     │
│   currentGrid = nextGrid（调用方更新自己保管的状态）                                          │
│        ▼                                                                                     │
│   render(currentGrid)  ──> DOM 文本网格（够清楚就行，无美术）                                  │
│                                                                                              │
└──────────────────────────────────────────────────────────────────────────────────────────┘

数据流（方案 A，状态在配置里可见）：
  GridState ──作 initialInput.grid 进──> [纯块 move-step] ──nextGrid 出──> 调用方保管 ──> 下一回合再进
```

要点：

- **循环在引擎外。** 引擎只负责"一次按键 = 一趟确定性装配"，循环、事件、渲染都在浏览器侧。这把"回合"与"主循环"解耦——引擎保持纯函数式单趟语义。
- **方案 A 的全量状态穿透在此放大。** MVP-0 的状态是单枚举，穿透成本近乎零；MVP-1 的 `grid` 是网格（墙集合 + 角色坐标），每回合整份进出。设计**刻意**让它这样跑，以观察"配置/数据流是否变笨重、AI 是否还容易照着产配置"——这是本 MVP 相对 MVP-0 新增的真实信号。

## Components and Interfaces

### 1. 网格数据与解析 `src/grid.ts`（AFP 纯数据 + 纯机制）

```ts
export interface Position { readonly x: number; readonly y: number; }

// 网格状态：纯数据（Godot Resource 类比）。MVP-1 只含墙 + 地板 + 角色，不含箱子/目标点。
export interface GridState {
  readonly width: number;
  readonly height: number;
  readonly walls: readonly Position[];  // 墙坐标集合；其余可走格视为地板
  readonly player: Position;            // 角色坐标
}

export type Direction = "up" | "down" | "left" | "right";

// ASCII 解析：'#'=墙, '.' 或空格=地板, '@'=角色。装载期一次性纯函数（非每回合）。
export function parseLevel(ascii: string): GridState;

// TypeBox schema（喂给 BlockDef 与引擎 Ajv 校验）
export const PositionSchema;   // Type.Object({ x, y })
export const GridStateSchema;  // Type.Object({ width, height, walls, player })
export const DirectionSchema;  // Type.Union(up/down/left/right 字面量)
```

> `parseLevel` 是纯机制，但在**装载期**运行一次（把 Resource 文本变成初始 `GridState`），不在每回合的装配流里。它可被升级成块，但 MVP-1 不必——保持最小。

### 2. 走路块 `src/blocks/move-step.ts`（AFP 纯机制，算法入块）

```ts
import type { BlockDef } from "@assemflow/core";

// 纯函数：下一网格 = f(当前网格, 方向)。无时钟/随机/AI。
//   - 计算目标格 = player + delta(direction)
//   - 目标格越界 或 命中 walls  → 角色停在原格（返回与输入值等价的 GridState）
//   - 否则                       → 角色移动到目标格（返回新 GridState）
// 静态地形（width/height/walls）原样带出，只有 player 可能变。
// 实现约束：撞墙/越界的输出值确定且每次一致；测试用值等（toEqual）而非引用等（toBe），
//   故不强制返回新对象还是复用输入对象——确定性只要求值可预测、可复现。
export function move(grid: GridState, direction: Direction): GridState;

export const moveStepBlock: BlockDef = {
  name: "move-step",
  inputSchema: Type.Object({ grid: GridStateSchema, direction: DirectionSchema }),
  outputSchema: Type.Object({ nextGrid: GridStateSchema }),
  execute: ({ grid, direction }) => ({ nextGrid: move(grid, direction) }),
};

export function createWalkRegistry(): BlockRegistry; // 注册 move-step
```

### 3. 输入转接件 `src/adapters/input-adapter.ts`（Adapter / 防腐层）

```ts
// 物理按键 → 方向动作名。无法识别的键返回 null（不触发回合）。
// 这是防腐层：把"浏览器按键名"这种善变的外部输入隔离在业务逻辑之外。
export function keyToDirection(key: string): Direction | null;
//   ArrowUp|"w"|"W"    → "up"
//   ArrowDown|"s"|"S"  → "down"
//   ArrowLeft|"a"|"A"  → "left"
//   ArrowRight|"d"|"D" → "right"
//   其它               → null
```

### 4. 配置 `src/configs/walk.jsonc`（AFP 配置 / Godot Resource）

```jsonc
{
  "flowName": "sokoban-walk",
  "steps": [
    {
      "block": "move-step",
      "inputMap": { "grid": "grid", "direction": "direction" }  // ← 状态显式接线，方案 A
    }
  ]
}
```

> 状态 `grid` 显式出现在 `inputMap` 里（方案 A 的"可见但啰嗦"）。两个映射都只做重命名，未触及 Q-024。

### 5. 走路驱动 `src/driver.ts`（纯 AFP，调用方持状态）

```ts
import { assemble, type BlockRegistry, type FlowConfig } from "@assemflow/core";

// 一回合：喂入当前网格 + 方向，返回下一网格。失败抛错（非法方向被 Ajv 在 execute 前拦下）。
export function stepWalk(
  config: FlowConfig, registry: BlockRegistry, grid: GridState, direction: Direction
): GridState; // assemble(config, registry, { grid, direction }) → context.nextGrid

// 外部主循环示意（调用方持 grid）：
//   let grid = parseLevel(levelText);
//   onKeydown(key => { const d = keyToDirection(key); if (d) { grid = stepWalk(cfg, reg, grid, d); render(grid); } });
```

### 6. 渲染 `src/render.ts`（非 AFP 承诺范围，**不打 @paradigm**）

```ts
// 把 GridState 渲染成 DOM 文本网格（够清楚就行，无美术）。纯展示，无业务逻辑。
// 渲染是引擎派生的可视化视图，不在"配置即图"的数据流里，按 afp-core.md 判据无需 @paradigm 标记。
export function render(grid: GridState, container: HTMLElement): void;
```

### 7. 浏览器入口 `index.html` + `src/main.ts`（脚手架，**不打 @paradigm**）

`main.ts` 串起外部主循环：装载关卡 → 渲染初始网格 → 绑定 `keydown` → 每次按键经转接件转方向、调 `stepWalk`、更新 `currentGrid`、重渲染。浏览器打包用 **Vite**（最简现代 ESM 方案；dev server 由人工运行，不在 spec/tasks 内自动启动）。

### 8. 报告 `REPORT.md`（满足 R3 + 记录 R1.6 观察点）

记录：K-LOOP 结论（选"外部主循环"及理由、如实写"引擎无一等 loop step、回合制下无需"）；方案 A 全量网格状态穿透的笨重度观察（是否触发复审）；实现期暴露的引擎缺口或非 AFP 范式（若有）。

## Data Models

```ts
interface Position { x: number; y: number; }
interface GridState {
  width: number; height: number;
  walls: Position[];   // 静态地形
  player: Position;    // 动态：唯一会变的部分
}
type Direction = "up" | "down" | "left" | "right";

// 方向增量
const DELTA: Record<Direction, Position> = {
  up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
};

// 块 I/O（引擎 Ajv 校验）
//   move-step:  in { grid: GridState, direction: Direction } → out { nextGrid: GridState }

// 引擎上下文流转（assemble 内部，已有机制）
//   initialInput { grid, direction } → move-step → out { nextGrid } → 摊平进 context.nextGrid
```

方案 A 的物理体现：`grid` 显式放进 `initialInput` 与 `output`，状态在数据流里**可见可审**；代价是每回合穿全量网格。`move` 只改 `player`，`width/height/walls` 原样带出——但方案 A 仍要求整份 `GridState` 进出（这正是要观察的穿透成本）。

## Error Handling

- **非法方向**：由引擎 Ajv 在 `assemble` 入口按 `DirectionSchema` 拦截（枚举外的值 → `AssembleResult.error`）。但实践中无法识别的按键已被转接件 `keyToDirection` 过滤为 `null`、根本不触发回合，故非法方向通常到不了引擎。
- **越界 / 撞墙不是错误**：是合法游戏规则——`move` 返回"角色停在原格"的 `GridState`，`assemble` 成功。不抛错。
- **解析失败**：`parseLevel` 对畸形 ASCII（如无 `@` 角色、多个 `@`）**抛错（`Error`）**，调用方据此阻止启动。严格校验（多 `@` 精确行号、边界不闭合等）留 MVP-3 的静态校验。
- **确定性**：`move` 与 `parseLevel` 纯函数，不读时钟/随机/AI——同输入同输出，由属性测试守。
- **失败不前进**：若某回合 `assemble` 失败（理论上的非法方向），`stepWalk` 抛错，调用方保留旧 `currentGrid`，状态不前进（方案 A 的天然性质）。

## Correctness Properties

这些属性是"对就该满足"的不变式，由 Testing Strategy 的用例兑现：

### Property 1: 确定性

对任意 `(grid, direction)`，`move` 多次调用结果恒等；同一关卡 + 同一方向序列经 `stepWalk` 跑两遍，网格序列逐项相等。（无时钟 / 无随机 / 无 AI）

**Validates: Requirements 1.3**

### Property 2: 碰撞规则

WHERE 目标格是地板且在界内，`move` 后 `player` 等于目标格；WHERE 目标格是墙或越界，`move` 后 `player` 等于原格。

**Validates: Requirements 1.4, 1.5**

### Property 3: 网格不变式

任意回合后，`player` 恒在 `[0,width) × [0,height)` 界内，且 `player` 坐标不与任何 `walls` 坐标重合；静态地形 `width/height/walls` 跨回合恒定不变。

**Validates: Requirements 1.4, 1.5**

### Property 4: 装载正确

`parseLevel` 把 ASCII 正确映射为 `GridState`：`#` 进 `walls`、`@` 定位 `player`、`.`/空格为地板；宽高与文本一致。

**Validates: Requirements 1.1**

### Property 5: 方案 A 状态承载（块保持纯）

`grid` 经 `initialInput` 流入、`nextGrid` 流出，`move-step` 块内不持有跨回合状态；同一 `move-step` 用于任意回合，行为只依赖当回合输入。

**Validates: Requirements 1.6**

### Property 6: 输入适配

`keyToDirection` 把方向键映射到正确方向动作；无关按键映射为 `null`（不触发回合）。

**Validates: Requirements 1.2**

### Property 7: 渲染反映最新状态

`render` 输出的网格中，角色所在格对应 `grid.player`、墙格对应 `grid.walls`；一回合后重渲染能体现 `player` 的位移。

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

## Testing Strategy

> 遵守 `.kiro/steering/status-sync.md`：任何"通过"断言必须有同轮真实测试输出。

1. **`move` 单元测试**：四个方向各移动一格；撞墙不动；出界不动；空旷地板连续移动（覆盖 R1.3/1.4/1.5、Property 2）。
2. **确定性属性测试**（fast-check）：随机合法关卡 + 随机方向序列，经 `stepWalk` 跑两遍，网格序列逐项相等（覆盖 R1.3、Property 1）。
3. **不变式属性测试**（fast-check）：随机方向序列下，断言每回合后 `player` 在界内、不在墙上，且 `walls`/宽高不变（Property 3）。
4. **`parseLevel` 测试**：给定 ASCII 关卡，断言 `walls` 集合、`player` 坐标、宽高正确；畸形输入（无 `@`/多 `@`）按 Error Handling 处理（Property 4）。
5. **方案 A 纯性测试**：复用同一 `move-step` 块跨多回合，断言行为只依赖当回合 `{grid,direction}`、块无残留状态（Property 5）。
6. **转接件测试**：`keyToDirection` 各方向键与无关键的映射（Property 6）。
7. **装配流端到端测试**：`assemble(walk.jsonc, registry, {grid, direction})` 返回 `success:true` 且 `context.nextGrid` 正确（覆盖 R1.2/1.6 在引擎上的贯通）。
8. **渲染测试**（jsdom）：`render(grid, container)` 后，DOM 文本网格中角色与墙的位置正确；移动一回合后重渲染体现位移（Property 7，覆盖 R2）。浏览器实际可玩性由人工在浏览器中验收（status-sync：可玩断言需同轮真实运行/截图佐证）。
9. **全量状态穿透观察（非 pass/fail）**：在 REPORT 中记录方案 A 下整份 `GridState` 每回合进出的影响，明确三个观察点（直接回答 MVP-0 REPORT 遗留的"留待 MVP-1 复审"）：
   - **体量**：一回合 `initialInput` 的 JSON 大致多长？（如一个 20×10 网格的 `walls` 约 50–100 个坐标对象）
   - **可读性**：读 `walk.jsonc` 的 `inputMap`，`"grid": "grid"` 这行接线在网格规模下是否仍表意清晰？
   - **AI 推测**：若让 AI agent 照此 pattern 产新关卡配置，网格的全量穿透是否增加出错风险？（推测，不下结论，留交付物 A 实测）

测试与脚本沿用 exp01/exp04 的 `package.json`（vitest + tsx + typebox + ajv），新增 Vite 作浏览器入口的打包/预览（dev server 人工运行）。

## 落地结构（`experiments/exp06-sokoban/` 的 MVP-1 部分）

> exp06 承载 MVP-1~4；本 spec 只落地走路相关文件，箱子/胜利/撤销留后续 MVP 往同目录追加。

```
experiments/exp06-sokoban/
├── package.json            # 沿用 exp01 脚本：typecheck / test；+ Vite dev/preview
├── tsconfig.json
├── index.html              # 浏览器入口
├── vite.config.ts          # 最简 Vite 配置
├── src/
│   ├── grid.ts              # GridState/Position/Direction 类型 + parseLevel + schema
│   ├── blocks/
│   │   └── move-step.ts     # 纯块 move(grid,direction)→{nextGrid} + createWalkRegistry
│   ├── adapters/
│   │   └── input-adapter.ts # keyToDirection 转接件（防腐层）
│   ├── configs/
│   │   └── walk.jsonc       # 装配流配置（接线 grid + direction）
│   ├── driver.ts            # stepWalk（纯 AFP，调用方持 grid）
│   ├── render.ts            # DOM 文本网格渲染（非 AFP，无 @paradigm）
│   ├── levels/
│   │   └── level-1.txt      # 单关 ASCII（# 墙 / . 地板 / @ 角色）
│   └── main.ts              # 浏览器外部主循环：keydown→adapter→stepWalk→render（脚手架，无 @paradigm）
├── tests/
│   ├── move-step.test.ts
│   ├── determinism.test.ts
│   ├── invariants.test.ts
│   ├── parse-level.test.ts
│   ├── input-adapter.test.ts
│   ├── assemble-walk.test.ts
│   └── render.test.ts        # jsdom
└── REPORT.md                # K-LOOP 结论 + 全量状态穿透观察 + 引擎缺口如实记录
```

## Requirements 覆盖映射

| 需求 AC | 设计落点 |
| :--- | :--- |
| R1.1 装载网格数据 | `parseLevel`（grid.ts）+ parse-level.test |
| R1.2 按键→方向输入→触发回合 | `keyToDirection`（input-adapter）+ main.ts 主循环 + assemble-walk.test |
| R1.3 确定性 `f(grid,direction)` | `move` 纯函数 + determinism.test |
| R1.4 地板→移动 | `move` 碰撞分支 + move-step.test（Property 2） |
| R1.5 墙→停 | `move` 碰撞分支 + move-step.test（Property 2/3） |
| R1.6 方案 A 状态承载、块保持纯 | walk.jsonc 显式接线 grid + driver.stepWalk + 方案 A 纯性测试 |
| R2.1 浏览器显示初始网格 | index.html + main.ts + render + render.test |
| R2.2 浏览器按键→回合→重渲染、移动可见 | main.ts 外部主循环 + render + 人工浏览器验收 |
| R2.3 朴素渲染（DOM/canvas 文本） | render.ts（DOM 文本网格，无美术） |
| R2.4 可见性体现在浏览器画面、非仅控制台 | render 输出到 DOM + 人工验收 |
| R3.1 K-LOOP 结论（外部主循环 vs 引擎 loop step + 理由） | REPORT.md（选外部主循环，引擎无 loop step） |
| R3.2 如实记录引擎缺口/非 AFP | REPORT.md 缺口段 |
| R4.1 走路逻辑纯块+配置 | move-step 块（算法入块）+ walk.jsonc（只接线） |
| R4.2 非 AFP 范式打 @paradigm | 业务层纯 AFP 故无标记；如引入则按约定标记（REPORT 记录） |
| R4.3 渲染/脚手架/引擎不标记 | render.ts / main.ts / Vite 脚手架不打标记（依 afp-core.md 判据） |

## 设计阶段未决、留给 Tasks/实现的问题

- **`walls` 表示**：用 `Position[]` 还是序列化的 `Set<"x,y">`？前者 JSON 友好、契约直观，后者查询快。**选 `Position[]`，理由不止"网格小、线性查找够用"——更关键的是它是纯 JSON 数据：在方案 A 的全量穿透下，墙数据在 `initialInput`/`context`/日志里可见可审、人可读，符合 AFP"配置即图"。`Set<"x,y">` 序列化进 JSON 会塌成 `{}`，直接破坏"全量状态穿透"的可观察性——你将看不到墙到底在哪。** `move` 内做线性查找；若穿透观察显示性能问题再调整（记入 REPORT）。
- **关卡来源**：`level-1.txt` 作为静态资源 `import` 还是 fetch？取最简（Vite `?raw` 导入文本），实现期定。
- **render 复用**：MVP-2 推箱子会扩展渲染（箱子/目标点字符）；MVP-1 的 `render` 先只画墙/地板/角色，预留扩展但不提前抽象（治理关节、放开零件）。
- **全量状态穿透的"笨重"判据**：定性记录即可（配置可读性、AI 是否易产），不建打分体系（避免伪精确）。
