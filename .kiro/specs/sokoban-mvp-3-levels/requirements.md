# Requirements Document

> Spec: sokoban-mvp-3-levels · MVP-3 of the Sokoban paradigm-validation chain.
> 全局共识、术语、Godot 参照、范式标记约定见 `docs/paradigm-validation-sokoban-roadmap.md`。

## Introduction

Sokoban 范式验证链的第 3 站，对应 `open-questions.md` 的 **Q-028**——验证 AFP "AI 产配置 / 引擎确定执行"在游戏场景下成立的核心环节。

目标是让"加新关卡"只需产出一份纯 ASCII 数据，引擎无需改代码即可加载。

**精简版决定**（发表后决定，见路线图 D-014）：
- **关卡集从 5 关压缩到 3 关**（一大一小一畸形）——3 关足以证明"稳定重复而非碰巧加一次"；再多的关卡是打磨性质、不再产生新证据。
- **主要工程价值转向"独立静态校验工具"（`check`）**——引擎作为"配置的 CAD 工具 + 编译器"的能力兑现：在不装载运行、不启动浏览器的前提下、就能对一份关卡数据判定合法性并给出精确错误定位。

MVP-2 已经证明过一次"加一份 ASCII → `parseLevel` → `assertPublishableLevel` 装载即用"；MVP-3 的增量价值是把这个动作**稳定重复**在多关，并把**校验能力从"装载期"扩展到"装载前"**。

**前置**：MVP-2（sokoban-mvp-2-push）的完整单关推箱子玩法。

## Glossary

完整术语见 `docs/paradigm-validation-sokoban-roadmap.md` 的 Glossary。本 MVP 关键词：

- **关卡（Level）**：一份描述初始网格状态的纯数据（ASCII）。
- **静态校验（check）**：不运行游戏、不装载 `parseLevel` 时对关卡数据合法性的分析——引擎作为"配置的 CAD 工具"的能力兑现。区别于 MVP-2 已实现的**装载期校验**（`parseLevel` + `assertPublishableLevel`——需要真实装载）。

## Requirements

### Requirement 1: ASCII 关卡数据驱动（3 关稳定重复）

**User Story:** 作为 AI agent 或人类设计者，我希望"加新关卡"只需产出一份纯 ASCII 数据，引擎无需改代码即可加载；并且这个动作在多关上稳定成立（不是碰巧加一次）。

#### Acceptance Criteria

1. WHEN 关卡用 Sokoban ASCII 字符表示（`#` 墙、`.` 目标、`@` 玩家、`$` 箱子、`*` 箱子在目标上、`+` 玩家在目标上、空格地板） THEN 系统 SHALL 能直接加载该 ASCII 为可玩状态。
2. WHEN 项目提供一个含 **3 关**的关卡集（覆盖：一份**大关卡**——地图较大、箱子较多；一份**小关卡**——地图较小、快速展示解法；一份**故意畸形关卡**——违反静态校验规则、作负例证据） THEN 合法的 2 关 SHALL 能正常加载并可通关；畸形关 SHALL 被静态校验拦下并给出精确定位错误信息。
3. WHEN 一份新关卡通过静态校验 THEN 系统 SHALL 无需任何代码修改即可加载游玩。
4. WHEN 关卡集增 / 删 / 改某关 THEN 引擎代码、装配块、转接件 SHALL 全部不变；仅数据层变化。

### Requirement 2: 独立静态校验工具

**User Story:** 作为设计者（或未来的 AI agent），我希望在不运行游戏、不装载 `parseLevel` 时就能判定一份关卡数据是否合法，并得到精确的错误定位。

#### Acceptance Criteria

1. WHEN 存在一份关卡 ASCII 数据（文件或字符串） THEN 独立的静态校验工具 SHALL 在**不装载运行、不启动浏览器**的前提下判定该关卡是否合法。
2. WHEN 静态校验工具执行 THEN 它 SHALL 检查以下规则：
   - 恰好一个玩家（`@` 或 `+` 之一，且总数为 1）
   - 箱子数（`$` + `*`）等于目标数（`.` + `*` + `+`），允许 0=0 特例
   - 边界闭合（外圈墙形成封闭区域，玩家/箱子不会"泄漏"到界外）
   - 字符集在合法集合内（`# . @ $ * +` 空格）
3. WHEN 静态校验失败 THEN 系统 SHALL 指出**第几行第几列**违反了**哪条具体规则**（不是笼统的"关卡不合法"，而是可以定位到坐标 + 规则名）。
4. WHEN 静态校验工具作为独立命令行或函数使用 THEN 它 SHALL 与运行时装载路径解耦——即修改 `parseLevel` 内部实现不应影响静态校验工具的接口。

## 交付物

- `experiments/exp06-sokoban/`：3 关 ASCII 关卡集（大 / 小 / 畸形）+ 独立静态校验工具（不装载即可校验）。
- 静态校验工具支持精确错误定位（行 / 列 / 规则名）。

## Out of Scope

- 关卡可解性自动判定（静态校验不含求解器，留扩展位不实现）。
- 纯算法关卡自动生成（LLM 产关卡属路线图交付物 A）。
- maxMoves 与撤销（MVP-4）。
- **多于 3 关的关卡集**——超过 3 关是打磨性质、不再产生新证据；若后续社区有兴趣继续加关，走 PR 通道即可（见 `CONTRIBUTING.md`），本 MVP 不承诺。
- 详见路线图"全链 Out of Scope"。

## 验证纪律提醒

按 `.kiro/steering/status-sync.md`：任何"完成 / 跑通"的断言必须有同轮真实测试输出 + git 状态确认；失败结论同等有价值，如实记录。
