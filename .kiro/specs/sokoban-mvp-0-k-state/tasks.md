# Implementation Plan

> Spec: sokoban-mvp-0-k-state · Tasks
> 需求见 `requirements.md`，设计见 `design.md`。落地目录 `experiments/exp04-k-state/`。

## Overview

把 MVP-0 设计落地为可跑的实验：纯转移核 → 块包装 → 配置 → A/B 双驱动 → 等价测试 → 对比报告。
纪律：每个"完成"勾选前必须有同轮真实工具输出（typecheck / vitest / git）——见 `.kiro/steering/status-sync.md`。

## Tasks

- [ ] 1. 搭实验骨架（package.json / tsconfig，沿用 exp01 约定）
  - 在 `experiments/exp04-k-state/` 建 `package.json`（scripts: typecheck / test / assemble；deps: @sinclair/typebox + ajv；devDeps: vitest + tsx + typescript + @types/node + fast-check）
  - 建 `tsconfig.json`（对齐 exp01：ESM、strict）
  - 跑 `npm install` 确认依赖就位
  - _Requirements: 1.1_

- [ ] 2. 实现纯转移核 `src/traffic-light.ts`
  - 定义 `LightState = "red"|"green"|"yellow"`、`LightInput = "tick"|"pedestrian"`
  - 实现 `transition(state, input)`，严格按设计转移表（green 为驻留态：tick 保持绿，pedestrian 切黄）
  - 导出 TypeBox schema：`TrafficLightInput`（state+input 枚举）、`TrafficLightOutput`（nextState 枚举）
  - 纯函数：不读时钟 / 不用随机 / 不调 AI
  - _Requirements: 1.1, 1.2, 1.3_

- [ ] 3. 转移核测试（确定性 + 完备 + 输入分叉）
  - `tests/transition.test.ts`：穷举 3×2=6 组合逐一断言（Property 2、3）
  - 专门断言 `transition(green,tick)="green"` 且 `transition(green,pedestrian)="yellow"`（Property 4，输入驱动路径）
  - `tests/determinism.test.ts`：fast-check 随机序列跑两遍逐项相等（Property 1）
  - 跑 `npm test` 得真实通过输出后才勾选
  - _Requirements: 1.1, 1.2, 1.3_

- [ ] 4. 块包装与注册 `src/blocks/register.ts`
  - A：把 `transition` 包成**纯** `BlockDef`（name: "traffic-light-step"，入 {state,input}、出 {nextState}）
  - B：写**有状态块工厂** `createStatefulLightBlock(initial)`（闭包持 `current`，入 {input}、出 {state}，execute 读写 current；头部 `@paradigm` 标记）
  - 导出 `createRegistryA()` 与 `createRegistryB(initial)`（B 每次新实例 → 状态隔离 / reset）
  - 沿用 exp01 的跨包深路径 import（`../../../../engine/src/index.js`）
  - _Requirements: 1.1_

- [ ] 5. 配置 `src/configs/`（A/B 各一份，差异即对比材料）
  - `traffic-light-a.jsonc`：step 引用 traffic-light-step，inputMap `{state:"state", input:"input"}`（状态在配置里可见）
  - `traffic-light-b.jsonc`：step 引用 traffic-light-stateful，inputMap `{input:"input"}`（状态在配置里消失）
  - 注释说明两份的差异正是"配置可读性"维度的实测材料
  - _Requirements: 1.1, 2.1_

- [ ] 6. 方案 A 驱动 `src/driver-a.ts`（纯 AFP）
  - 实现 `stepA(config, registryA, state, input): LightState`：构造 initialInput `{state, input}` → `assemble` → 取 `context.nextState`
  - assemble 失败时抛异常（与 B **对称**：非法 input 在 execute 前被 Ajv 拦下、状态不前进）
  - 加直接运行入口（`npm run assemble` 跑一段示例序列打印状态轨迹）
  - _Requirements: 1.1, 1.2_

- [ ] 7. 方案 B 驱动 `src/driver-b.ts`（@paradigm 有状态块）
  - 文件头加 `@paradigm NON-AFP: stateful-block` 标记块（范式 / 原因 / afp-debt，按路线图约定）
  - 实现 `class StatefulRunner`：**状态不在 Runner 里，而在 registryB 的有状态块闭包内**；Runner 持 config + registryB
  - `send(input)`：`assemble(config, registryB, {input})` → 取 `context.state`；assemble 失败时抛异常（与 A 对称），块 execute 未运行故 current 不前进（Property 6）
  - reset 通过重建 registryB 实现
  - _Requirements: 1.1, 1.2_

