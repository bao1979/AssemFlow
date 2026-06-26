# Design Document

> Spec: sokoban-mvp-0-k-state · Design
> 需求见同目录 `requirements.md`；全局共识见 `docs/paradigm-validation-sokoban-roadmap.md`。
> 引擎现状基线（本设计据此而非凭记忆）：`engine/src/{types,assemble,check,registry}.ts`。

## Overview

MVP-0 用一个**带外部输入的红绿灯状态机**，在同一份纯转移逻辑上搭出**两个驱动器**——方案 A（调用方持久化）与方案 B（运行时持有状态）——对二者做受控对比，为后续所有 MVP 钉死状态承载方式。

核心设计取舍：

1. **共享纯核，只换驱动。** A 和 B 复用**同一个**纯转移块与**同一份** FlowConfig，只有"状态存在哪、谁来 thread"这一个变量不同。这样对比结果不被实现差异污染——直接对应 requirements 的"变量隔离原则"。
2. **不动引擎核心。** 引擎当前无状态支持。A 直接跑在现有 `assemble()` 上、零改动；B 用一个**实验层的有状态驱动器**包住 `assemble()` 来模拟"运行时持有状态"，**也不改引擎核心**。理由：保持引擎纯净，并让"B 是否非得改引擎才好用"本身成为一条可观测的成本证据（见 Architecture）。
3. **状态体量刻意极小。** 状态 = 单个枚举（Red/Green/Yellow）。不引入大体量状态——那是 MVP-1 网格的变量。本 MVP 只测"输入驱动迁移"这一个轴。

### Godot 词汇映射（沿用路线图）

| Godot 概念 | 本 MVP 对应 |
| :--- | :--- |
| Resource（纯数据资源） | `traffic-light.jsonc`（FlowConfig）+ 转移表 |
| Input 映射（动作名） | 外部输入 `tick` / `pedestrian` → 一次回合输入 |
| `_process()` 主循环 | 驱动器：每个"输入"调一次 `assemble`（回合驱动，非帧驱动） |

## Architecture

```
                     ┌─────────────────────────────────────┐
                     │  纯核（A/B 共享，不含状态）          │
                     │  traffic-light.ts: transition(s, i)  │
                     │  blocks/register.ts: BlockDef 包装    │
                     │  configs/traffic-light.jsonc: Flow   │
                     └──────────────┬──────────────────────┘
                                    │ 同一块 + 同一配置
              ┌─────────────────────┴─────────────────────┐
              │                                            │
   ┌──────────▼───────────┐                   ┌────────────▼─────────────┐
   │ 方案 A · driver-a.ts  │                   │ 方案 B · driver-b.ts      │
   │ stepA(state, input)   │                   │ class StatefulRunner      │
   │ → assemble(cfg, reg,  │                   │ 持有 currentState         │
   │   {state, input})     │                   │ send(input) 内部注入状态  │
   │ → 返回 nextState      │                   │ → assemble → 写回 state   │
   │ 调用方自己存 state    │                   │ 调用方只发 input          │
   │ 【纯 AFP】            │                   │ 【@paradigm NON-AFP】     │
   └───────────────────────┘                   └───────────────────────────┘
```

**A 与 B 的唯一差异**：状态的归属。

- **A**：`assemble()` 每次拿到完整 `{state, input}` 作 initialInput，算出 `nextState` 返回；调用方在两次调用之间保管 state。引擎/驱动全程无记忆。这是纯 AFP 路径，引擎零改动。
- **B**：`StatefulRunner` 实例内部持有一个可变 `currentState`；`send(input)` 时它自动把 `currentState` 注入 initialInput、调 `assemble`、把输出写回自己的 `currentState`。调用方只发 input，看不到 state。这块可变状态是非 AFP 的，文件须带 `@paradigm` 标记。

**关于"B 是否要改引擎"**：本设计故意把 B 的状态放在**实验层驱动器**而非引擎核心。如果对比中发现"B 不改引擎核心就很别扭/不可观测/无法静态校验"，这恰恰是 B 的一条真实成本，如实记进对比报告，不通过提前改引擎来粉饰。

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

```ts
const trafficLightBlock: BlockDef = {
  name: "traffic-light-step",
  inputSchema: TrafficLightInput,
  outputSchema: TrafficLightOutput,
  execute: (input) => ({ nextState: transition(s, i) }),
};
export function createRegistry(): BlockRegistry; // 注册该块
```

### 3. 配置 `src/configs/traffic-light.jsonc`（AFP 配置 / Godot Resource）

单步 FlowConfig，A/B 共用：

```jsonc
{
  "flowName": "traffic-light",
  "steps": [
    { "block": "traffic-light-step", "inputMap": { "state": "state", "input": "input" } }
  ]
}
```

> 注：本流不需要 `params`；`state`/`input` 由驱动器经 initialInput 注入。inputMap 只做重命名，未触及 Q-024 缺口（刻意保持简单）。

### 4. 方案 A 驱动 `src/driver-a.ts`（纯 AFP）

```ts
export function stepA(
  config, registry, state: LightState, input: LightInput
): LightState; // 内部 assemble(config, registry, {state, input})，返回 context.nextState
```

