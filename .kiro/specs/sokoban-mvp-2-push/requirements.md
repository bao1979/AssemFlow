# Requirements Document

> Spec: sokoban-mvp-2-push · MVP-2 of the Sokoban paradigm-validation chain.
> 全局共识、术语、Godot 参照、范式标记约定见 `docs/paradigm-validation-sokoban-roadmap.md`。

## Introduction

这是 Sokoban 范式验证链的第 2 站，对应 `open-questions.md` 的 **Q-028**。

目标是在 MVP-1 走路的基础上加入**推箱子**与**胜利判定**，跑通经典 Sokoban 的核心回合逻辑——用 `下一网格状态 = f(当前网格状态, 方向键)`（与 MVP-1 同形）证明"推箱 + 终局判定"能落在同一套 AFP 数据流上。

**本 MVP 的特殊地位：对外发表闸口（路线图 D-014）。** 根据发表与招人策略，发表线**就设在 MVP-2**——"做到 MVP-2（推箱 + 胜利判定）即正式对外发布"，低于 MVP-2 对外不算可玩 demo。因此 MVP-2 不是一个普通的功能增量，而是"别人认得出这是 Sokoban、且能上手玩"的最小对外门槛。**MVP-2 收尾必须走路线图的"发表前 checklist"作为退出条件**——该 checklist 的逐项内容以 `docs/paradigm-validation-sokoban-roadmap.md`（D-014 一节）为唯一真相源，本 spec 只引用、不复制其条目（守 SSOT）。

**前置（不二次设计）**：MVP-1（sokoban-mvp-1-walk）已给出走路 + 渲染 + 外部主循环（K-LOOP 结论：主循环在浏览器侧、引擎单趟确定性装配），并沿用 MVP-0 的状态承载方案 A（状态作 `initialInput` 进、`nextState` 出，块保持纯，调用方在回合间保管）。本 MVP **直接沿用** MVP-1 的循环与方案 A，不重新设计。

**浏览器可玩连续性（承接 MVP-1 R2）**：MVP-1 已把"走路在浏览器里可玩可见"钉为发表闸口地基。MVP-2 在此之上把推箱与胜利也纳入同一条可玩链路——推箱动作与胜利状态**必须在浏览器画面上可见可玩**（方向键 / WASD 在浏览器中推箱、当场看见箱子移动、胜利提示可见），不能只停留在控制台打印或测试断言。

## Glossary

完整术语见 `docs/paradigm-validation-sokoban-roadmap.md` 的 Glossary。本 MVP 关键词：

- **回合（Turn）**：玩家一次按键到游戏状态完成一次完整变换的最小执行单元。Sokoban 每次按键 = 一回合。
- **网格状态（Grid_State）**：一份描述当前关卡的纯数据。MVP-2 起，网格状态含**静态地形**（墙体、地板、目标格）与**动态态**（角色位置、箱子位置）。沿用 MVP-0 / MVP-1 的**状态承载方案 A**——箱子作为网格状态的一部分，随 `grid` 每回合**全量穿透**进出装配流。
- **箱子（Box）**：网格上可被角色推动的对象。角色只能推、不能拉；一次只能推动一个箱子；不可推动并排的两个箱子。箱子位置属网格状态的动态态。
- **目标格（Goal_Cell）**：箱子需要被推达的格子。目标格属网格状态的静态地形，位置跨回合恒定。
- **胜利判定（Win_Check）**：当全部箱子都位于目标格上时，判定关卡完成。
- **方向键输入（Direction_Input）**：上 / 下 / 左 / 右四种回合输入，由物理按键经输入适配层转换而来。
- **浏览器可玩 demo（Playable_Demo）**：能在浏览器中用方向键 / WASD 操作角色推箱、并当场看见箱子移动与胜利提示的最小运行物。
- **状态承载方案 A**：调用方持久化——状态作 `initialInput` 进 / `nextState` 出，块保持纯。MVP-0 选定、MVP-1 沿用的阶段性默认起点。

## Requirements

### Requirement 1: 推箱子核心玩法（沿用方案 A 的纯装配流）

**User Story:** 作为研究者，我希望在走路基础上加入推箱子，用 `下一网格状态 = f(当前网格状态, 方向键)`（与 MVP-1 同形）跑通经典 Sokoban 的核心推箱回合逻辑，此阶段状态承载仍沿用方案 A。

#### Acceptance Criteria

1. WHEN 加载一份含箱子与目标格的单关卡网格数据 THEN THE System SHALL 构造出含墙体、地板、目标格、角色初始位置与全部箱子初始位置的初始网格状态。
2. WHEN 一次回合执行 THEN THE System SHALL 以"当前网格状态 + 方向键输入"为输入、调用一次装配流，确定性地算出下一网格状态（同网格状态 + 同方向键永远同结果）。
3. WHERE 角色前方是箱子且该箱子前方是地板或目标格 THE System SHALL 把该箱子推进一格、并让角色跟进一格。
4. WHERE 角色前方是箱子且该箱子前方是墙体或另一个箱子 THE System SHALL 让角色与该箱子都停在原格。
5. WHERE 角色前方是箱子 THE System SHALL 一次仅推动该一个箱子，不推动其前方并排的其它箱子，也不执行拉动。
6. WHILE 沿用 MVP-0 / MVP-1 的状态承载方案 A THE System SHALL 让网格状态（含箱子）作为 `initialInput` 全量流入、`nextState` 全量流出，由调用方在回合间保管，装配块保持纯。

### Requirement 2: 胜利判定与终局

