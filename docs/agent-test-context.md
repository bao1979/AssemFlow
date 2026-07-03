# AI 实测上下文包（copy-paste 到大模型对话用）

> 本文件是《`docs/agent-test-prompts.md`》的配套材料。
> **用法**：跑测前，把从"### AssemFlow · AI 实测上下文包（开始）"到"### AssemFlow · AI 实测上下文包（结束）"之间的**全部内容**复制粘贴到大模型对话作为上下文，然后再粘贴一条提示词正文。
> 本文件对模型呈现的是"AFP + Sokoban 关卡格式"的**最小充分知识**——不代替源码，但足够完成 A/B/C 三类任务。
> **维护者提醒**：本文件与实际代码可能漂移。修改本文件前先跑一遍事实核对，改后同步 `state.json.updatedAt`。

---

### AssemFlow · AI 实测上下文包（开始）

## 1 · 项目一句话

AssemFlow 是一个基于「装配流编程（AFP）」范式的软件装配框架。当前正用**推箱子（Sokoban）网页小游戏**做范式验证。你正在给这个项目提供辅助。

## 2 · AFP 三层分工（务必遵守）

AFP 把软件拆成五类东西，其中你**最常打交道**的三类：

- **装配块（block）**：纯机制、无业务、算法住这里。例：`move-with-push`、`win-check`。
- **配置（config）**：接线蓝图，纯 JSON/JSONC 数据，**不允许写算法**。例：`push.jsonc`。
- **数据（data）**：运行时数据，ASCII 关卡文件属这里。例：`level-push-1.txt`。

**硬边界（AFP 宪法级纪律）**：

- **算法不入配置**：if/else、循环、判定逻辑必须住在块的代码里。配置里只能做"字段重命名"级别的接线。
- **配置图静态可枚举**：不允许基于运行时数据的动态循环 / 动态分支。
- **运行期零 AI**：AI 只在设计期产配置，运行期由引擎确定执行。

**违背硬边界的产出会被拒绝**——例如"把滑行算法写进 jsonc" 是违规的。

## 3 · 现有装配块清单（Sokoban 相关）

### 块 `move-with-push`

**用途**：给定当前网格状态和一个方向，返回下一网格状态（含走路 + 一层推箱 + 撞墙 / 出界判定）。

**契约**：

- 输入：`{ grid: GridState, direction: "up" | "down" | "left" | "right" }`
- 输出：`{ nextGrid: GridState }`

**算法（住在块内，非配置）**：
1. 目标格 = 玩家位 + 方向增量
2. 目标格越界 or 是墙 → 玩家停在原格
3. 目标格无箱 → 玩家前进一格
4. 目标格有箱：
   - 若箱后一格越界 / 是墙 / 是另一个箱 → 停在原格
   - 否则玩家和箱各前进一格（一层推链，不推双箱）
5. 永远不"拉"

### 块 `win-check`

**用途**：给定一个网格状态，判定是否所有箱子都在目标格上。

**契约**：

- 输入：`{ grid: GridState }`
- 输出：`{ won: boolean }`

**算法**：`grid.boxes.every(b => grid.goals.some(g => g.x===b.x && g.y===b.y))`。

## 4 · 数据结构 GridState

网格状态是纯 JSON 数据。字段：

```ts
GridState = {
  width: number,              // 网格宽（列数）
  height: number,             // 网格高（行数）
  walls: Position[],          // 墙坐标数组
  goals: Position[],          // 目标格坐标数组（静态）
  player: Position,           // 玩家坐标（有且仅有一个）
  boxes: Position[]           // 箱子坐标数组（动态）
}

Position = { x: number, y: number }
```

**坐标约定**：x 向右、y 向下、原点 (0,0) 在**左上角**。

**为什么用 Position[] 而不是 Set**：全量状态穿透下坐标要在 JSON 里可见可审；Set 序列化会塌成 `{}`。

## 5 · ASCII 关卡格式（合法字符集）

Sokoban 沿用传统 7 字符集。关卡是一个纯文本 `.txt` 文件，每行一行网格：

| 字符 | 含义 |
| :-- | :-- |
| `#` | 墙 |
| ` ` (空格) | 地板（可走） |
| `.` | 目标格（空目标，玩家/箱子未在上面） |
| `$` | 箱子（不在目标格上） |
| `*` | 箱子在目标格上 |
| `@` | 玩家（不在目标格上） |
| `+` | 玩家在目标格上 |

**注意**：`*` = `.` + `$` 的合成态；`+` = `.` + `@` 的合成态。解析时它们分别拆成"该格有目标 + 该格有箱/玩家"。

## 6 · 关卡合法性 · base 4 条规则

装载前 `checkLevel()` 静态校验，四条规则**全跑不短路**（收集所有 issue）：

1. **`invalid-char`**：任何字符不在合法 7 字符集内 → 报"第 N 行第 M 列出现非法字符 'X'"（1-indexed）。
2. **`player-count`**：`@` + `+` 的总数必须**恰好等于 1**。
3. **`box-goal-imbalance`**：`$` + `*` 的总数必须**等于** `.` + `*` + `+` 的总数（箱数 = 目标数，**允许 0=0**）。
4. **`boundary-not-closed`**：从玩家 / 任一箱子出发做 4-连通 flood-fill 穿"非墙格"，若可达网格外边界的非墙格 → 边界不闭合。报"从关内可达非墙边缘格 (X, Y)，边界不闭合"（0-indexed）。

