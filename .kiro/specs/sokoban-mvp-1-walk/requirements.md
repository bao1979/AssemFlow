# Requirements Document

> Spec: sokoban-mvp-1-walk · MVP-1 of the Sokoban paradigm-validation chain.
> 全局共识、术语、Godot 参照、范式标记约定见 `docs/paradigm-validation-sokoban-roadmap.md`。

## Introduction

这是 Sokoban 范式验证链的第 1 站，含 `open-questions.md` 的 **Q-027（K-LOOP）**。

目标是做"角色在网格里走路 + 能看见"，证明网格状态能跑在引擎上、按键→回合→渲染的循环能成立。此阶段**不引入箱子**以隔离复杂度——只取"网格状态 + 移动 + 可见循环"这一最小切面，把推箱、胜利判定、撤销留给后续 MVP。K-LOOP 不单设独立实验，其结论写进本 MVP 报告。

**前置（不二次设计）**：MVP-0（sokoban-mvp-0-k-state）已给出状态承载的**阶段性默认起点 A（调用方持久化）**——状态作 `initialInput` 进、`nextState` 出，块保持纯，调用方在回合间保管状态。本 MVP **直接沿用 A**，不重新设计状态承载（背景、A/B 对比与"非终局、MVP-1 可复审"的定位见 `experiments/exp04-k-state/REPORT.md`）。

**本 MVP 的特殊地位（路线图新增）**：根据发表与招人策略（D-014），发表闸口设在 MVP-2，要求"浏览器里可玩：方向键走路、推箱、胜利判定可见"。因此 MVP-1 是 MVP-2 发表闸口的**地基**——它的渲染目标必须明确锚定为**浏览器里可玩**（方向键在浏览器中走路、当场看见角色移动），不能只停留在控制台打印或测试断言。这是本 MVP 与"只在网格上渲染"的关键差别：渲染形态被钉死为"浏览器可玩的最小走路 demo"。

**变量隔离原则（承接 MVP-0）**：MVP-0 刻意把状态体量保持极小（单枚举），未验证"大体量状态下 A 的全量穿透有多笨"。本 MVP 的网格是 MVP-0 明确留给 MVP-1 的"状态体量"轴：若网格规模下 A 的全量状态穿透变得不可接受，按 exp04 REPORT 的约定**允许复审**，并如实记录。

## Glossary

完整术语见 `docs/paradigm-validation-sokoban-roadmap.md` 的 Glossary。本 MVP 关键词：

- **回合（Turn）**：玩家一次按键到游戏状态完成一次完整变换的最小执行单元。Sokoban 每次按键 = 一回合。
- **网格状态（Grid_State）**：一份描述当前关卡的纯数据——墙体、地板、角色位置。MVP-1 不含箱子与目标点。
- **方向键输入（Direction_Input）**：上 / 下 / 左 / 右四种回合输入，由物理按键经输入适配层转换而来。
- **K-LOOP**：循环 / 事件驱动的执行语义议题，对应 Q-027。
- **主循环在外部 / 引擎 loop step**：K-LOOP 的两种候选方案——前者把"按键→回合→渲染"的驱动循环放在引擎外（如前端事件回调），后者由引擎提供一等的 loop step 驱动。
- **浏览器可玩 demo（Playable_Demo）**：能在浏览器中用方向键操作角色走路、并当场看见角色移动的最小运行物。
- **状态承载方案 A**：调用方持久化——状态作 `initialInput` 进 / `nextState` 出，块保持纯。MVP-0 选定的阶段性默认起点。

## Requirements

### Requirement 1: 网格状态与角色移动（沿用方案 A 的纯装配流）

**User Story:** 作为研究者，我希望先做"角色在网格里走路"，用 `下一网格状态 = f(当前网格状态, 方向键)` 证明网格状态能跑在引擎上，此阶段不引入箱子以隔离复杂度。

#### Acceptance Criteria

