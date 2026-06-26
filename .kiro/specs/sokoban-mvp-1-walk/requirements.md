# Requirements Document

> Spec: sokoban-mvp-1-walk · MVP-1 of the Sokoban paradigm-validation chain.
> 全局共识、术语、Godot 参照、范式标记约定见 `docs/paradigm-validation-sokoban-roadmap.md`。

## Introduction

Sokoban 范式验证链的第 1 站，含 `open-questions.md` 的 **Q-027（K-LOOP）**。

目标是做"角色在网格里走路 + 能看见"，证明网格状态能跑在引擎上、按键→回合→渲染的循环能成立。此阶段**不引入箱子**以隔离复杂度。K-LOOP 不单设独立实验，其结论写进本 MVP 报告。

**前置**：MVP-0（sokoban-mvp-0-k-state）给出的状态承载方案，本 MVP 直接沿用，不二次设计。

## Glossary

完整术语见 `docs/paradigm-validation-sokoban-roadmap.md` 的 Glossary。本 MVP 关键词：

- **回合（Turn）**：玩家一次按键到游戏状态完成一次完整变换的最小执行单元。
- **K-LOOP**：循环 / 事件驱动的执行语义议题，对应 Q-027。
- **主循环在外部 / 引擎 loop step**：K-LOOP 的两种候选方案。

## Requirements

### Requirement 1: 网格渲染与角色移动

**User Story:** 作为研究者，我希望先做"角色在网格里走路 + 能看见"，证明网格状态能跑在引擎上，此时不引入箱子以隔离复杂度。

#### Acceptance Criteria

1. WHEN 加载一份单关卡数据 THEN 系统 SHALL 在网格上渲染出墙体、地板和角色初始位置。
2. WHEN 玩家按方向键 THEN 系统 SHALL 把按键经输入适配层转换为一次回合输入，调用一次装配流，算出角色新位置。
3. WHEN 角色前方是空地 THEN 角色 SHALL 移动到该格；WHEN 角色前方是墙 THEN 角色 SHALL 停在原地。
4. WHEN 一回合处理完成 THEN 系统 SHALL 把最新游戏状态重新渲染出来。

### Requirement 2: K-LOOP 循环方案结论

**User Story:** 作为研究者，我希望确定"按键→回合→渲染"循环采用哪种方案并记录理由，作为 Q-027 的结论。

#### Acceptance Criteria

1. WHEN MVP-1 完成 THEN 文档 SHALL 记录 K-LOOP 结论：按键→回合→渲染的循环采用了"主循环在外部"还是"引擎 loop step"方案，以及理由。
2. WHEN MVP-1 完成 THEN 本阶段 SHALL 不包含箱子、不包含胜利判定、不包含撤销。

## 交付物

- `experiments/exp06-sokoban/`：MVP-1 走路 + 渲染实现 + K-LOOP 结论报告。

## Out of Scope

- 箱子、胜利判定、撤销（留待 MVP-2 / MVP-4）。
- 详见路线图"全链 Out of Scope"。

## 验证纪律提醒

按 `.kiro/steering/status-sync.md`：任何"完成 / 跑通"的断言必须有同轮真实测试输出 + git 状态确认；失败结论同等有价值，如实记录。