**CLI 用法**：

```
npx tsx experiments/exp06-sokoban/scripts/check-level.ts <path-to-level.txt>
```

Exit code：`0` 合法 / `1` 不合法 / `2` 缺参。不合法时 stderr 打印 `[rule] message`。

## 7 · 发表关额外硬约束（publishable）

若关卡进入 `src/levels/publishable/` 目录（用作对外可玩发布关），除了 base 4 条外还必须满足：

- `boxes.length >= 2`
- `goals.length >= 2`
- **开局非通关**（不允许"所有箱子已在目标格上"）

普通练习关（`src/levels/practice/`）无此三条硬约束。畸形关（`src/levels/malformed/`）故意违反规则用于回归测试。

## 8 · 一份合法关卡完整样例

`level-push-1.txt`（6×6，2 箱 2 目标，发表关）：

```
######
#    #
# .$ #
# $. #
# @  #
######
```

解析后（关键字段）：

```
width: 6
height: 6
walls: [(0,0)...(5,0), (0,1),(5,1), (0,2),(5,2), (0,3),(5,3), (0,4),(5,4), (0,5)...(5,5)]  // 20 面墙
goals: [(2,2), (3,3)]
player: (2,4)
boxes: [(3,2), (2,3)]
```

（该关是从"玩家在 (2,4)"出发、需要 9 步才能通关的一款设计——不需要给解，只作解析样例。）

## 9 · 一份畸形关卡 + CLI 报错样例

`level-malformed-leak.txt`（第 3 行末尾少一个 `#`）：

```
######
#@ . #
#  $ 
######
```

CLI 输出：

```
❌ level-malformed-leak.txt 未通过 base 静态 check（1 条 issue）
  [boundary-not-closed] boundary-not-closed: 从关内可达非墙边缘格 (5, 2)，边界不闭合
```

（hint `(5, 2)` 是 0-indexed，即"第 3 行、第 6 列"的位置。第 3 行 `#  $ ` 结尾少了 `#`，那格是空格、贴在网格右边界上、可从玩家 flood-fill 到达 → 泄漏。）

## 10 · 装配流配置：`push.jsonc`

现有推箱装配流两步顺序：

```jsonc
{
  "flowName": "sokoban-push",
  "steps": [
    {
      "block": "move-with-push",
      "inputMap": { "grid": "grid", "direction": "direction" }
    },
    {
      "block": "win-check",
      "inputMap": { "grid": "nextGrid" }
    }
  ]
}
```

**`inputMap` 语义**（重要）：只做**字段重命名**——`{blockField: contextKey}`。**不能**做嵌套构造、默认值、字面常量、类型转换（这是引擎当前的限制 Q-024，模型应遵守）。

**一次回合的数据流**：

```
initialInput { grid, direction }
   │
   ▼  step1: move-with-push
   │  inputMap: { grid ← context.grid, direction ← context.direction }
   │  块输出 { nextGrid }
   │
context.nextGrid 现已存在
   │
   ▼  step2: win-check
   │  inputMap: { grid ← context.nextGrid }
   │  块输出 { won }
   │
context.won 现已存在

调用方从 context 取 { nextGrid, won }
```

## 11 · 常见错误 pattern（AI 常踩的坑，请规避）

1. **不要**把算法（if/else、循环、条件判断）写进 jsonc 配置——那是硬边界违规。算法只能住在块的代码里。
2. **不要**在 `inputMap` 里塞计算或字面常量——它只能做字段重命名。
3. **不要**建议"给引擎加 loop step"——回合制场景引擎无一等 loop step 是**故意的**（详见 Q-027），主循环留在外部（浏览器 keydown 回调）。
4. **不要**用 `Set<string>` 表示坐标集合——序列化会塌成 `{}`。用 `Position[]` 数组。
5. **不要**擅自"升级"块继承体系——AFP 禁止继承，只用组合。
6. **不要**把关卡文件写成 JSON——关卡是纯文本 ASCII，不是结构化数据。
7. 关卡 ASCII 里**不要**在 `.` 位置放着一个 `$`——那应该合成为 `*`；同理 `.` + `@` = `+`。
8. **不要**在关卡文件里加装饰（HTML 注释、markdown fence、YAML front matter）——纯 ASCII 网格。

## 12 · 分工要点速记

| 你要做的事 | 应该改哪一层 |
| :-- | :-- |
| 改玩法算法（推箱规则、走路规则） | 装配块的代码 |
| 加新地形 / 新元素 | 契约 schema + 新装配块（+ 可能改配置） |
| 加新关卡 | 只加一份 ASCII 数据文件，配置/块不变 |
| 修复畸形关卡 | 只改数据文件 |
| 让玩家撞墙有音效 | 渲染层（脚手架，不属 AFP 数据流）|

### AssemFlow · AI 实测上下文包（结束）

---

## 维护者附注（不用粘贴给模型）

- 本上下文包**故意省略**：完整源码、测试文件、tutorial 全文、engine 内部细节。目的是模拟 LLM 拿到"最小必要资料"的场景。
- 若跑测发现"模型不知道 X"是主要失败因，考虑把 X 加进本文件；但要节制——每加一段都稀释信噪比。
- 版本对齐：本文件基于 exp06-sokoban 的 MVP-3 完成态（2026-07-03）。**若装配块契约、配置格式、字符集有变**，先更新本文件再跑新一轮实测。
