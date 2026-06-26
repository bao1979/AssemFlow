# Requirements Document

> Spec: sokoban-mvp-4-tuning · MVP-4 of the Sokoban paradigm-validation chain.
> 全局共识、术语、Godot 参照、范式标记约定见 `docs/paradigm-validation-sokoban-roadmap.md`。

## Introduction

Sokoban 范式验证链的收尾站，对应 `open-questions.md` 的 **Q-028**。

用一个最简配置开关（`maxMoves`）验证"配置可调机制"，并加入撤销以压测时间维度状态。撤销很可能要引入非 AFP 范式（如 reducer 历史栈），须按路线图的"范式混合标记约定"打 `@paradigm` 标记。

**前置**：MVP-3（sokoban-mvp-3-levels）的关卡数据驱动与静态校验。

## Glossary

完整术语见 `docs/paradigm-validation-sokoban-roadmap.md` 的 Glossary。本 MVP 关键词：

- **maxMoves**：配置中声明的最大移动步数，超出且未通关则本局失败——本 MVP 的"配置可调机制"载体。
- **`@paradigm` 标记**：非 AFP 范式代码的机器可扫描标识（范式 / 原因 / 收编方向）。

## Requirements

### Requirement 1: maxMoves 配置可调机制

**User Story:** 作为研究者，我希望用一个最简配置开关验证"配置可调机制"——改一处配置值，行为即变，块零改动。

#### Acceptance Criteria

1. WHEN 配置中声明 `maxMoves` 为一个正整数 THEN 系统 SHALL 在玩家移动步数超过该值且未通关时判定本局失败。
2. WHEN `maxMoves` 的值被修改 THEN 系统 SHALL 不需要修改任何装配块代码，仅改这一处配置值，行为即变。
3. WHEN `maxMoves` 给了非正整数或非法值 THEN 静态校验 SHALL 在装配前报错。

### Requirement 2: 撤销与重置

**User Story:** 作为玩家，我希望能撤销上一步并能重置关卡——这同时压测 AFP 在时间维度状态上的表达力。

#### Acceptance Criteria

1. WHEN 玩家选择撤销 THEN 系统 SHALL 回退到上一回合状态（角色位置、箱子位置、已用步数）；可连续撤销直到关卡起始状态。
2. WHEN 玩家选择重置 THEN 系统 SHALL 回到当前关卡起始状态并清空撤销历史。
3. WHEN 撤销 / 重置 用到了非 AFP 范式（如 reducer 历史栈） THEN 相关文件 SHALL 带 `@paradigm` 标记，说明范式、原因、收编方向。

## 交付物

- `experiments/exp06-sokoban/`：maxMoves 配置开关 + 撤销 / 重置能力。
- 为路线图交付物 B（`docs/paradigm-comparison.md`）供料：本 MVP 引入的非 AFP 范式带 `@paradigm` 标记。

## Out of Scope

- 路线图交付物 A / B 的定稿（随全链收尾，不在本 MVP 验收内）。
- 详见路线图"全链 Out of Scope"。

## 验证纪律提醒

按 `.kiro/steering/status-sync.md`：任何"完成 / 跑通"的断言必须有同轮真实测试输出 + git 状态确认；失败结论同等有价值，如实记录。
