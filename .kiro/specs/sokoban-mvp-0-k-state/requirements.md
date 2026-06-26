# Requirements Document

> Spec: sokoban-mvp-0-k-state · MVP-0 of the Sokoban paradigm-validation chain.
> 全局共识、术语、Godot 参照、范式标记约定见 `docs/paradigm-validation-sokoban-roadmap.md`。

## Introduction

这是 Sokoban 范式验证链的第 0 站，对应 `open-questions.md` 的 **Q-026（K-STATE）**。

在碰游戏之前，先用一个**与游戏无关的最小状态机**（红绿灯）定下一件事：长寿命对象的状态怎么存、怎么演化。把这个共识钉死，后续所有 MVP 不再二次设计状态承载方式，避免一上来同时碰多个未知。

非 AFP 范式（若引入）须按路线图的"范式混合标记约定"打 `@paradigm` 标记。

## Glossary

完整术语见 `docs/paradigm-validation-sokoban-roadmap.md` 的 Glossary。本 MVP 关键词：

- **K-STATE**：长寿命对象的状态演化议题，对应 Q-026。
- **状态承载方案 A / B**：A = 调用方持久化（状态作 initialInput 进 / output 出）；B = 引擎承载状态。

## Requirements

### Requirement 1: 红绿灯状态机最小实现

**User Story:** 作为研究者，我希望先用一个与游戏无关的最小状态机，定下"长寿命对象的状态怎么存、怎么演化"，再进入游戏——避免一上来同时碰多个未知。

#### Acceptance Criteria

1. WHEN MVP-0 启动 THEN 系统 SHALL 实现一个红绿灯状态机（红→绿→黄→红循环），独立于 Sokoban。
2. WHEN 给定当前状态 THEN 系统 SHALL 确定性地算出下一状态（同状态同输入永远同结果）。

### Requirement 2: 状态承载方案对比

**User Story:** 作为研究者，我希望对比"调用方持久化"与"引擎承载状态"两种方案，选出后续统一采用的状态承载方式。

#### Acceptance Criteria

1. WHEN MVP-0 完成 THEN 文档 SHALL 记录两种状态承载方案的对比："A. 调用方持久化（状态作 initialInput 进 / output 出）"与"B. 引擎承载状态"，对比维度为：配置可读性、AI 产改配置的成本、调试容易程度。
2. WHEN MVP-0 给出结论 THEN 该结论 SHALL 直接作为后续所有 MVP 的状态承载方式，不再二次设计。
3. IF 两种方案都不令人满意 THEN 项目 SHALL 如实记录并探索第三方案（如 reducer），不允许跳过 MVP-0 直接做游戏。

## 交付物

- `experiments/exp04-k-state/`：红绿灯状态机实现 + 方案对比报告。

## Out of Scope

- 任何 Sokoban 游戏逻辑（走路、推箱子、关卡、撤销）。
- 详见路线图"全链 Out of Scope"。

## 验证纪律提醒

按 `.kiro/steering/status-sync.md`：任何"完成 / 跑通"的断言必须有同轮真实测试输出 + git 状态确认；失败结论同等有价值，如实记录。
