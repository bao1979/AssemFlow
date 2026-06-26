# Requirements Document

> Spec: sokoban-mvp-2-push · MVP-2 of the Sokoban paradigm-validation chain.
> 全局共识、术语、Godot 参照、范式标记约定见 `docs/paradigm-validation-sokoban-roadmap.md`。

## Introduction

Sokoban 范式验证链的第 2 站，对应 `open-questions.md` 的 **Q-028**。

在走路基础上加入推箱子和胜利判定，跑通经典 Sokoban 的核心回合逻辑。

**前置**：MVP-1（sokoban-mvp-1-walk）的走路 + 渲染 + 回合循环。

## Glossary

完整术语见 `docs/paradigm-validation-sokoban-roadmap.md` 的 Glossary。本 MVP 关键词：

- **目标格**：箱子需要被推到的格子。
- **胜利判定**：全部箱子位于目标格上时判定关卡完成。

## Requirements

### Requirement 1: 推箱子核心玩法

**User Story:** 作为研究者，我希望在走路基础上加入推箱子和胜利判定，跑通经典 Sokoban 的核心回合逻辑。

#### Acceptance Criteria

1. WHEN 角色前方是箱子且箱子前方是空地或目标格 THEN 角色 SHALL 推动箱子前进一格、自己跟进一格。
2. WHEN 角色前方是箱子且箱子前方是墙或另一个箱子 THEN 角色与箱子 SHALL 都停在原地（不可推两个并排的箱子、不可拉）。

### Requirement 2: 胜利判定

**User Story:** 作为玩家，我希望把所有箱子推到目标格后游戏判定通关。

#### Acceptance Criteria

1. WHEN 全部箱子都位于目标格上 THEN 系统 SHALL 判定关卡完成并提示玩家。
2. WHEN 关卡完成 THEN 系统 SHALL 停止接受移动输入，直到加载新关卡或重置。
3. WHEN MVP-2 完成 THEN 这一关 SHALL 能从开局手动游玩到通关。

## 交付物

- `experiments/exp06-sokoban/`：在 MVP-1 基础上增加推箱子 + 胜利判定，单关可从开局玩到通关。

## Out of Scope

- 多关卡集与静态校验（MVP-3）、maxMoves 与撤销（MVP-4）。
- 详见路线图"全链 Out of Scope"。

## 验证纪律提醒

按 `.kiro/steering/status-sync.md`：任何"完成 / 跑通"的断言必须有同轮真实测试输出 + git 状态确认；失败结论同等有价值，如实记录。
