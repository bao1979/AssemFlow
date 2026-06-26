# Design Document

> Spec: sokoban-mvp-0-k-state · Design
> 需求见同目录 `requirements.md`；全局共识见 `docs/paradigm-validation-sokoban-roadmap.md`。
> 引擎现状基线（本设计据此而非凭记忆）：`engine/src/{types,assemble,check,registry}.ts`。

## Overview

MVP-0 用一个**带外部输入的红绿灯状态机**，在同一份纯转移逻辑上搭出**两个驱动器**——方案 A（调用方持久化）与方案 B（运行时承载状态，以有状态块为最小原型）——对二者做受控对比，为后续 MVP 的状态承载方式给出**默认起点**（阶段性默认，非终局定案；MVP-1 大体量状态可复审）。

核心设计取舍：

1. **共享纯转移逻辑，但 A/B 各有块包装与配置。** A 和 B 复用**同一个纯函数 `transition()`**，但各自的块包装与 FlowConfig 不同——这正是对比的材料：A 的配置显式接线 state 进出（可见但啰嗦），B 的配置只接线 input、state 藏在有状态块内（简洁但不可审）。受控变量是"状态存在哪"，转移逻辑本身保持同一，避免逻辑差异污染对比。
2. **B = 有状态块，状态存活在「引擎所运行的块」内（不改引擎核心）。** A 跑在现有 `assemble()` 上、块保持纯、状态由调用方 thread。B 注册一个**有状态块**（闭包持有 `current`），引擎照常运行它，状态就活在这个被引擎执行的块里、对配置与调用方都不可见——这落在 Q-026 对 B 的定义内（"给 BlockDef 加 state / 有状态块"）。完整的引擎级状态快照机制（一等的 reset / 快照 / 多实例隔离）**不在 MVP-0 实现**，其缺失作为 B 的成本如实记入报告，不靠提前改引擎粉饰。
3. **状态体量刻意极小。** 状态 = 单个枚举（Red/Green/Yellow）。不引入大体量状态——那是 MVP-1 网格的变量。本 MVP 只测"输入驱动迁移"这一个轴。

### Godot 词汇映射（沿用路线图）

| Godot 概念 | 本 MVP 对应 |
| :--- | :--- |
| Resource（纯数据资源） | `traffic-light.jsonc`（FlowConfig）+ 转移表 |
| Input 映射（动作名） | 外部输入 `tick` / `pedestrian` → 一次回合输入 |
| `_process()` 主循环 | 驱动器：每个"输入"调一次 `assemble`（回合驱动，非帧驱动） |

## Architecture

```
        ┌─────────────────────────────────────────┐
        │ 纯转移逻辑（A/B 共享、不含状态）         │
        │ traffic-light.ts: transition(state, in)  │
        └──────────────────┬──────────────────────┘
          ┌────────────────┴────────────────┐  受控变量：状态存活在哪
   ┌──────▼─────────────────┐   ┌────────────▼───────────────────┐
   │ A · 纯块 + 配置A        │   │ B · 有状态块 + 配置B            │
   │ block 入{state,input}   │   │ block 入{input}、闭包持 current │
   │       出{nextState}     │   │       出{state}                 │
   │ configA: 接线 state+in  │   │ configB: 只接线 input           │
   │ driver-a: 调用方持 state│   │ driver-b: 状态活在引擎所跑的块内│
   │ 【纯 AFP】             │   │ 【@paradigm NON-AFP: 有状态块】 │
   └─────────────────────────┘   └─────────────────────────────────┘
```

**受控变量：状态存活在哪。** 转移逻辑同一（`transition`），唯一变量是状态归属。

- **A**：块纯，`assemble()` 每回合拿到完整 `{state, input}`、算出 `nextState` 返回；调用方在回合间保管 state。配置显式接线 state 的进与出——状态在数据流里**可见、可审**，但每回合穿全量、配置啰嗦。
- **B**：注册一个**有状态块**（闭包持 `current`），配置只接线 `input`；引擎运行该块时，块自己执行 `current = transition(current, input)` 并返回新状态。状态活在「引擎所执行的块」内，对配置与调用方**不可见**——配置简洁，但违背 AFP"配置即图"（读配置看不到状态流向），故带 `@paradigm` 标记。
- **失败语义对称**：非法 input 被引擎 Ajv 在 execute **之前**拦下，A、B 均在此抛错，且状态都不前进（A 调用方保留旧 state；B 的块 execute 未运行、`current` 不变）。错误传播方式两边一致，**不引入额外变量**污染"调试容易程度"对比。