**User Story:** 作为玩家，我希望把所有箱子推到目标格后游戏判定通关并给出可见提示，通关后不再响应移动，直到重置或加载新关卡。

#### Acceptance Criteria

1. WHEN 一次回合执行后全部箱子都位于目标格上 THEN THE System SHALL 判定关卡完成。
2. WHEN 关卡被判定为完成 THEN THE Playable_Demo SHALL 在浏览器画面上显示可见的胜利提示。
3. WHILE 关卡处于已完成状态 THE System SHALL 停止接受方向键输入触发的移动回合，直到加载新关卡或重置。
4. WHEN MVP-2 交付 THEN THE Playable_Demo SHALL 使这一关能从开局在浏览器中手动游玩到通关。

### Requirement 3: 浏览器可玩连续性（发表闸口的可玩兑现）

**User Story:** 作为研究者，我希望推箱与胜利能在浏览器里当场玩到、当场看到，兑现 MVP-2 作为发表闸口"浏览器里可玩"的要求，而不是只在控制台或测试断言里验证。

#### Acceptance Criteria

1. WHEN MVP-2 交付 THEN THE Playable_Demo SHALL 在浏览器中加载并显示初始网格（墙体、地板、目标格、角色位置、全部箱子位置可见）。
2. WHEN 玩家在浏览器中按方向键或 WASD THEN THE Input_Adapter SHALL 把该物理按键转换为一次方向键输入，并触发一次回合。
3. WHEN 一次推箱回合处理完成 THEN THE Playable_Demo SHALL 把最新网格状态重新渲染到屏幕上，使箱子移动与角色移动当场可见。
4. THE Playable_Demo SHALL 不依赖控制台打印或测试断言作为唯一可见形态——推箱动作与胜利状态的可见性必须体现在浏览器画面上。

### Requirement 4: 渲染需求（承接 MVP-1，扩展箱子与目标格）

**User Story:** 作为玩家，我希望在浏览器里能清楚区分箱子、目标格、箱子已就位的态以及胜利提示，渲染沿用 MVP-1 的"够清楚就行、无美术"原则。

#### Acceptance Criteria

1. WHEN 渲染网格状态 THEN THE Playable_Demo SHALL 在浏览器画面上以可区分的字符呈现墙体、地板、目标格、角色与箱子。
2. WHERE 某箱子位于目标格上 THE Playable_Demo SHALL 以可与"未就位箱子"区分的方式呈现该已就位状态。
3. WHEN 关卡被判定为完成 THEN THE Playable_Demo SHALL 在浏览器画面上呈现可见的胜利提示。
4. WHERE 渲染只需"够清楚就行" THE Playable_Demo SHALL 采用最朴素的方式呈现网格（如 DOM 或 canvas 文本网格），重点是可玩与可见，不做美术资产。

### Requirement 5: AFP 纪律与范式标记

**User Story:** 作为研究者，我希望推箱逻辑优先用纯装配块 + 配置表达；若为跑通不得不引入非 AFP 范式，须可机器扫描地标识出来，为交付物 B（范式分布结论）供料。

#### Acceptance Criteria

1. WHEN 实现推箱逻辑 THEN THE System SHALL 优先用纯装配块 + 配置表达（`下一网格状态 = f(当前网格状态, 方向键)`，与 MVP-1 同形），算法留在块内、配置只做接线。
2. WHEN 处理"关卡完成后停止接受移动输入"这类终局 / 控制流 THEN THE System SHALL 沿用 MVP-1 的外部主循环思路（控制流留在浏览器侧事件回调，引擎保持单趟确定性装配），优先不把控制流推进引擎。
3. IF 为跑通不得不在装配流 / 业务逻辑层引入非 AFP 范式（如有状态块 / reducer / 状态机 / loop step / 全局状态） THEN THE System SHALL 按路线图"范式混合标记约定"在对应代码文件头部打 `@paradigm` 标记（含 `@reason` 与 `@afp-debt`），使 `grep "@paradigm"` 能一键列出。
4. WHERE 代码属于渲染层 / 前端脚手架 / 引擎实现本身 THE System SHALL 不要求 `@paradigm` 标记——它们不在"配置即图"的 AFP 承诺范围内（判据见 `.kiro/steering/afp-core.md` 标记适用范围）。

## 交付物

- `experiments/exp06-sokoban/`：在 MVP-1 走路 + 渲染基础上，增加推箱子 + 胜利判定 + 扩展渲染（箱子 / 目标格 / 就位态 / 胜利提示），使单关可从开局在浏览器中玩到通关。
- **发表闸口退出条件**：MVP-2 收尾时按 `docs/paradigm-validation-sokoban-roadmap.md`（D-014）的"发表前 checklist"逐项确认（条目以路线图为唯一真相源，此处不复制）。

## Out of Scope

- 多关卡集与静态校验（留待 MVP-3）。
- maxMoves 配置开关与撤销（留待 MVP-4）。
- 拉箱、一次推多个箱子——经典 Sokoban 规则不含，本 MVP 也不做。
- 3D 渲染 / 复杂动画 / 声音 / 美术资产——渲染只做"够清楚就行"。
- 重新设计状态承载方案或外部主循环——直接沿用 MVP-0 / MVP-1 既定结论。
- 详见路线图"全链 Out of Scope"。

## 验证纪律提醒

按 `.kiro/steering/status-sync.md`：任何"完成 / 跑通"的断言必须有同轮真实测试输出 + git 状态确认；浏览器"可玩"断言需同轮真实运行 / 截图佐证；失败结论同等有价值，如实记录。