1. WHEN 加载一份单关卡的网格数据 THEN THE System SHALL 构造出含墙体、地板与角色初始位置的初始网格状态。
2. WHEN 玩家按一个方向键 THEN THE Input_Adapter SHALL 把该物理按键转换为一次方向键输入（上 / 下 / 左 / 右之一），并触发一次回合。
3. WHEN 一次回合执行 THEN THE System SHALL 以"当前网格状态 + 方向键输入"为输入、调用一次装配流，确定性地算出下一网格状态（同状态 + 同方向键永远同结果）。
4. WHERE 角色目标格是地板 THE System SHALL 把角色移动到该格。
5. WHERE 角色目标格是墙体 THE System SHALL 让角色停在原格。
6. WHILE 沿用 MVP-0 的状态承载方案 A THE System SHALL 让网格状态作为 `initialInput` 流入、`nextState` 流出，由调用方在回合间保管，装配块保持纯。

### Requirement 2: 浏览器可玩的最小走路 demo（发表闸口地基）

**User Story:** 作为研究者，我希望走路能在浏览器里当场玩到、当场看到，为 MVP-2 的发表闸口"浏览器里可玩"打下地基，而不是只在控制台或测试断言里验证。

#### Acceptance Criteria

1. WHEN MVP-1 交付 THEN THE Playable_Demo SHALL 在浏览器中加载并显示初始网格（墙体、地板、角色位置可见）。
2. WHEN 玩家在浏览器中按方向键 THEN THE Playable_Demo SHALL 触发一次回合，并在该回合处理完成后把最新网格状态重新渲染到屏幕上，使角色移动当场可见。
3. WHERE 渲染只需"够清楚就行" THE Playable_Demo SHALL 采用最朴素的方式呈现网格（如 DOM 或 canvas 文本网格），重点是可玩与可见，不做美术资产。
4. THE Playable_Demo SHALL 不依赖控制台打印或测试断言作为唯一可见形态——可见性必须体现在浏览器画面上。

### Requirement 3: K-LOOP 循环方案结论（Q-027 必交产出）

**User Story:** 作为研究者，我希望确定"按键→回合→渲染"循环采用哪种方案并记录理由，作为 Q-027 的结论。

#### Acceptance Criteria

1. WHEN MVP-1 完成 THEN THE MVP1_Report SHALL 记录 K-LOOP 结论：按键→回合→渲染的循环采用了"主循环在外部"还是"引擎 loop step"方案，以及做此选择的理由。
2. WHEN 记录 K-LOOP 结论 THEN THE MVP1_Report SHALL 如实记录实现期暴露的引擎缺口或不得不引入的非 AFP 范式（若有），不粉饰。

### Requirement 4: AFP 纪律与范式标记

**User Story:** 作为研究者，我希望走路逻辑优先用纯装配块 + 配置表达；若为跑通不得不引入非 AFP 范式，须可机器扫描地标识出来，为交付物 B（范式分布结论）供料。

#### Acceptance Criteria

1. WHEN 实现网格走路逻辑 THEN THE System SHALL 优先用纯装配块 + 配置表达（`下一网格状态 = f(当前网格状态, 方向键)`，与 MVP-0 同形），算法留在块内、配置只做接线。
2. IF 为跑通不得不在装配流 / 业务逻辑层引入非 AFP 范式（如有状态块 / reducer / loop step） THEN THE System SHALL 按路线图"范式混合标记约定"在对应代码文件头部打 `@paradigm` 标记（含 `@reason` 与 `@afp-debt`），使 `grep "@paradigm"` 能一键列出。
3. WHERE 代码属于渲染层 / 前端脚手架 / 引擎实现本身 THE System SHALL 不要求 `@paradigm` 标记——它们不在"配置即图"的 AFP 承诺范围内（判据见 `.kiro/steering/afp-core.md` 标记适用范围）。

## 交付物

- `experiments/exp06-sokoban/`：MVP-1 走路 + 渲染实现 + **浏览器可玩 demo** + K-LOOP 结论报告。

## Out of Scope

- 箱子、胜利判定（留待 MVP-2）。
- 撤销（留待 MVP-4）。
- 3D 渲染 / 复杂动画 / 声音 / 美术资产——渲染只做"够清楚就行"。
- 重新设计状态承载方案——直接沿用 MVP-0 的默认起点 A（见 `experiments/exp04-k-state/REPORT.md`）。
- 详见路线图"全链 Out of Scope"。

## 验证纪律提醒

按 `.kiro/steering/status-sync.md`：任何"完成 / 跑通"的断言必须有同轮真实测试输出 + git 状态确认；失败结论同等有价值，如实记录。