**关于"B 是否要改引擎"**：MVP-0 用闭包有状态块作为 B 的最小忠实原型，不改引擎核心。但它缺少 Q-026 设想的一等机制（状态快照 / reset / 多实例隔离——本原型靠"重建 registry"来 reset）。这些缺失是 B 的真实成本，如实记进对比报告，不靠提前改引擎粉饰。

## Components and Interfaces

### 1. 纯转移核 `src/traffic-light.ts`（AFP 纯机制）

```ts
export type LightState = "red" | "green" | "yellow";
export type LightInput = "tick" | "pedestrian";

// 纯函数：无时钟、无随机、无 AI。同 (state,input) 永远同 nextState。
export function transition(state: LightState, input: LightInput): LightState;

// TypeBox schema（喂给 BlockDef 与引擎 Ajv 校验）
export const TrafficLightInput;   // Type.Object({ state, input })
export const TrafficLightOutput;  // Type.Object({ nextState })
```

**转移表**（外部输入改变迁移路径——这是 MVP-0 的关键点）：

| 当前状态 | 输入 tick | 输入 pedestrian |
| :--- | :--- | :--- |
| red | green | red（无影响：行人可走，灯不变） |
| green | **green（驻留：主路通行，无人请求则保持绿）** | **yellow（行人请求 → 切黄停车）** |
| yellow | red | yellow（已在过渡，无影响） |

设计要点：**green 是驻留态**，`tick` 不推进它；只有 `pedestrian` 才把 green→yellow。于是 `transition(green, tick) = green ≠ transition(green, pedestrian) = yellow`——同一状态下两种输入产出不同下一状态，**实证 `nextState = f(state, input)` 而非 `f(state)`**，与 Sokoban `nextState = f(grid, direction)` 同形。整条 red→green→yellow→red 循环由 tick 与 pedestrian 协同推进（这是一盏行人触发式信号灯）。

### 2. 块包装 `src/blocks/register.ts`（沿用 exp01 约定）

A 用纯块，B 用有状态块工厂——这是 A/B 的实现分叉点：

```ts
// A：纯块——状态进出，块无记忆
const trafficLightBlock: BlockDef = {
  name: "traffic-light-step",
  inputSchema: Type.Object({ state, input }),
  outputSchema: Type.Object({ nextState }),
  execute: ({ state, input }) => ({ nextState: transition(state, input) }),
};

// B：有状态块工厂——闭包持 current，配置只喂 input；状态活在引擎所运行的块内
//   @paradigm NON-AFP: stateful-block
function createStatefulLightBlock(initial: LightState): BlockDef {
  let current = initial;            // 跨多次 assemble 调用持续存在的运行时状态
  return {
    name: "traffic-light-stateful",
    inputSchema: Type.Object({ input }),
    outputSchema: Type.Object({ state }),
    execute: ({ input }) => { current = transition(current, input); return { state: current }; },
  };
}

export function createRegistryA(): BlockRegistry;             // 注册纯块
export function createRegistryB(initial: LightState): BlockRegistry; // 注册有状态块（每次新实例 → 状态隔离 / reset）
```

### 3. 配置 `src/configs/`（AFP 配置 / Godot Resource）

A/B 各一份配置——**两份的差异就是对比的核心材料**：

```jsonc
// traffic-light-a.jsonc：显式接线 state 进出（状态在配置里可见）
{ "flowName": "traffic-light-a",
  "steps": [{ "block": "traffic-light-step", "inputMap": { "state": "state", "input": "input" } }] }

// traffic-light-b.jsonc：只接线 input，state 不出现在配置里（状态在配置里消失）
{ "flowName": "traffic-light-b",
  "steps": [{ "block": "traffic-light-stateful", "inputMap": { "input": "input" } }] }
```

> A 的配置能一眼看出状态怎么流；B 的配置简洁但读不出状态——这正是"配置可读性 / AI 友好度"维度的实测材料（解决"配置相同则该维空泛"的问题）。两份 inputMap 都只做重命名，未触及 Q-024 缺口。

### 4. 方案 A 驱动 `src/driver-a.ts`（纯 AFP）