调用方负责持有 state，循环在外部：
```ts
let s: LightState = "red";
for (const i of inputs) s = stepA(cfg, reg, s, i);
```

### 5. 方案 B 驱动 `src/driver-b.ts`（@paradigm NON-AFP）

```ts
/**
 * @paradigm NON-AFP: stateful-runtime / global-state
 * @reason 模拟"引擎承载状态"——运行时持有跨回合可变状态，AFP 数据流不表达这种记忆
 * @afp-debt 若 B 证明更优，可考虑把"有状态块/状态存储"做成引擎一等概念（Q-026 后续）
 */
export class StatefulRunner {
  private currentState: LightState;
  constructor(config, registry, initial: LightState);
  send(input: LightInput): LightState; // 注入 currentState → assemble → 写回 → 返回
  get state(): LightState;
}
```

调用方只发 input：
```ts
const r = new StatefulRunner(cfg, reg, "red");
for (const i of inputs) r.send(i);
```

### 6. 对比报告 `REPORT.md`（满足 Requirement 2）

记录 A/B 在三维度的对比：配置可读性、配置对 AI agent 的友好度（**推测性、非实测**）、调试容易程度；并写入诚实边界标注（状态极小、大体量留 MVP-1）与预判（大概率落 A）。AI 实测整体外包给路线图交付物 A，本报告不下 AI 实测结论。

## Data Models

```ts
type LightState = "red" | "green" | "yellow";   // 单枚举，刻意极小
type LightInput = "tick" | "pedestrian";

// 块 I/O（引擎 Ajv 校验）
TrafficLightInput  = Type.Object({ state: enum, input: enum });
TrafficLightOutput = Type.Object({ nextState: enum });

// 引擎上下文流转（assemble 内部，已有机制）
// initialInput {state, input} → block → output {nextState} → 摊平进 context.nextState
```

A/B 数据流唯一区别：state 在 initialInput 里**由谁填**——A 是调用方，B 是 StatefulRunner。

## Error Handling

- **非法状态/输入**：由引擎 Ajv 在 `assemble` 入口按 `inputSchema` 拦截（enum 之外的值 → `AssembleResult.error`），无需驱动器另写校验。
- **transition 全覆盖**：转移表对 3×2 组合全定义，不存在"无对应迁移"的运行时缺口；由单测穷举保证。
- **确定性**：`transition` 纯函数，不读时钟/随机/AI——同输入同输出，由属性测试守。
- B 的可变状态不抛错语义变化：`StatefulRunner.send` 内部 `assemble` 失败时原样返回 `AssembleResult.error`，且**不**改写 `currentState`（失败回合状态不前进）。

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

### Property 6: 失败不前进

当 `assemble` 返回失败时，driver-b 的 `currentState` 不被改写（失败回合状态不前进）。

**Validates: Requirements 1.2**

## Testing Strategy

> 遵守 `.kiro/steering/status-sync.md`：任何"通过"断言必须有同轮真实测试输出。

1. **转移表穷举测试**：3 状态 × 2 输入 = 6 组合逐一断言 `transition` 输出，含 `green+pedestrian→yellow` 这条路径改变用例（覆盖 AC 1.1 的"外部输入改变迁移路径"）。
2. **确定性属性测试**（fast-check）：随机 (state, input) 序列跑两遍，结果序列必须逐项相等（覆盖 AC 1.2）。
3. **A/B 等价测试**：同一输入序列喂给 driver-a 与 driver-b，两者产出的状态序列必须完全一致——证明二者仅"状态归属"不同、行为等价，对比才公平。
4. **引擎契约测试**：非法 input（如 `"foo"`）经 `assemble` 返回 `success:false`，验证 Ajv 拦截。
5. **状态极小约束**：断言 state 类型为单枚举（编译期 + 评审保证），不引入网格/数组。

测试与运行脚本沿用 exp01 的 `package.json`（vitest + tsx + typebox + ajv）。

## 落地结构（`experiments/exp04-k-state/`）

```
experiments/exp04-k-state/
├── package.json            # 沿用 exp01 脚本：typecheck / test / assemble
├── tsconfig.json
├── src/
│   ├── traffic-light.ts     # 纯转移核 + schema
│   ├── blocks/register.ts   # BlockDef 包装 + createRegistry
│   ├── configs/traffic-light.jsonc  # 单步 FlowConfig（A/B 共用）
│   ├── driver-a.ts          # 方案 A（纯 AFP）
│   └── driver-b.ts          # 方案 B（@paradigm 标记）
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
| R2.3 结论作后续状态承载方式 | REPORT.md 结论段 |
| R2.4 诚实边界标注 | REPORT.md 边界段（大体量留 MVP-1） |
| R2.5 两方案都不满意则探索第三方案 | REPORT.md 预留"方案 C（如 reducer）"段 |

## 设计阶段未决、留给 Tasks/实现的问题

- driver-b 的 `currentState` 用 class 字段还是闭包——实现细节，不影响对比结论，实现时择简。
- REPORT.md 的"AI 友好度"推测分析深度——给定性描述即可，不展开打分体系（避免伪精确）。