- [ ] 8. A/B 行为等价测试 `tests/ab-equivalence.test.ts`
  - 同一输入序列（含 pedestrian 分叉）分别经 driver-a（配置A+纯块）与 driver-b（配置B+有状态块），断言状态序列逐项相等（Property 5）
  - 失败对称测试：非法 input 经 A、B 两路都抛错且都不前进状态（Property 6 + Error Handling）
  - 跑 `npm test` 得真实通过输出后才勾选
  - _Requirements: 1.1, 2.1_

- [ ] 9. 全量校验门禁
  - 跑 `npm run typecheck` 得 0 错
  - 跑 `npm test` 全绿
  - 跑 `npm run assemble` 端到端打印一段状态轨迹，确认 A 路径真在引擎上跑通
  - 三项真实输出齐了才进下一步
  - _Requirements: 1.1, 1.2, 1.3_

- [ ] 10. 对比报告 `REPORT.md`（Requirement 2 核心交付物）
  - 三维度对比 A vs B：配置可读性（A 显式接线 state vs B 配置里状态不可见——用两份真实配置对照）、配置对 AI agent 的友好度（**标注：推测性、非实测**，指向交付物 A）、调试容易程度
  - 写结论：选定后续 MVP 的**默认起点**状态承载方式（R2.3，措辞为"阶段性默认、非终局，MVP-1 可复审"）
  - 写诚实边界：状态极小、大体量 A/B 差异留 MVP-1（R2.4）；B 原型缺一等 reset/快照/隔离的成本如实记
  - 预留"方案 C（如 reducer）"段，以备两方案都不满意（R2.5）
  - 记录实现期暴露的引擎缺口（若有），登记到 `docs/open-questions.md`
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ] 11. 同步状态文档（SSOT）
  - 更新 `docs/ai/state.json`：exp04-k-state 状态、MVP-0 结论摘要、updatedAt
  - 更新 `docs/open-questions.md`：据 REPORT 证据强度**如实**更新 Q-026——可为 `in_progress`（部分结论）或 `resolved`（三项 resolution/evidence/resolvedAt 齐全）；**不预设结局**，证据不足就老实写不足，不为收尾强行 resolved
  - 只改变动字段，不重写全文
  - _Requirements: 2.3_

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1"], "description": "实验骨架，所有任务前置" },
    { "wave": 2, "tasks": ["2"], "description": "纯转移核（依赖 1）" },
    { "wave": 3, "tasks": ["3", "4"], "description": "转移核测试与块包装可并行（均依赖 2）" },
    { "wave": 4, "tasks": ["5"], "description": "配置（依赖 4）" },
    { "wave": 5, "tasks": ["6", "7"], "description": "A/B 双驱动可并行（依赖 5）" },
    { "wave": 6, "tasks": ["8"], "description": "A/B 等价测试（依赖 3、6、7）" },
    { "wave": 7, "tasks": ["9"], "description": "全量校验门禁（依赖 8）" },
    { "wave": 8, "tasks": ["10"], "description": "对比报告（依赖 9）" },
    { "wave": 9, "tasks": ["11"], "description": "同步状态文档（依赖 10）" }
  ]
}
```

- Task 1 是所有任务前置。
- Task 3 与 Task 4 都依赖 Task 2，可并行；Task 6 与 Task 7 都依赖 Task 5，可并行。
- Task 8 依赖 6、7（两个驱动）与 3（测试基建）。
- Task 9→10→11 严格串行收尾。

## Notes

- 全程不改引擎核心；A/B 都在实验层搭（见 design.md Architecture）。若发现 B 必须改引擎才好用，把它作为成本写进 REPORT，不提前改引擎粉饰。
- 状态体量刻意保持单枚举，不引入网格 / 数组——大体量是 MVP-1 的变量。
- 任何"通过/跑通"断言必须有同轮真实 `npm test` / `npm run typecheck` / `npm run assemble` 输出，否则不勾选（status-sync 铁律 1）。
- 失败结论与成立结论同等有价值，REPORT 如实记录暴露的缺口与不得不引入的非 AFP 范式。