```ts
export function stepA(
  config, registry, state: LightState, input: LightInput
): LightState; // assemble(config, registryA, {state, input}) → context.nextState；失败抛错（与 B 对称）
```

调用方负责持有 state，循环在外部：
```ts
let s: LightState = "red";
for (const i of inputs) s = stepA(cfgA, regA, s, i);
```

### 5. 方案 B 驱动 `src/driver-b.ts`（@paradigm NON-AFP）

```ts
/**
 * @paradigm NON-AFP: stateful-block / runtime-state
 * @reason 模拟"运行时承载状态"——状态活在引擎所运行的有状态块内，AFP 数据流不表达这种记忆
 * @afp-debt 若 B 更优，Q-026 后续可把"有状态块 / 状态快照"做成引擎一等概念
 */
export class StatefulRunner {
  // 注意：状态不在 Runner 里，而在 registryB 的有状态块闭包内——这才是"运行时承载"。
  // Runner 只是薄驱动：registry 由 createRegistryB(initial) 提供。
  constructor(config, registryB);
  send(input: LightInput): LightState; // assemble(config, registryB, {input}) → context.state；失败抛错（与 A 对称），块 execute 未运行故 current 不前进
  // reset：重建 registryB（反映"有状态块缺一等 reset"的成本）
}
```

调用方只发 input：
```ts
const r = new StatefulRunner(cfgB, createRegistryB("red"));
for (const i of inputs) r.send(i);
```

### 6. 对比报告 `REPORT.md`（满足 Requirement 2）

记录 A/B 在三维度的对比：配置可读性（A 显式 vs B 不可见状态）、配置对 AI agent 的友好度（**推测性、非实测**）、调试容易程度；并写入诚实边界标注（状态极小、大体量留 MVP-1）与预判（大概率落 A）。AI 实测整体外包给路线图交付物 A，本报告不下 AI 实测结论。

## Data Models

```ts
type LightState = "red" | "green" | "yellow";   // 单枚举，刻意极小
type LightInput = "tick" | "pedestrian";

// 块 I/O（引擎 Ajv 校验）
// A 纯块：  in {state, input} → out {nextState}
// B 有状态块：in {input}        → out {state}（current 在闭包里）

// 引擎上下文流转（assemble 内部，已有机制）
// A: initialInput {state, input} → block → out {nextState} → 摊平进 context.nextState
// B: initialInput {input}        → block(读写闭包 current) → out {state} → context.state
```

A/B 数据模型的实质区别：**A 把 state 显式放进 initialInput/output（数据流可见）；B 把 state 藏进块闭包，配置/数据流里只剩 input（不可见）。** 这就是受控变量"状态存活在哪"的物理体现。

## Error Handling

- **非法状态/输入**：由引擎 Ajv 在 `assemble` 入口按 `inputSchema` 拦截（enum 之外的值 → `AssembleResult.error`），无需驱动器另写校验。
- **transition 全覆盖**：转移表对 3×2 组合全定义，不存在"无对应迁移"的运行时缺口；由单测穷举保证。
- **确定性**：`transition` 纯函数，不读时钟/随机/AI——同输入同输出，由属性测试守。
- **失败语义对称（A/B 一致，不引入额外变量）**：非法 input 被引擎 Ajv 在 `execute` 之前拦截 → `AssembleResult.error`。driver-a 的 `stepA` 与 driver-b 的 `send` **都**在此抛错；状态都不前进（A：调用方保留旧 state；B：块 `execute` 未运行，闭包 `current` 不变）。两条路径错误传播方式一致，保证"调试容易程度"对比只反映状态归属差异，而非错误处理差异。

## Correctness Properties

这些属性是"对就该满足"的不变式，由 Testing Strategy 的用例兑现：

### Property 1: 确定性

对任意 `(state, input)`，`transition` 多次调用结果恒等；同一输入序列经任一驱动跑两遍，状态序列逐项相等。（无时钟 / 无随机 / 无 AI）

**Validates: Requirements 1.2**

### Property 2: 转移完备

转移表对全部 `3 状态 × 2 输入 = 6` 组合均有定义，不存在未定义迁移。

**Validates: Requirements 1.1**

### Property 3: 转移封闭

`transition` 的输出恒为合法 `LightState`（red/green/yellow 之一），永不产出枚举外的值。

**Validates: Requirements 1.3**

### Property 4: 输入驱动路径

