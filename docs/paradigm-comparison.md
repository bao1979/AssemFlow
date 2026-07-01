# AFP 范式分布与适用域对比

> 本文件是路线图交付物 B（`docs/paradigm-validation-sokoban-roadmap.md` "跨 MVP 交付物"一节）。
> 记录：哪些机制用了 AFP、哪些用了别的范式、每处边界为什么这么划、代价是什么。
> 随 MVP 链推进逐步填充；MVP-2 产出骨架 + 首要证据点，后续 MVP 持续补料。

---

## 结构说明

本文档分三部分：

1. **AFP 甜区与崩点清单**——按场景列出"成立/不成立/边界"结论与证据链接。
2. **Godot 词汇借用/拒绝对比**——Sokoban 验证链中借用了哪些 Godot 概念、拒绝了哪些、理由。
3. **`@paradigm` 标记汇总与分析**——按 MVP 递增，机器可扫描地汇总所有非 AFP 决定。

---

## AFP 甜区与崩点清单

### 成立：业务/装配逻辑层纯 AFP 数据流

| 场景 | 证据 | 来源 |
| :--- | :--- | :--- |
| 网格回合制走路（MVP-1） | `move-step` 纯块 + `walk.jsonc` 配置 + 方案 A 全量穿透；业务层零 `@paradigm` 标记 | `experiments/exp06-sokoban/REPORT.md` MVP-1 段 |
| 网格回合制推箱 + 胜利判定（MVP-2） | `move-with-push` + `win-check` 两纯块 + `push.jsonc` 两步装配流；业务/装配层零 `@paradigm` 标记 | `experiments/exp06-sokoban/REPORT.md` MVP-2 段 §四 |

**核心模型**：`下一网格状态 = f(当前网格状态, 方向键)` —— 纯函数、确定性、装配块 + 配置 + 方案 A 全量穿透覆盖了完整的 Sokoban 回合语义（走路 + 推箱 + 不动判定 + 胜利判定）。

### 合理边界：非 AFP 胜出

| 场景 | 选用范式 | 理由 | 证据 |
| :--- | :--- | :--- | :--- |
| 回合门控 / 终局输入拦截 / R/r 重开（MVP-2 `src/main.ts`） | `external-control-flow`（浏览器侧命令式 if/return） | 跨回合的时间维度状态 + 事件级条件分支；塞配置→违反"静态可枚举"红线；推进引擎→违反 K-LOOP 结论 | `src/main.ts` 第 1-9 行 `@paradigm NON-AFP: external-control-flow` |

**MVP-2 关键证据点**：`grep "@paradigm" experiments/exp06-sokoban/src/` 恰 **1 处命中**，且仅在脚手架层（`main.ts`）——业务/装配逻辑层（块 + 配置 + 转接件 + 驱动）**零命中**。这说明 AFP 数据流在 Sokoban 推箱 + 胜利判定场景下成立，但 **AFP 不承担回合控制流是合理边界**。

### 崩点（待后续 MVP 填充）

| 场景 | 尝试 AFP 的结果 | 替代方案 | 来源 |
| :--- | :--- | :--- | :--- |
| （MVP-3/MVP-4 实证后补充） | — | — | — |

---

## Godot 词汇借用/拒绝对比

> 背景：Sokoban 验证链以 Godot 为"业界同类参照物"（路线图 D-007），看 AFP 在游戏场景下与引擎型范式的映射关系。

### 借用（在 AFP 语义下有等价物）

| Godot 概念 | AFP 等价物 | 验证阶段 |
| :--- | :--- | :--- |
| Resource（纯数据资源） | ASCII 关卡文本 → `parseLevel` 装出的 `GridState` | MVP-1 起 |
| Scene（场景） | FlowConfig（`walk.jsonc` / `push.jsonc`）——装配流配置即场景描述 | MVP-1 起 |
| Input 映射 | 转接件 `keyToDirection`（物理按键 → 逻辑方向） | MVP-1 起 |
| `_process()` 主循环 | 外部主循环（浏览器 `keydown` 回调驱动单趟 `assemble`） | MVP-1 起 |

### 拒绝（在 AFP 框架下不适用 / 有害）

| Godot 概念 | 拒绝理由 | 替代 |
| :--- | :--- | :--- |
| 每帧 `_process` / `_physics_process` tick | Sokoban 是离散回合制，无连续物理帧；引擎无一等 loop step | 事件驱动（按键 = 一回合 = 一趟 `assemble`） |
| Node 继承体系 | 继承 = 脆弱基类（afp-core.md 纪律：禁止继承） | 组合（块 + 配置 + 转接件） |
| Signal（观察者模式） | AFP 数据流是显式的 context 摊平（`inputMap` 字段重命名），不需要隐式订阅/通知 | `inputMap` 显式接线 |
| AnimationPlayer / Tween | MVP-2 渲染纯 ASCII 文本网格，无动画需求 | 直接 DOM `replaceChildren` 全量重渲染 |

### 待定（后续 MVP 可能重评）

| Godot 概念 | 当前判断 | 何时重评 |
| :--- | :--- | :--- |
| StateMachine | MVP-2 门控仅用布尔 `won` + if 分支，未达状态机复杂度 | MVP-4 若引入暂停/多存档/回放 |
| TileMap | MVP-2 用 `Position[]` 表达网格；更大网格性能待观察 | MVP-3 若 20×20+ 关卡出现性能问题 |

---

## `@paradigm` 标记汇总

> 机器可扫描：`grep -Rn "@paradigm" experiments/exp06-sokoban/src/`

### MVP-2（当前）

| 文件 | 标记 | 范式 | 理由摘要 |
| :--- | :--- | :--- | :--- |
| `src/main.ts:2` | `@paradigm NON-AFP: external-control-flow` | 命令式事件回调 | 回合门控 + 终局拦截 + R/r 重开 = 跨回合时间维度状态，AFP 数据流表达不了 |

**业务/装配层（`src/blocks/**`、`src/configs/**`、`src/adapters/**`、`src/grid.ts`、`src/driver.ts`）**：零标记 → AFP 在此层**成立**。

### MVP-1

无 `@paradigm NON-AFP:` 代码标记（脚手架层注释说明"为什么不打标记"不计入）。

---

## 结论（随 MVP 链推进持续修订）

MVP-2 验证结论：

- **AFP 数据流在 Sokoban 核心玩法（走路 + 推箱 + 胜利判定）场景下成立**——纯块 + 配置 + 方案 A 全量穿透覆盖了完整回合语义。
- **AFP 不承担回合控制流是合理边界**——跨回合的时间维度状态 + 事件级条件分支由浏览器侧命令式代码承接，这是正面证据而非失败。
- 该结论若被后续 MVP 推翻（例如门控复杂度突增到需要 reducer / 状态机），将在此文档如实更新。
