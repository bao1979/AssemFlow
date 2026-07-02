# Requirements Document

> Spec: sokoban-mvp-4-tuning · MVP-4 of the Sokoban paradigm-validation chain.
> 全局共识、术语、Godot 参照、范式标记约定见 `docs/paradigm-validation-sokoban-roadmap.md`。

## Introduction

Sokoban 范式验证链的收尾站，对应 `open-questions.md` 的 **Q-028**。

**精简版决定**（发表后决定，见路线图 D-014）：**重心从 `maxMoves` 移到"撤销 + `@paradigm` 判据实证"**。理由：

- **maxMoves 的验证价值有限**——MVP-2 已经通过"通关判定 → 拒绝方向键"这条分支证明过"运行时判断由块 + 配置驱动、块零改动"这一模式。maxMoves 只是同一模式的再演一次，教学价值有，但不产生新证据。
- **撤销的验证价值高**——撤销**很可能**需要引入非 AFP 范式（如 reducer 历史栈）。这是让 `docs/paradigm-comparison.md` 从"1 处证据"（MVP-2 的 `external-control-flow`）**扩到 2 处证据**的关键；也是压测 Q-026 K-STATE "时间维度状态"的机会。

因此本 MVP 的主线是**撤销 / 重置 + `@paradigm` 判据实证**；`maxMoves` 降为附加（可选）延伸，不作主要验收项。

**前置**：MVP-3（sokoban-mvp-3-levels）的关卡数据驱动与静态校验。

## Glossary

完整术语见 `docs/paradigm-validation-sokoban-roadmap.md` 的 Glossary。本 MVP 关键词：

- **撤销（Undo）**：把游戏状态回退到上一回合——本 MVP "时间维度状态压测"的载体。
- **重置（Reset）**：把游戏状态回退到关卡起始态，同时清空撤销历史——撤销的对称能力。
- **`@paradigm` 标记**：非 AFP 范式代码的机器可扫描标识（范式 / 原因 / 收编方向）。
- **maxMoves（附加）**：配置中声明的最大移动步数，超出且未通关则本局失败——MVP-4 的可选延伸，不作主要验收。

## Requirements

### Requirement 1: 撤销与重置（主要验收项）

**User Story:** 作为玩家，我希望能撤销上一步并能重置关卡；同时作为研究者，我希望通过实现撤销压测 AFP 在"跨回合时间维度状态"上的表达力，得到 `paradigm-comparison.md` 的第 2 个正面/边界证据点。

#### Acceptance Criteria

1. WHEN 玩家触发撤销 THEN 系统 SHALL 回退到上一回合的完整状态（角色位置、箱子位置、已用步数、`won` 标志）。
2. WHEN 玩家连续触发撤销 THEN 系统 SHALL 可**连续回退**直到关卡起始状态；到达起始态后再撤销 SHALL 保持起始态、不出错。
3. WHEN 玩家触发重置 THEN 系统 SHALL 回到当前关卡起始状态并**清空撤销历史**（重置后不能再撤销到重置前的中间态）。
4. WHEN 撤销 / 重置 用到了非 AFP 范式（如 reducer 历史栈、有状态块、全局状态） THEN 相关代码文件 SHALL 打 `@paradigm` 标记（含 `@reason` + `@afp-debt` 三字段），使 `grep "@paradigm"` 能一键列出。
5. WHEN MVP-4 完成 THEN REPORT SHALL 明确回答：**AFP 数据流能否表达撤销？**——三选一：
   - **能**（撤销落在纯 AFP 数据流内，无 `@paradigm NON-AFP` 新增） → paradigm-comparison.md 记为 AFP 甜区扩展
   - **不能，但可标记边界**（撤销引入 1-2 处 `@paradigm NON-AFP`，代价可控） → paradigm-comparison.md 记为第 2 个合理边界
   - **不能，且引发范式坍塌**（撤销引入大量 `@paradigm NON-AFP`、业务/装配层被污染） → paradigm-comparison.md 记为 AFP 在时间维度状态上的严重崩点
   三种结论**同等有价值**——第 3 种是最强的负面证据，写出来反而增加项目信誉。

### Requirement 2: maxMoves 配置可调机制（附加·可选）

> 本项目已在 MVP-2 通过通关门控证明"配置可调机制、块零改动"。maxMoves 作为**附加延伸**保留，主要用于教学与关卡设计——若实现期发现 R1 已经充分证明本 MVP 目标、且时间紧张，本节**可作为 Out of Scope 跳过**。

**User Story:** 作为关卡设计者，我希望通过配置为某关卡设置最大移动步数，超出且未通关则本局失败——把游戏难度做成"配置可调"。

#### Acceptance Criteria

1. WHEN 配置中声明 `maxMoves` 为一个正整数 THEN 系统 SHALL 在玩家移动步数超过该值且未通关时判定本局失败。
2. WHEN `maxMoves` 的值被修改 THEN 系统 SHALL 不需要修改任何装配块代码，仅改这一处配置值，行为即变。
3. WHEN `maxMoves` 给了非正整数或非法值 THEN 静态校验（MVP-3 的 `check` 工具扩展） SHALL 在装配前报错。

## 交付物

- `experiments/exp06-sokoban/`：撤销 / 重置能力 + 明确的 `@paradigm` 判据实证结论（R1.5 三选一）。
- **为路线图交付物 B（`docs/paradigm-comparison.md`）供料**：本 MVP 引入的非 AFP 范式（如有）带 `@paradigm` 标记；paradigm-comparison.md 追加第 2 个证据点（无论正面 / 边界 / 负面）。
- （可选）maxMoves 配置开关。

## Out of Scope

- 路线图交付物 A / B 的定稿（随全链收尾，不在本 MVP 验收内）。
- **maxMoves 若时间紧张可跳过**（见 R2 前置说明）——它不影响 MVP-4 的核心结论。
- 详见路线图"全链 Out of Scope"。

## 验证纪律提醒

按 `.kiro/steering/status-sync.md`：任何"完成 / 跑通"的断言必须有同轮真实测试输出 + git 状态确认；失败结论同等有价值——**尤其对 R1.5，"AFP 不能表达撤销"是完全合法的结论，如实记录，不为收尾强行圆满**。