存在至少一个状态使 `nextState` 依赖 input 而非仅依赖 state——具体为 `transition(green, tick) = green ≠ transition(green, pedestrian) = yellow`（验证 `f(state,input)` 非 `f(state)`）。

**Validates: Requirements 1.1**

### Property 5: A/B 行为等价

对任意输入序列，driver-a 与 driver-b 产出的状态序列完全一致——二者只差"状态归属"，不差行为，对比方公平。

**Validates: Requirements 2.1**

### Property 6: 失败不前进（A/B 对称）

当 input 非法、`assemble` 失败时，driver-a 与 driver-b **都**抛错且状态不前进——A 调用方保留旧 state，B 的有状态块 `execute` 未运行故闭包 `current` 不变。两路径失败语义一致。

**Validates: Requirements 1.2**

## Testing Strategy

> 遵守 `.kiro/steering/status-sync.md`：任何"通过"断言必须有同轮真实测试输出。

1. **转移表穷举测试**：3 状态 × 2 输入 = 6 组合逐一断言 `transition` 输出，含 `green+pedestrian→yellow` 这条路径改变用例（覆盖 AC 1.1 的"外部输入改变迁移路径"）。
2. **确定性属性测试**（fast-check）：随机 (state, input) 序列跑两遍，结果序列必须逐项相等（覆盖 AC 1.2）。
3. **A/B 等价测试**：同一输入序列分别经 driver-a（配置A + 纯块，调用方持状态）与 driver-b（配置B + 有状态块）跑，两者产出的状态序列必须完全一致——证明二者仅"状态归属/配置"不同、行为等价，对比才公平（Property 5）。
4. **引擎契约 + 失败对称测试**：非法 input（如 `"foo"`）经 A、B 两路 `assemble` 都返回 `success:false` / 抛错，且都不前进状态（Property 6 + Error Handling）。
5. **状态极小约束**：断言 state 类型为单枚举（编译期 + 评审保证），不引入网格/数组。

测试与运行脚本沿用 exp01 的 `package.json`（vitest + tsx + typebox + ajv）。

## 落地结构（`experiments/exp04-k-state/`）

```
experiments/exp04-k-state/
├── package.json            # 沿用 exp01 脚本：typecheck / test / assemble
├── tsconfig.json
├── src/
│   ├── traffic-light.ts     # 纯转移核 transition() + schema
│   ├── blocks/register.ts   # A 纯块 + B 有状态块工厂 + createRegistryA/B
│   ├── configs/
│   │   ├── traffic-light-a.jsonc  # A：接线 state+input
│   │   └── traffic-light-b.jsonc  # B：只接线 input
│   ├── driver-a.ts          # 方案 A（纯 AFP）
│   └── driver-b.ts          # 方案 B（@paradigm 有状态块）
├── tests/
│   ├── transition.test.ts   # 转移表穷举
│   ├── determinism.test.ts  # 属性测试
│   └── ab-equivalence.test.ts # A/B 行为等价
└── REPORT.md                # 三维度对比 + 边界标注 + 预判（Requirement 2）
```

## Requirements 覆盖映射

| 需求 AC | 设计落点 |
| :--- | :--- |
| R1.1 红绿灯循环 + 外部输入改路径 | 转移表（`green+pedestrian→yellow`）+ transition.test |
| R1.2 确定性 f(state,input) | `transition` 纯函数 + determinism.test |
| R1.3 状态体量极小 | LightState 单枚举 + "状态极小约束"测试 |
| R2.1 三维度对比 | REPORT.md（含"AI 友好度=推测"维度） |
| R2.2 AI 维度标注为推测 | REPORT.md 显式标注 + 指向交付物 A |
| R2.3 结论作后续默认起点（非终局） | REPORT.md 结论段（措辞：阶段性默认、MVP-1 可复审） |
| R2.4 诚实边界标注 | REPORT.md 边界段（大体量留 MVP-1） |
| R2.5 两方案都不满意则探索第三方案 | REPORT.md 预留"方案 C（如 reducer）"段 |

## 设计阶段未决、留给 Tasks/实现的问题

- 有状态块的 `current` reset 机制：MVP-0 用"重建 registryB"即可，不做一等 reset/快照（其缺失记入 REPORT 作为 B 的成本）。
- REPORT.md 的"AI 友好度"推测分析深度——给定性描述即可，不展开打分体系（避免伪精确）。
