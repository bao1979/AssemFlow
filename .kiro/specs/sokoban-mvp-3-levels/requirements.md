# Requirements Document

> Spec: sokoban-mvp-3-levels · MVP-3 of the Sokoban paradigm-validation chain.
> 全局共识、术语、Godot 参照、范式标记约定见 `docs/paradigm-validation-sokoban-roadmap.md`。

## Introduction

Sokoban 范式验证链的第 3 站，对应 `open-questions.md` 的 **Q-028**——这是验证 AFP "AI 产配置 / 引擎确定执行"在游戏场景下成立的核心环节。

目标是让"加新关卡"只需产出一份纯 ASCII 数据，引擎无需改代码即可加载。

**前置**：MVP-2（sokoban-mvp-2-push）的完整单关推箱子玩法。

## Glossary

完整术语见 `docs/paradigm-validation-sokoban-roadmap.md` 的 Glossary。本 MVP 关键词：

- **关卡（Level）**：一份描述初始网格状态的纯数据（ASCII）。
- **静态校验（check）**：不运行游戏时对关卡数据合法性的分析。

## Requirements

### Requirement 1: ASCII 关卡数据驱动

**User Story:** 作为 AI agent 或人类设计者，我希望"加新关卡"只需产出一份纯 ASCII 数据，引擎无需改代码即可加载，以验证 AFP "AI 产配置 / 引擎确定执行"在游戏场景下成立。

#### Acceptance Criteria

1. WHEN 关卡用 ASCII 字符表示（`#` 墙、`.` 目标、`@` 玩家、`$` 箱子、`*` 箱子在目标上、`+` 玩家在目标上、空格地板） THEN 系统 SHALL 能直接加载该 ASCII 为可玩状态。
2. WHEN 项目提供一个含 5 关的关卡集 THEN 全部 5 关 SHALL 能正常加载并可通关。
3. WHEN 一份新关卡通过静态校验 THEN 系统 SHALL 无需任何代码修改即可加载游玩。
4. WHEN 关卡集增 / 删 / 改某关 THEN 引擎代码、装配块、转接件 SHALL 全部不变；仅数据层变化。

### Requirement 2: 关卡静态校验

**User Story:** 作为设计者，我希望在不运行游戏时就能判定一份关卡数据是否合法，并得到精确的错误定位。

#### Acceptance Criteria

1. WHEN AI agent 或人产出一份新关卡 THEN 静态校验工具 SHALL 在不运行游戏时判定：恰好一个玩家、箱子数等于目标数、边界闭合。
2. WHEN 静态校验失败 THEN 系统 SHALL 指出第几行第几列违反了哪条规则。

## 交付物

- `experiments/exp06-sokoban/`：5 关 ASCII 关卡集 + 静态校验工具。

## Out of Scope

- 关卡可解性自动判定（静态校验不含求解器，留扩展位不实现）。
- 纯算法关卡自动生成（LLM 产关卡属路线图交付物 A）。
- maxMoves 与撤销（MVP-4）。
- 详见路线图"全链 Out of Scope"。

## 验证纪律提醒

按 `.kiro/steering/status-sync.md`：任何"完成 / 跑通"的断言必须有同轮真实测试输出 + git 状态确认；失败结论同等有价值，如实记录。
