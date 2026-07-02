# Design Document

> Spec: sokoban-mvp-3-levels · Design
> 需求见同目录 `requirements.md`；全局共识、术语、Godot 参照、范式标记约定见 `docs/paradigm-validation-sokoban-roadmap.md`。
> 前置基线（本设计直接沿用，不再论证）：
> - MVP-1 · `sokoban-mvp-1-walk/design.md` 定的**外部主循环**（K-LOOP 结论）+ 转接件 `keyToDirection` + 渲染骨架 `render` + 浏览器脚手架 `main.ts`。
> - MVP-2 · `sokoban-mvp-2-push/design.md` 定的**推箱 + 胜利判定 + 发表关门禁**（`move-with-push` / `win-check` / `push.jsonc` / `stepPush` / `parseLevel` Sokoban 字符集 / `assertPublishableLevel`）。
> - MVP-2 · `experiments/exp06-sokoban/REPORT.md` 已确认：业务/装配层零非 AFP 标记、恰 1 处 `@paradigm NON-AFP: external-control-flow` 在 `src/main.ts`、方案 A 沿用未触发复审。
> 引擎现状基线：`engine/src/{types,assemble,check,registry}.ts` —— 单趟顺序遍历 `config.steps`、`inputMap` 只做字段重命名（Q-024 未触及）、无一等 loop step；MVP-3 **不改引擎**。

## Overview

MVP-3 只做三件事：把"加新关卡 = 只加一份 ASCII"稳定重复到 3 关（大 / 小 / 畸形），把校验能力从 MVP-2 的"装载期"扩展到 MVP-3 的"装载前"，把浏览器 demo 打开切关卡的开关。玩法本体（推箱 + 胜利判定 + 发表关门禁）不变，MVP-2 已经证明能玩到通关，本 MVP 不重造轮子。

核心设计取舍：

1. **两层校验体系分层落地，不重写 MVP-2 已实现的门禁。** MVP-2 的 `assertPublishableLevel`（≥2 箱 / ≥2 目标 / 开局非通关，仅发表关调用）**一字不改**——它就是本设计的 **publishability gate** 层。MVP-3 新增的 **base 静态 check** 是**独立的另一层**，跑在 `parseLevel` **之前**，对**所有**关卡负责"通用装载合法性"（恰一玩家、箱数=目标数含 0=0、字符集合法、边界闭合）。两层解耦、可组合、可独立跑：普通入口过 base check 即可玩；发表关入口 = base check + publishability gate 串行。走路对照资产 `level-walk-only.txt` 是 0=0 特例的正例——只过 base check、不进 gate；**不是默认关**（默认关 = `level-push-1`），但可通过 `?level=level-walk-only` URL 显式访问（作为对照资产存在于 LEVELS 中）。

2. **base check 与 `parseLevel` 共享底层 primitive `scanAscii`，杜绝"两份实现漂移"。** 承接 AC 2.4 与 MVP-1 白屏 bug 的教训（`main.ts` 与测试各自实现一份 JSONC 解析、差一个 `\r`），本 MVP 显式抽出**共享的低层扫描**：`scanAscii(text) → RawScan`（每类字符的坐标集合 + 原始行列信息）。`parseLevel` 与 `checkLevel` 都调它、都不重写扫描逻辑；改扫描规则只改一处。base check 与 `parseLevel` **接口层**独立（前者返 `LevelCheckResult`、后者返 `GridState`），**实现层**共享底层——这就是 AC 2.4 想要的"结果解耦但允许底层共享"。

3. **关卡切换机制 = URL 查询参数 + `import.meta.glob` 静态清单，不引入新范式标记。** 从 R1.5 三选一（URL / 下拉 / 快捷键）里选 **URL 查询参数** `?level=<name>`，理由展开在"设计取舍与另选拒绝"里。关卡清单用 Vite 的 `import.meta.glob` 分别扫两个子目录（`./levels/publishable/*.txt` + `./levels/practice/*.txt`）装载期静态搜集——**在打包期已知、有限、可枚举**，与 AFP"配置图静态可枚举"红线兼容；发表关分类由目录结构承担（见 §7）。URL 读取是**装载期一次性数据选择**，不是"跨回合控制流"，**不新增 `@paradigm` 标记**，也不扩大 MVP-2 已有 `@paradigm NON-AFP: external-control-flow` 的语义边界（详见 §7 与"AFP 纪律与范式标记"）。

4. **base check 同时提供函数形态与 CLI 形态。** 核心是纯函数 `checkLevel(ascii): LevelCheckResult`——可被 tests / `main.ts` / 生产装载路径直接 import，是 SSOT；CLI `scripts/check-level.mjs` 是**薄壳**，只做"读文件 → 调函数 → 打印诊断 → 设 exit code"，不重复实现校验逻辑。两个形态共享同一个函数，天然避免分叉。

5. **对 MVP-2 已实现代码的影响面 = 内部重构 `parseLevel` 委托 `checkLevel`，对外契约在合法输入下不变。** MVP-2 的 `parseLevel` 外部签名（`(text) => GridState`）、返回结构、**对合法输入的行为**全部不变——所有 MVP-2 现有单测应零改动继续绿（MVP-2 所有关卡文本使用的都是合法字符集 + 合法结构，`checkLevel` 通过 ⟺ `parseLevel` 不抛错、行为等价）。改的是内部：把"逐字符扫 ASCII 并做检查"改成"先跑 `checkLevel(text)`（校验四条规则），通过后**直接从 `checkLevel` 返回的 `scan` 字段**构造 `GridState`——`parseLevel` 不再单独调 `scanAscii`，`checkLevel` 内部一次扫描的结果通过返回值传递给上层，避免冗余扫描"。**新增行为**：`parseLevel` 现在也会拒绝含非法字符 / 边界不闭合 / 玩家计数错 / 箱目标不平衡的输入——校验逻辑集中在 `checkLevel` 一处（守 SSOT 铁律 2，不再有 parseLevel 与 checkLevel 双份实现漂移的可能）；MVP-2 关卡文本不受影响，但 MVP-3 需新增测试覆盖新增严格性。为避免 `grid.ts ↔ check.ts` 循环依赖，`scanAscii` 从 grid.ts 抽到独立文件 `src/scan-ascii.ts`（`grid.ts` 与 `check.ts` 都 import 它）。`assertPublishableLevel`、`move-with-push`、`win-check`、`push.jsonc`、`stepPush`、`render`、`input-adapter`、引擎 —— **全部不改**。

6. **本 MVP 业务/装配层继续保持纯 AFP、零 `@paradigm` 标记；`main.ts` 已有的 1 处 `@paradigm NON-AFP: external-control-flow` 语义不变。** 新增的 base check 是纯函数、URL 装载是纯装载期数据选择、关卡清单是打包期静态列表——三者都在 AFP 承诺范围内。MVP-2 REPORT 已确认的"业务/装配层零命中、恰 1 处标记在 `src/main.ts`"结论在本 MVP 收尾时仍需成立（见 Testing Strategy 的 SMOKE 段）。

7. **发表关分类通过目录结构承担，兑现"仅数据层变化即可加/切关"（R1.3 的强承诺）。** 原设计草稿把 `PUBLISHABLE_LEVELS` 硬编码为 `levels-manifest.ts` 里的 TypeScript 常量集合——但这与 R1.3 承诺的"无需修改任何代码，仅数据层变化即可添加或切换关卡"**直接冲突**：加一个发表关要改代码（添加到常量集合）。**修正**：把发表关分类从代码搬到目录结构——`src/levels/publishable/` 放发表关、`src/levels/practice/` 放普通关（对照资产 / 教学关）、`src/levels/malformed/` 放不进浏览器 LEVELS 的畸形关（只走 CLI）。`levels-manifest.ts` 用 `import.meta.glob` 分别扫这两个"要进 LEVELS 的目录"，`PUBLISHABLE_LEVELS` 从 `publishable/` 目录下的文件名派生——加一个发表关 = **扔一份 txt 到 `publishable/` 目录、不改一行代码**。这才是"配置图静态可枚举"+"仅数据层变化"的真正落地；也是 Q-028 关键证据"加关卡 = 加数据"在**统一路径下**（无论是普通关还是发表关）成立的物理保证。

### 设计取舍与另选拒绝（AFP 纪律现场表决）

按 skill `afp-discover-blocks` 的纪律，加东西前先问"能不能不加 / 能不能复用 / 能不能留在纯配置层"：

| 议题 | 候选 | 判读 | 决定 |
| :--- | :--- | :--- | :--- |
| **base check 与 parseLevel 的共享方式** | A. 完全独立、两份实现分别扫 ASCII | 违反 SSOT 铁律 2，正是 MVP-1 白屏 bug 的复发路径——AC 2.4 显式禁止 | ❌ 不采 |
|  | B. `checkLevel` 内部调 `parseLevel`（尝试装载、失败即报错） | 结果耦合：checkLevel 的合法性判定被 parseLevel 的"能装出 GridState 就算合格"绑架；且 parseLevel 目前对边界闭合 / 非法字符宽松处理，装得出 GridState 不代表合法 | ❌ 不采 |
|  | C. 抽出共享 primitive `scanAscii`，`parseLevel` 和 `checkLevel` 都调它 | 共享的是"最低层的字符位置读取"，各自在其上加自己的校验层（parseLevel 加 GridState 构造，checkLevel 加边界闭合 + 非法字符 + 完整性）；结果解耦、实现共享 | ✅ **采** |
| **base check 的 API 形态** | A. 只做 CLI | 无法在 `main.ts` / tests 里 import；重复实现或者靠 spawn 子进程都别扭 | ❌ 不采 |
|  | B. 只做函数 | 命令行验收路径要另写脚本；不符合"独立静态校验工具"的直觉（AC 2.1 提"作为独立命令行或函数使用"） | ❌ 不采 |
|  | C. 核心函数 + 薄壳 CLI（脚本 import 函数） | 函数是 SSOT、CLI 是使用者友好度；共享同一实现，天然不分叉 | ✅ **采** |
| **关卡切换机制** | A. URL 查询参数 `?level=<name>` | 纯装载期数据选择、可分享、可测试（jsdom 注入 location.search）、无美术资产、不引入按键跨回合控制流；关卡清单静态可枚举（Vite `import.meta.glob`） | ✅ **采** |
|  | B. 下拉选择器 | 需要 DOM UI 组件，触及美术资产范围（Out of Scope 明确排除）；切关需处理"当前进度是否重置"的额外交互，复杂度不必要 | ❌ 不采 |
|  | C. 快捷键循环（如 `N` 切下一关） | 是"跨回合控制流"——按 `N` 时机可能撞上"胜利后门控""关卡未完成想强跳"等分支，会诱使 `main.ts` 里加新的条件；且难以分享单关 | ❌ 不采 |
| **关卡清单的组织** | A. `levels.json` 手写 manifest | 加关要改两处（放 txt + 改 manifest），漂移风险回来了 | ❌ 不采 |
|  | B. 代码常量数组 | 同 A，且比 JSON 更容易忘更新 | ❌ 不采 |
|  | C. `import.meta.glob` 打包期自动搜集 | 加关只需扔 `levels/*.txt`，清单自动同步；打包期静态可枚举、无运行期动态发现 | ✅ **采** |
| **base check 的错误信息精度** | A. 全部精确到行列 | 边界闭合是"整体路径不通"，物理上无法精确到单一坐标 | ❌ 部分不可行 |
|  | B. 全部笼统"关卡不合法" | AC 2.3 明确禁止的降级 | ❌ 不采 |
|  | C. 分规则分级：非法字符 → 精确行列；边界闭合 → 最相关坐标（泄漏可疑点）；玩家 / 箱目标数 → 全局计数 | 符合 AC 2.3 的"最好精确到行列，物理上无法则最相关坐标"精神 | ✅ **采** |

### Godot 词汇映射（沿用路线图，仅增量）

| Godot 概念 | 本 MVP 新增/延续 |
| :--- | :--- |
| Resource（纯数据资源） | 3 份 ASCII 关卡 + walk-only 对照 → `import.meta.glob` 打包期搜集出静态清单 |
| Scene / 场景 | `push.jsonc`（MVP-2 已有，不改）承接所有合法关的玩法 |
| Scene 加载参数 | URL 查询参数 `?level=<name>` 选装载哪份 Resource；未指定 → 默认关 |
| Import 期校验 | base check（本 MVP 新增，装载前）+ publishability gate（MVP-2 已有，仅发表关装载后） |

明确拒绝（同路线图）：每帧 tick、Node 继承、Signal、多存档、关卡编辑器 UI、关卡预览页。

## Architecture

```
关卡数据（打包期 · 目录结构承担发表关分类）：
  experiments/exp06-sokoban/src/levels/
    ├── publishable/              （发表关：进 LEVELS + 进 PUBLISHABLE_LEVELS）
    │   ├── level-push-1.txt      （小·MVP-2 迁入 publishable/，6×6）
    │   └── level-push-big.txt    （大·MVP-3 新增，≥10×10）
    ├── practice/                 （普通关：进 LEVELS + 不进 PUBLISHABLE_LEVELS）
    │   └── level-walk-only.txt   （0=0 特例·MVP-2 迁入 practice/，走路对照）
    └── malformed/                （畸形关：不扫进 LEVELS，只走 CLI 报错）
        └── level-malformed-leak.txt  （新增·边界不闭合负例）
        ↓ 打包期扫两次：
          import.meta.glob('./levels/publishable/*.txt', ...)  → publishable
          import.meta.glob('./levels/practice/*.txt',    ...)  → practice
      levels-manifest.ts →
        LEVELS = { ...publishable, ...practice }
        PUBLISHABLE_LEVELS = new Set(Object.keys(publishable))   ← 从目录派生、非硬编码


┌─────────────────── 装载前（本 MVP 新增：base 静态 check）─────────────────────┐
│                                                                                │
│   ascii: string                                                                │
│     │                                                                          │
│     ▼                                                                          │
│   ┌─── src/check.ts ──────────────────────────────────────────────┐            │
│   │  checkLevel(ascii): LevelCheckResult                          │            │
│   │    ├─ scan = scanAscii(ascii)         ← 共享 primitive         │            │
│   │    ├─ 非法字符检查（精确行列）                                    │            │
│   │    ├─ 恰一玩家（`@` + `+` 总数 = 1）                             │            │
│   │    ├─ 箱数 = 目标数（含 0=0 合法）                                │            │
│   │    └─ 边界闭合（flood-fill，最相关坐标）                          │            │
│   │  返回 { ok: true } 或 { ok: false, issues: CheckIssue[] }      │            │
│   └───────────────────────────────────────────────────────────────┘            │
│     │                       │                                                  │
│     │                       └─ scripts/check-level.mjs（薄壳 CLI）              │
│     │                            读文件 → 调 checkLevel → 打印 → exit code    │
│     ▼                                                                          │
│   通过 → 进入装载期                                                             │
│                                                                                │
└────────────────────────────────────────────────────────────────────────────────┘


┌─────────────────── 装载期（MVP-2 已实现 · 不改）──────────────────────────────┐
│                                                                                │
│   ascii: string                                                                │
│     │                                                                          │
│     ▼                                                                          │
│   ┌─── src/grid.ts ───────────────────────────────────────────────┐            │
│   │  parseLevel(ascii): GridState                                 │            │
│   │    ├─ result = checkLevel(ascii)   ← 委托校验（SSOT · 无重复实现）│            │
│   │    │    │ 不合法 → 抛 Error（消息含 rule + message）             │            │
│   │    │    ↓ 合法                                                 │            │
│   │    ├─ scan = result.scan           ← 从 checkLevel 返回值取     │            │
│   │    │                                  （无冗余扫描；grid.ts 不直接依赖 scan-ascii.ts）│
│   │    └─ 由 scan.walls / goals / boxes / players[0] 构造 GridState│            │
│   └───────────────────────────────────────────────────────────────┘            │
│     │                                                                          │
│     │ 仅发表关：                                                                │
│     ▼                                                                          │
│   ┌─── src/grid.ts · assertPublishableLevel（MVP-2 已实现 · 一字不改）─┐         │
│   │    ├─ boxes.length >= 2                                        │           │
│   │    ├─ goals.length >= 2                                        │           │
│   │    └─ checkWin(grid) === false                                 │           │
│   └────────────────────────────────────────────────────────────────┘           │
│                                                                                │
└────────────────────────────────────────────────────────────────────────────────┘


┌─────────────────── 浏览器 · 装载入口（MVP-3 微改 main.ts）─────────────────────┐
│                                                                                │
│   页面加载 URL: /?level=<name>                                                  │
│     │                                                                          │
│     ▼                                                                          │
│   src/main.ts（@paradigm NON-AFP: external-control-flow 保持不变）             │
│     ├─ resolveLevelFromUrl(location.search, manifest, default)                │
│     │     → { name, rawText }                                                  │
│     ├─ base check: checkLevel(rawText)                                        │
│     │     失败 → 页面显示 "关卡不合法：..."，控制台可见 issues，不进入装配流       │
│     ├─ parseLevel(rawText) → initialGrid                                      │
│     ├─ 若关卡属发表关集合 → assertPublishableLevel(initialGrid)                 │
│     ├─ createPushRegistry() / parseJsonc(push.jsonc)                          │
│     └─ render(initialGrid, container) + 绑定 keydown（MVP-2 已实现门控 / R 重开） │
│                                                                                │
└────────────────────────────────────────────────────────────────────────────────┘


┌─────────────────── 每回合（MVP-2 已实现 · 完全不改）───────────────────────────┐
│   keydown → gate: won → return                                                 │
│         → keyToDirection → stepPush(cfg, reg, grid, dir)                       │
│                            └─ assemble: move-with-push → win-check             │
│         → 更新 grid + won → render                                              │
└────────────────────────────────────────────────────────────────────────────────┘
```

### 装载前 vs 装载期的责任划分

| 层 | 位置 | 何时跑 | 输入 | 输出 | 谁调 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **base 静态 check**（新） | `src/check.ts` · `checkLevel` | 装载**前**（可脱离浏览器 / 引擎独立跑） | ASCII 字符串 | `LevelCheckResult`（`{ ok, issues[] }`） | CLI · `main.ts` 装载入口 · tests |
| **装载期解析**（内部重构 · 委托 checkLevel） | `src/grid.ts` · `parseLevel` | 装载期 | ASCII 字符串 | 合法输入 → `GridState`；不合法 → 抛 `Error`（含非法字符 / 玩家计数错 / 箱目标不平衡 / 边界不闭合任一） | `main.ts` · tests |
| **发表关门禁**（保） | `src/grid.ts` · `assertPublishableLevel` | 装载期，仅发表关 | `GridState` | `void`（不通过抛 `Error`） | `main.ts` · tests |

两层校验合起来对**发表关**是这样的调用顺序：

```
rawText
  → checkLevel(rawText)           # 装载前 · 所有关都跑（含 0=0 特例）
    → { ok: true } | fail-fast    #   不合法：控制台/页面告诉用户为什么，不进后续
  → parseLevel(rawText)           # 装载期
  → assertPublishableLevel(grid)  # 仅发表关 · MVP-2 已有 · 一字不改
    → 不抛 | fail-fast             #   不达标：页面不渲染，控制台可见 Error
  → 进入正常玩法
```

对**普通关（如 walk-only、malformed 关的正例路径不存在——malformed 走 CLI 报错）**：`checkLevel` 通过即可装载，不进 `assertPublishableLevel`。

### 关卡切换机制的数据流

```
打包期（Vite · 目录结构承担发表关分类）：
  import.meta.glob('./levels/publishable/*.txt', { as: 'raw', eager: true })
    → { './levels/publishable/level-push-1.txt': "######\n#...\n...",
        './levels/publishable/level-push-big.txt': "..." }
  import.meta.glob('./levels/practice/*.txt',    { as: 'raw', eager: true })
    → { './levels/practice/level-walk-only.txt': "..." }
  （注：'./levels/malformed/*.txt' 不扫入 LEVELS；畸形关只走 CLI 报错验收）

    ↓ src/levels-manifest.ts 里 normalize（去路径 + 去 .txt 后缀）
  publishable = { "level-push-1": "...", "level-push-big": "..." }
  practice    = { "level-walk-only": "..." }

    ↓ 组装
  LEVELS = { ...publishable, ...practice }              ← 全部可通过 URL 装载的关
  DEFAULT_LEVEL = "level-push-1"                          ← URL 未指定时的默认关
  PUBLISHABLE_LEVELS = new Set(Object.keys(publishable))  ← **从 publishable/ 目录派生**、非硬编码

运行期（浏览器）：
  location.search = "?level=level-push-big"
    → resolveLevelFromUrl(search, LEVELS, DEFAULT_LEVEL)
    → { name: "level-push-big", rawText: LEVELS["level-push-big"] }
    → base check → parseLevel → 若在 PUBLISHABLE_LEVELS 则 assertPublishableLevel
```

**为什么这不触碰 AFP 硬边界**：

- **算法不入配置**：清单只是文件系统扫描出的静态数据，没有条件/循环嵌进配置。
- **配置图静态可枚举**：`LEVELS` 是打包期就固化的 `Record<string, string>`；`PUBLISHABLE_LEVELS` 从 `publishable/` **目录派生**——AI agent 或人类看 `ls src/levels/publishable/` 就能一眼列全（`grep` 反查代码里的字符串常量也一致——因为没有硬编码常量、只有从目录 keys 派生的 Set）。
- **URL 参数只是"用户选哪份数据"的一等入口**：不是运行期条件分支加进配置，是**装载前**的一次数据选择。相当于 Godot 里"在启动时决定加载哪个 `.tscn` 场景"，场景本身还是那套静态资源。
- **"仅数据层变化"兑现**：加发表关 = 扔 txt 到 `src/levels/publishable/`；`PUBLISHABLE_LEVELS` 通过目录派生**自动包含新关**——不改一行代码。加普通关同理（扔到 `practice/`）。这是 R1.3 强承诺的物理保证。

## Components and Interfaces

### 1. 共享底层扫描 `src/scan-ascii.ts` · `scanAscii`（AFP 纯机制 · 新增独立文件 · 新增内部 primitive）

MVP-3 新增独立文件（**为什么独立文件而非放在 grid.ts 里**：三条理由——(1) **职责单一**：扫描是纯粹的字符位置读取机制，与"装载语义"（parseLevel）和"校验语义"（checkLevel）都独立、值得单独一层；(2) **`check.ts` 完全独立于装载层**：如果 scanAscii 留在 grid.ts，check.ts 会不得不依赖 grid.ts 才能扫描——这让 check.ts 无法独立于装载语义单独跑；(3) **测试可独立跑**：scanAscii 有自己的单测文件 `scan-ascii.test.ts`，独立文件让职责边界清晰。当前依赖链 `grid.ts → check.ts → scan-ascii.ts` 单向、无环）。承接 AC 2.4 的"允许底层共享"，把 MVP-2 `parseLevel` 内部的逐字符扫描抽出来独立命名：

```ts
/**
 * 装载/校验共享的最低层原语：把 ASCII 关卡文本扫描成"每类字符的位置集合"。
 * 不做完整性校验（那是 parseLevel / checkLevel 的活）；只负责"把文本读成结构化坐标"。
 * 纯函数：同 text 同结果，不读时钟 / 不随机 / 不调 AI。
 */
export interface RawScan {
  readonly width: number;          // 最长行的字符数
  readonly height: number;         // 行数（不含末尾空行）
  readonly walls:   readonly Position[];   // '#'
  readonly goals:   readonly Position[];   // '.' + '*' + '+'（'*'/'+' 同时进 goals）
  readonly boxes:   readonly Position[];   // '$' + '*'（'*' 同时进 boxes）
  readonly players: readonly Position[];   // '@' + '+'（'+' 同时进 players）
  readonly invalidChars: readonly { pos: Position; ch: string }[];  // 落在合法字符集外的记录
}

export function scanAscii(text: string): RawScan;
```

**契约**：

- **合法字符集** = `# . <space> @ $ * +` + 换行；`\r` 兼容（先 `text.replace(/\r/g, "")`）。
- **末尾连续空行去掉**（与 MVP-2 现行 `parseLevel` 行为一致）。
- **`invalidChars` 是权威记录**：`checkLevel` 与 `parseLevel` 都以此为准判定"字符集合法性"——`parseLevel` 现在也会遇非法字符抛错（本 MVP 严格化，见 Overview §5 与 §6.5）；不再存在"parseLevel 忽略 invalidChars"这条宽松路径。
- **`*` / `+` 计数说明**：`*` 同时计入 `boxes` 和 `goals`；`+` 同时计入 `players` 和 `goals`。因此上层用 `boxes.length === goals.length` 比较箱目标数守恒是**语义正确的**——`*` 两边等量增加、等式不变；`+` 只加 `goals` 一边、`.` 也只加 `goals` 一边（`+` 是"玩家在目标上"、贡献玩家和目标）。审查者若停下来算过：不必再算，这里已经明确。
- **Ragged line 语义（显式声明）**：短行末尾缺失的列位置**不进入任何集合**（不算 walls / goals / boxes / players / invalidChars）。上层（`parseLevel` / `checkLevel`）在 4-连通 flood-fill 或坐标合法性判断时**把这类位置视为"网格内的非墙空地"（可通行）**——这与 MVP-2 `parseLevel` 既有行为一致（MVP-2 只扫描到 `line.length` 为止），也是 Sokoban 社区约定（行尾空格 = 空地）。畸形关 `level-malformed-leak.txt` 的"外墙缺口"判定依赖此语义。
- **中间空行语义**：中间空行（`\n\n` 中间那一行、行内容为空字符串）视为"满宽度的一整行可通行非墙空地"——与短行末尾缺失同语义。合法关不含中间空行；畸形关若含中间空行且导致边界泄漏，`boundary-not-closed` rule 会自然报出（**不新增专门检测"含中间空行"的 rule**——保持四条 rule 不扩张）。
- 不做任何"角色数、箱目标数、边界闭合"的判断——那些留给上层。

### 2. base 静态校验 `src/check.ts`（AFP 纯机制 · 新增 · 独立文件）

```ts
export type CheckRule =
  | "invalid-char"
  | "player-count"
  | "box-goal-imbalance"
  | "boundary-not-closed";

/**
 * 单条诊断。location 分级：
 *   - invalid-char       → { line, column }（精确到行列）
 *   - boundary-not-closed → { hint: Position }（泄漏路径的一个可疑坐标，flood-fill 命中的第一个边缘格）
 *   - player-count / box-goal-imbalance → 无 location（全局计数信息在 message 里说清）
 */
export interface CheckIssue {
  readonly rule: CheckRule;
  readonly message: string;
  readonly location?: { line: number; column: number } | { hint: Position };
}

export type LevelCheckResult =
  | { readonly ok: true; readonly scan: RawScan }
  | { readonly ok: false; readonly issues: readonly CheckIssue[] };

/**
 * base 静态 check：装载前跑。纯函数、可脱离浏览器/引擎/DOM 独立调。
 * 内部调 scanAscii；`parseLevel` 通过本函数返回值的 scan 字段间接复用 scanAscii 的结果
 * ——AC 2.4 的"底层共享"落点在此（parseLevel 不直接调 scanAscii，避免任何"绕开 checkLevel 自行扫描"的路径）。
 *
 * **成功时（ok: true）返回值携带 RawScan** —— 供 parseLevel 直接复用构造 GridState，
 * 避免"parseLevel 再扫一次"的冗余扫描；失败时（ok: false）只返 issues 不返 scan
 * （scan 存在意义仅在合法关卡下——不合法关的 scan 依然存在但不安全用来构造 GridState）。
 *
 * 校验规则（全跑一遍收集所有 issues，不短路——设计意图是"一次跑完把该说的话说完"）：
 *   1. 非法字符：合法字符集外的字符 → 每个字符一条 issue（含精确行列）
 *   2. 恰一玩家：'@' 与 '+' 总数 ≠ 1 → 一条 issue（含实际计数）
 *   3. 箱数 = 目标数（含 0=0）：不等 → 一条 issue（含实际计数）
 *      注：`scanAscii` 已把 `*` 同时计入 `boxes` 与 `goals`——等式两边等量增加、不影响不平衡判定的语义（详见 scanAscii 契约"* / + 计数说明"一节）。
 *   4. 边界闭合：从每个玩家 / 箱子 flood-fill 4-连通穿"非墙格"，若可达 x=0/x=width-1/y=0/y=height-1
 *      的非墙边缘格 → 一条 issue（hint = flood-fill 到达的第一个边缘格坐标）
 */
export function checkLevel(text: string): LevelCheckResult;
```

**边界闭合算法**（flood-fill 洪水填充；纯函数）：

```
输入：RawScan（已知 walls / goals / boxes / players 与 width / height）
初始 frontier = 所有 players + 所有 boxes 的坐标（合法关这些都必须在闭合区域内）
visited = 空集

while frontier 非空:
  取一个坐标 (x, y) 出来
  若已 visited 跳过
  加入 visited
  若 (x,y) 落在边界上（x==0 或 x==width-1 或 y==0 或 y==height-1）且不是 walls：
    返回 { leaked: true, hint: (x, y) }
  对 4 个邻居 (x±1, y) / (x, y±1)：
    若邻居 (nx, ny) 在网格内（0 <= nx < width, 0 <= ny < height）
    且不在 walls 中
    且未 visited
    则加入 frontier

结束时未泄漏 → { leaked: false }
```

**为什么从"玩家/箱子"起 flood-fill 而不是从"关外"起**：从关外起需要构造一层虚拟外圈；从关内已知点（玩家/箱子必在闭合区内）起更直接、且天然要求"玩家/箱子存在"这一前置。若 `RawScan.players` 空 —— rule 2 已在 `checkLevel` 内先报，边界闭合检查跳过（无参照点）。

**错误信息精度分级**（对应 AC 2.3）：

| 规则 | 精度 | 举例（错误消息模板） |
| :--- | :--- | :--- |
| `invalid-char` | 精确到行列 | `"invalid-char: 第 3 行第 5 列出现非法字符 'X'（合法字符集为 # . <space> @ $ * +）"` |
| `player-count` | 全局计数 | `"player-count: 需要恰好 1 个玩家（'@' 或 '+'），当前找到 0 个"` |
| `box-goal-imbalance` | 全局计数 | `"box-goal-imbalance: 箱数（3）≠ 目标数（2）；允许 0=0 特例"` |
| `boundary-not-closed` | 最相关坐标 | `"boundary-not-closed: 从关内可达非墙边缘格 (7, 2)，边界不闭合"` |

设计意图：**能精确到行列的规则一定给行列；物理上无法精确的（边界闭合是"一条路径的连通性"，不存在单一"错误坐标"）给最相关点作为定位提示**。这是 AC 2.3 允许的降级路径，且明确高于"关卡不合法"的笼统兜底。

### 3. 薄壳 CLI `scripts/check-level.mjs`（新增 · 使用 base check 函数）

```js
#!/usr/bin/env node
// 用法：node scripts/check-level.mjs <path/to/level.txt>
// 或（package.json 加脚本后）：npm run check-level -- <path/to/level.txt>
//
// 只做四件事：读文件 → 调 checkLevel → 打印诊断 → 设 exit code。
// 不重复实现任何校验逻辑（SSOT · 铁律 2）——校验逻辑的唯一真相源是 src/check.ts。

import { readFileSync } from "node:fs";
import { checkLevel } from "../src/check.ts";  // Vite 打包外，用 tsx 或 tsc 产物跑

const path = process.argv[2];
if (!path) { console.error("用法：check-level <path/to/level.txt>"); process.exit(2); }

const text = readFileSync(path, "utf-8");
const result = checkLevel(text);

if (result.ok) {
  console.log(`✅ ${path} 通过 base 静态 check`);
  process.exit(0);
} else {
  console.error(`❌ ${path} 未通过 base 静态 check（${result.issues.length} 条 issue）`);
  for (const issue of result.issues) {
    console.error(`  [${issue.rule}] ${issue.message}`);
  }
  process.exit(1);
}
```

**执行方式**：`package.json` 加 `"check-level": "tsx scripts/check-level.mjs"`，实现里 `import { checkLevel } from "../src/check.ts"`——通过 `tsx` 直接跑 TypeScript 源码，避开一份编译产物。这与实验目录目前 `"typecheck": "tsc --noEmit"` 的取舍一致（只做类型检查、不产 dist）。

**Exit code 语义**：

- `0`：合法。
- `1`：不合法（含至少一条 issue）；stderr 印出所有 issues。
- `2`：调用错（缺参数）。

### 4. 关卡清单 `src/levels-manifest.ts`（AFP 数据 · 装载期一次搜集）

```ts
/**
 * 打包期分别扫两个子目录——目录结构承担发表关分类，兑现 R1.3"仅数据层变化即可加/切关"。
 * import.meta.glob 是 Vite 的打包期 API：在打包 / dev server 起来前扫目录、把结果编成
 * 静态 map 塞进 bundle——运行期不再动态发现，符合"配置图静态可枚举"。
 *
 * 注：src/levels/malformed/ 不扫——畸形关不进浏览器 LEVELS，只走 CLI 报错验收路径。
 */
const publishableModules = import.meta.glob("./levels/publishable/*.txt", { as: "raw", eager: true });
const practiceModules    = import.meta.glob("./levels/practice/*.txt",    { as: "raw", eager: true });

/** 提取"去路径去后缀"的短名，例如 './levels/publishable/level-push-1.txt' → 'level-push-1'。 */
function normalize(modules: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [path, text] of Object.entries(modules)) {
    const name = path.split("/").pop()!.replace(/\.txt$/, "");
    result[name] = text;
  }
  return result;
}

const publishable = normalize(publishableModules);
const practice    = normalize(practiceModules);

/**
 * 全部可通过 URL 装载的关（发表关 + 普通对照关）。
 * LEVELS[levelName] = rawText，levelName = 去掉路径与 .txt 后的短名。
 * 例：LEVELS["level-push-1"] = "######\n#....."
 */
export const LEVELS: Readonly<Record<string, string>> = { ...publishable, ...practice };

/** 默认关：URL 未指定 ?level 时用这份。 */
export const DEFAULT_LEVEL = "level-push-1";

/**
 * 发表关白名单——**从目录结构派生**（`publishable/` 目录下的所有关卡）。
 * 加一个发表关 = 扔一份 txt 到 `src/levels/publishable/` 目录，**不改一行代码**——
 * 兑现 R1.3"仅数据层变化即可添加或切换关卡"的强承诺。
 */
export const PUBLISHABLE_LEVELS: ReadonlySet<string> = new Set(Object.keys(publishable));
```

**为什么用目录结构派生而非代码常量硬编码**（本条替代了草稿设计里的"显式声明白名单"取舍）：

- **兑现 R1.3 的强承诺"仅数据层变化即可添加或切换关卡"**：若 `PUBLISHABLE_LEVELS` 是代码里的字符串数组，加一个发表关就要改代码（添加到数组）——这与 R1.3 直接冲突，也直接削弱 Q-028 关键证据"加关卡 = 加数据"（会变成"普通关 = 加数据，发表关 = 加数据 + 改代码"）。目录结构派生后，加发表关 = **扔一份 txt 到 `publishable/` 目录、不改一行代码**。
- **"用途"由目录承担、不由数据推导**：`publishable/` 与 `practice/` 是**设计者的显式分类选择**（教学关放 practice、发表关放 publishable），不是"≥2 箱 ≥2 目标就自动是发表关"的数据副产品——避免把将来加的教学关误分类。
- **AFP"配置即图"要求关键分类可见**：目录结构本身就是分类图；`ls src/levels/publishable/` 一览无遗；不需要读代码去反查白名单。
- **走路对照资产 `level-walk-only.txt`（0=0）明确落 `practice/` 目录** —— 不进 gate 由目录承担；不用在代码里加"若 0=0 跳过"的负判。

### 5. URL 装载入口 `src/main.ts` 微改（AFP 承诺范围外 · 已有 `@paradigm` 语义不变）

MVP-3 只往 `main.ts` 加**装载期**的一段代码；MVP-2 已有的门控 / R 重开 / try-catch 全部保留、语义不变、**不扩大 `@paradigm NON-AFP: external-control-flow` 的适用范围**。新增段：

```ts
/**
 * 装载期解析 URL 中的 level 参数。纯函数（同 search 同结果），
 * 属于装载前"用户选哪份数据"的一次性数据选择，非跨回合控制流——
 * 因此不新增 @paradigm 标记；main.ts 头部现有的 @paradigm 只覆盖回合门控 /
 * 终局拦截 / R 重开三条控制流，与本函数无关。
 */
export function resolveLevelFromUrl(
  search: string,
  levels: Readonly<Record<string, string>>,
  defaultLevel: string,
): { name: string; rawText: string } {
  const params = new URLSearchParams(search);
  const requested = params.get("level");
  if (requested && levels[requested]) {
    return { name: requested, rawText: levels[requested] };
  }
  // 未指定 或 指定了不存在的关 → 用默认关；后者可选在控制台 warn，不阻断（对用户友好）
  if (requested) console.warn(`[sokoban] 未知关卡 "${requested}"，回退到默认关 "${defaultLevel}"`);
  return { name: defaultLevel, rawText: levels[defaultLevel] };
}
```

`main.ts` 装载段替换为：

```ts
import { LEVELS, DEFAULT_LEVEL, PUBLISHABLE_LEVELS } from "./levels-manifest.js";
import { checkLevel } from "./check.js";

const { name: levelName, rawText: levelText } = resolveLevelFromUrl(
  window.location.search, LEVELS, DEFAULT_LEVEL,
);

// 装载前：base 静态 check（所有关都跑）
const checkResult = checkLevel(levelText);
if (!checkResult.ok) {
  // 不进装配流；页面显示可读诊断 + 控制台可见 issues 数组
  console.error("[sokoban] base check 未通过：", checkResult.issues);
  container.textContent =
    `关卡 "${levelName}" 未通过 base 静态 check：\n` +
    checkResult.issues.map(i => `  [${i.rule}] ${i.message}`).join("\n");
  throw new Error(`base check failed for level "${levelName}"`);  // fail-fast，模块图停在这里
}

// 装载期
let currentGrid: GridState = parseLevel(levelText);
if (PUBLISHABLE_LEVELS.has(levelName)) {
  assertPublishableLevel(currentGrid);  // MVP-2 已实现 · 一字不改
}

// 以下沿用 MVP-2：createPushRegistry / parseJsonc / render / 绑定 keydown / R 重开 / 门控 / try-catch
```

**R 键重开路径同步微改**：MVP-2 的 R 键分支现在 `parseLevel(levelText)` 用的 `levelText` 由 URL 解析得来，仍然只重装同一份文本、不重跑 `checkLevel`（首次装载已过），也不重复 `assertPublishableLevel`。语义与 MVP-2 相同。

**可测试性 · 抽装载段为装载期一次性函数 `bootstrap`（可注入依赖 · 可测试 · tasks 阶段落地）**：

现在 `main.ts` 顶层直接跑装载逻辑（`resolveLevelFromUrl` + `checkLevel` + `parseLevel` + `assertPublishableLevel` + `render`），tests 层难以覆盖——ES module 只 import 一次；`window.location.search` 是 read-only（jsdom 可赋值但脆弱）；`import.meta.glob` 在 tests 里 mock 别扭。

为让 `tests/main-url-loading.test.ts`（jsdom EXAMPLE）可实施，tasks 阶段把装载逻辑抽成**装载期一次性函数**（deterministic + 可注入依赖 + 单次调用 · **不是纯函数**：有 DOM 副作用，见下方 `@paradigm` 论证段）：

```ts
// 建议签名 —— tasks 阶段可微调
export function bootstrap(
  container: HTMLElement,
  urlSearch: string,
  levels: Readonly<Record<string, string>>,
  defaultLevel: string,
  publishableLevels: ReadonlySet<string>,
): { currentGrid: GridState; levelText: string; levelName: string };
```

`main.ts` 顶层只做一句调用：`bootstrap(document.getElementById('grid')!, window.location.search, LEVELS, DEFAULT_LEVEL, PUBLISHABLE_LEVELS)`。tests 直接 import `bootstrap` 并注入 mock levels + 任意 urlSearch，不需要 mock `import.meta.glob`、不需要多次 import main.ts。

**依然不新增 `@paradigm` 标记**——`bootstrap` 是**装载期一次性函数**（不是"纯函数"——它有 DOM 副作用：调 `render()` + `window.addEventListener('keydown', ...)`；但**同参数产生同 DOM 效果**、且**装载期只调用一次**、不涉及跨回合控制流）。`main.ts` 头部现有的 `@paradigm NON-AFP: external-control-flow` 语义**仍只覆盖回合门控 / 终局拦截 / R 重开三条控制流**（这些在 keydown 回调内、`bootstrap` 只是把回调注册进去、控制流本身没移入 bootstrap），与 bootstrap 无关——因此 bootstrap 不新增标记。

### 6. 关卡资产（数据）· 增删

| 文件（**目录结构承担分类**） | 状态 | 内容说明 |
| :--- | :--- | :--- |
| `src/levels/publishable/level-push-1.txt` | **迁入 publishable/**（原在 `src/levels/`） | 小关卡·发表关正例·可通关 |
| `src/levels/publishable/level-push-big.txt` | **新增** | 大关卡·发表关正例·可通关·≥10×10 |
| `src/levels/practice/level-walk-only.txt` | **迁入 practice/**（原在 `src/levels/`） | 0=0 特例正例·普通关·URL 可访问但不进 gate |
| `src/levels/malformed/level-malformed-leak.txt` | **新增·独立目录**（不扫入 LEVELS） | 畸形负例·仅走 CLI 报错路径 |

**迁移动作**（tasks 阶段落地时按此执行）：

1. 创建目录 `src/levels/publishable/`、`src/levels/practice/`、`src/levels/malformed/`
2. `git mv src/levels/level-push-1.txt src/levels/publishable/level-push-1.txt`
3. `git mv src/levels/level-walk-only.txt src/levels/practice/level-walk-only.txt`
4. 新建 `src/levels/publishable/level-push-big.txt` + `src/levels/malformed/level-malformed-leak.txt`
5. **更新 MVP-2 遗留的路径引用**：
   - `src/main.ts` 里 `import levelText from "./levels/level-push-1.txt?raw"` → `"./levels/publishable/level-push-1.txt?raw"`
   - `tests/assemble-walk.test.ts` 等对 `level-walk-only.txt` 的路径引用（若有）→ 更新到 `practice/` 子路径
   - MVP-2 已有 tests **路径变、行为不变**：所有断言保留、只微改 import 路径

**畸形关 ASCII 示例**（供 tasks 阶段落地时手工微调；核心是"外圈墙有缺口，从玩家可 flood-fill 到网格边缘"）：

```
######
#@ . #
#  $ 
######
```

第 3 行 `#  $ ` 末尾缺少右墙 `#`——从玩家 `(1,1)` 出发 4-连通穿非墙格，可以走到 `(5,2)`（右边缘的非墙格），触发 `boundary-not-closed`。`checkLevel` 应返回 `{ ok: false, issues: [{ rule: "boundary-not-closed", message: "... 可达非墙边缘格 (5, 2) ...", location: { hint: { x: 5, y: 2 } } }] }`。

**大关卡草图**（≥10×10；tasks 阶段落地时验证可解性 + 视觉平衡）：

```
############
#          #
# ##  .    #
# $   .    #
#   #      #
#   #  $   #
#   ####   #
#       $. #
#          #
# @      . #
############
```

**注意 · 本草图故意不完整**：当前只有 **3 箱**（`(2,3) (7,5) (8,7)`）与 **4 目标**（`(6,2) (6,3) (9,7) (9,9)`）——**箱目标数不平衡**（base check rule 3 会拒绝）。这是**刻意的**——设计层不预先固化关卡布局。tasks 阶段的动作：

1. **补第 4 个箱**到能推到某个 goal 的位置（保证 4=4 平衡且可通关，避免"箱贴墙推不动"的 dead-end）
2. 用 `assemble-push` 端到端跑一遍通关序列作**解性证明**
3. 用 `checkLevel` 跑一遍确认过 base check + gate

**设计意图约束**（tasks 阶段必守）：约 4 箱 4 目标、玩家在左下 `(2,9)`、通道分隔避免"一步推到位"的平凡解、`≥10×10` 网格。**具体箱位置** tasks 阶段自由决定（不做 PCG，手工设计）。

### 6.5. MVP-2 `parseLevel` 内部重构 · 委托 `checkLevel`（对外契约在合法输入下不变）

不新增文件；只重构 `src/grid.ts` 中的 `parseLevel`——把校验逻辑委托给 `checkLevel`，`parseLevel` 只负责"合法关的数据构造"：

```ts
// 重构前（MVP-2）：内部逐字符扫描 + 内部检查（恰一玩家、箱数=目标数）+ 构造 GridState
// 重构后（MVP-3）：委托 checkLevel + 从 checkLevel 返回值里的 scan 字段构造 GridState

import { checkLevel } from "./check.js";  // 注意：grid.ts 只依赖 check.ts，不直接依赖 scan-ascii.ts

export function parseLevel(text: string): GridState {
  const result = checkLevel(text);
  if (!result.ok) {
    // MVP-2 抛错语义保持：Error.message 包含至少一条 issue 的 rule + message，
    // 便于调用方（含 MVP-2 已有 tests）识别原因
    const primary = result.issues[0];
    throw new Error(`parseLevel: ${primary.rule} — ${primary.message}`);
  }
  // 直接从 checkLevel 返回的 scan 字段取 —— 无冗余扫描（checkLevel 内部已调过一次 scanAscii）
  const { scan } = result;
  return {
    width: scan.width, height: scan.height,
    walls: scan.walls, goals: scan.goals,
    player: scan.players[0], boxes: scan.boxes,
  };
}
```

**为什么委托 `checkLevel` 而非只共享 `scanAscii`**：

- **SSOT 铁律 2 · 校验逻辑仅一处**：所有校验规则（恰一玩家 / 箱目标数守恒 / 边界闭合 / 字符集合法）集中在 `checkLevel` 一处；`parseLevel` 不重复实现——彻底根除"两份实现漂移"的风险（MVP-1 白屏 bug 的复发路径）。
- **Property 6 从属性测试守法升级为结构性守卫**：`checkLevel(text).ok ⟺ parseLevel(text) 不抛错` 从"断言"变成"结构性必然"（`parseLevel` 内部就是 `checkLevel`）——Property 6 fast-check 仍保留，但角色从"证明等价"变为"若哪天有人绕过 checkLevel 自己重写扫描会立刻被抓到"的执行守卫。
- **依赖方向合理**：`grid.ts → check.ts → scan-ascii.ts` 单向链，无环。校验层依赖扫描层、装载层依赖校验层——每一层依赖比它更"低阶"的层。
- **MVP-2 兼容性成立**：MVP-2 关卡文本全部用合法字符集 + 合法结构；`checkLevel` 通过 ⟺ `parseLevel` 不抛错——行为等价。MVP-2 现有 tests 零改动继续绿。
- **新增严格性只对畸形输入生效**：MVP-3 后 `parseLevel` 会拒绝含非法字符 / 边界不闭合的输入（MVP-2 没测过这类）——MVP-3 新增测试须覆盖这些新增抛错路径。
- **无冗余扫描**：`checkLevel` 内部调一次 `scanAscii`，`parseLevel` 通过 `checkLevel` 返回值 `result.scan` 直接拿到扫描结果——**不再重复调用 `scanAscii`**。依赖链简单：`grid.ts → check.ts → scan-ascii.ts`，`grid.ts` 不直接依赖 `scan-ascii.ts`（进一步收敛依赖面）。

### 7. `src/render.ts` / `push.jsonc` / `input-adapter.ts` / `driver.ts` / 引擎 —— **不改**

MVP-3 与它们无关。R1.4 明确"关卡增/删/改，引擎代码、装配块、转接件全部不变；仅数据层变化"——本设计严守此点。

## Data Models

```ts
// MVP-3 新增（内部 primitive）
interface RawScan {
  width: number;
  height: number;
  walls:   Position[];
  goals:   Position[];
  boxes:   Position[];
  players: Position[];
  invalidChars: { pos: Position; ch: string }[];
}

// MVP-3 新增（对外 API）
type CheckRule =
  | "invalid-char"
  | "player-count"
  | "box-goal-imbalance"
  | "boundary-not-closed";

interface CheckIssue {
  rule: CheckRule;
  message: string;
  location?: { line: number; column: number } | { hint: Position };
}

type LevelCheckResult =
  | { ok: true; scan: RawScan }     // 成功时携带 scan，供 parseLevel 直接复用
  | { ok: false; issues: CheckIssue[] };

// MVP-2 已有（不改）
interface Position { x: number; y: number; }
interface GridState {
  width: number; height: number;
  walls: Position[]; goals: Position[];
  player: Position; boxes: Position[];
}
type Direction = "up" | "down" | "left" | "right";

// 关卡清单（打包期静态数据）
const LEVELS: Readonly<Record<string, string>>;   // Vite import.meta.glob eager
const DEFAULT_LEVEL: string;
const PUBLISHABLE_LEVELS: ReadonlySet<string>;    // 发表关白名单
```

### 为什么 `RawScan` 内不带派生态字段

`walls / goals / boxes / players` 都是坐标集合——**单一真相是坐标**，就位态（`isBoxOnGoal`）继续留在 `grid.ts` 作派生函数，不进 `RawScan`。这与 MVP-2 决定不把 `boxOnGoal` 塞进 `GridState` 一脉相承（避免"就位态字段"与"坐标"漂移）。

### 为什么 `invalidChars` 是 `{ pos, ch }` 而不是 `Position[]`

`checkLevel` 报错消息要能说出"出现了什么字符"（"第 3 行第 5 列出现非法字符 'X'"）——只有坐标不够，得带原始字符。这一层信息在扫描时"顺手"就能记录，等到 checkLevel 再扫一遍原文就是重复劳动（也就是 MVP-1 白屏 bug 那类漂移路径）。

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

> 本节由 prework 分析导出。Property Reflection 已做以下合并/降级，避免重复守同一条不变量：
>
> - **合并**：AC 2.2（"四条规则各自能查出"）与 AC 2.3（"诊断信息精度"）在物理上同源——同一条 issue 的两个断言维度。四条规则的 PROPERTY 各自把 location 精度断言塞进去，AC 2.3 不单列独立 PROPERTY，作为 Property 2–5 的共同附加断言存在。
> - **合并**：AC 1.3 前半"分层判定的等价性"吸收 AC 2.2 的正面基线"完全合法关 → ok"——后者是前者的直接子命题（普通入口 ⟺ checkLevel.ok 中的"当合法 ⇒ ok"半边），单独拉一条会与 Property 6 重复。
> - **降级**：AC 1.1（"关卡能装为可玩状态"）是集成层断言，由三关 EXAMPLE 端到端覆盖（见 Testing Strategy），不单列 PROPERTY。
> - **降级**：AC 2.4 B"CLI 与函数等价"降级为 EXAMPLE——跨进程跑 fast-check 成本高，CLI 逻辑仅"读文件 + 调函数 + 打印 + exit code"四行，EXAMPLE 足以守（详见 Testing Strategy）。
> - **降级**：AC 1.4"关卡增/删/改不动引擎与装配块"是架构层不变量，由 git diff + MVP-2 单测零改动继续绿 SMOKE 覆盖，不单列 PROPERTY。

### Property 1: 共享 primitive 一致性（结构守卫 · tautology in current design）

**诚实标注**：本 property 在当前 MVP-3 设计（`parseLevel` 委托 `checkLevel` + 从其返回的 `scan` 构造 GridState）下是**结构性重言式**——GridState 的坐标数据源就是 `checkLevel(text).scan`，而 `checkLevel` 内部就是调 `scanAscii(text)`，两侧扫描结果必然相同。**fast-check 找不到反例**，property 测试的正向价值有限。

保留 fast-check 生成的意义是**执行守卫**：若哪天有人在 `parseLevel` 或 `checkLevel` 内部改用不同的扫描逻辑（绕过 `scanAscii`），断言会立刻失败——这是 MVP-1 白屏 bug 那类"两份实现漂移"的复发路径守法。**结构守卫的主力是 SMOKE 段的静态检查（grep），fast-check 是补充。**

*For any* 合法的 Sokoban ASCII 关卡文本 `text`，`scanAscii(text)` 提取的坐标集合与 `parseLevel(text)` 装出的 `GridState` 对应字段的坐标集合**作为集合相等**：

- `scanAscii(text).walls`（多重集）作坐标排序后 = `parseLevel(text).walls` 作坐标排序后
- `scanAscii(text).goals` 同上 = `parseLevel(text).goals`
- `scanAscii(text).boxes` 同上 = `parseLevel(text).boxes`
- `scanAscii(text).players.length === 1 && scanAscii(text).players[0] === parseLevel(text).player`

**Validates: Requirements 2.4**（主力守法在 SMOKE 静态检查，见 Testing Strategy · SMOKE 段）

### Property 2: 非法字符必现形 + 精确到行列

*For any* 由"完全合法关卡文本 baseline + 在 baseline 内某 (line, col) 位置替换为一个非合法字符 badCh"（`badCh ∉ { '#', '.', ' ', '@', '$', '*', '+' , '\n' }`）扰动生成的关卡文本，`checkLevel(text)` 满足：

- `result.ok === false`
- `result.issues` 中**必含**至少一条 `rule === "invalid-char"` 的 issue
- 该 issue 的 `location` 形如 `{ line, column }`，与扰动坐标**精确相等**（1-indexed 或 0-indexed 由实现约定统一——设计意图是能定位到原始字符位置，不允许笼统"关卡不合法"）
- 该 issue 的 `message` 中包含实际非法字符 `badCh` 的展示

**Validates: Requirements 2.2, 2.3**

### Property 3: 玩家计数错误必现形 + 全局计数

*For any* 由"完全合法关卡 baseline + 玩家标记数扰动（删除唯一 `@`/`+` 得 0 玩家 · 或复制一个位置得 2 玩家）"生成的关卡文本，`checkLevel(text)` 满足：

- `result.ok === false`
- `result.issues` 中必含至少一条 `rule === "player-count"` 的 issue
- 该 issue 的 `message` 中包含**实际找到的玩家数**（正则可匹配到"当前找到 N 个"或等价文本）
- 该 issue 允许无 `location`（这是全局计数规则，无单一坐标语义）

**Validates: Requirements 2.2, 2.3**

### Property 4: 箱目标不平衡必现形 + 全局计数

*For any* 由"完全合法关卡 baseline + 破坏箱目标数守恒的扰动（在合法地板格随机加一个 `$` 而不加对应 `.`，或反之）"生成的关卡文本（且扰动后玩家数仍恰 1、字符集仍合法、边界仍闭合——即仅违反箱目标数守恒这一条），`checkLevel(text)` 满足：

- `result.ok === false`
- `result.issues` 中必含至少一条 `rule === "box-goal-imbalance"` 的 issue
- 该 issue 的 `message` 中同时包含实际的**箱子数**与**目标数**
- 该 issue 允许无 `location`

**Validates: Requirements 2.2, 2.3**

### Property 5: 边界不闭合必现形 + hint 是合法泄漏点

*For any* 由"完全合法且边界闭合的关卡 baseline + 在外圈墙上随机戳一个洞（把外圈某个 `#` 替换为空格）"生成的关卡文本，`checkLevel(text)` 满足：

- `result.ok === false`
- `result.issues` 中必含至少一条 `rule === "boundary-not-closed"` 的 issue
- 该 issue 的 `location` 形如 `{ hint: Position }`
- `hint` 是网格内的合法坐标（`0 <= hint.x < width && 0 <= hint.y < height`）
- `hint` **不**在 `walls` 中
- `hint` **位于**网格外边界（`hint.x === 0 || hint.x === width-1 || hint.y === 0 || hint.y === height-1`）
- （AC 2.3 允许的"最相关坐标"精度：hint 必是 flood-fill 到达的一个真实边缘可达点，不允许笼统兜底）

**Validates: Requirements 2.2, 2.3**

### Property 6: 两层校验体系分层判定的等价性（普通入口 tautology · 发表关入口有实测价值）

**诚实标注 · Property 6 两半价值不同**：

- **普通入口部分是 tautology**：`checkLevel(text).ok ⟺ parseLevel(text) 不抛错` —— 因 `parseLevel` 委托 `checkLevel`（见 §6.5），两侧是同一段代码；fast-check 找不到反例。**保留 fast-check 生成作为"若哪天有人绕过就被抓"的执行守卫**（同 Property 1），并配 SMOKE 段的静态检查。
- **发表关入口部分有实测价值**：`checkLevel(text).ok && (() => { try { assertPublishableLevel(parseLevel(text)); return true; } catch { return false; } })()` —— 这条**不是 tautology**，因为 `assertPublishableLevel` 与 `checkLevel` 是**独立的两层**（gate 与 base check），fast-check 可以生成"过 base check 但不过 gate"的关卡（0=0 特例、单箱单目标、开局已通关）作为分层反例——这是 Property 6 里真正需要 fast-check 生成器覆盖的部分。

*For any* 关卡文本 `text`（生成器覆盖合法与各类违反基线）：

- **普通入口可装载判定**：`text` 能作为普通入口装载 ⟺ `checkLevel(text).ok === true`
  - 具体化为：`checkLevel(text).ok && parseLevel(text)` 不抛错
- **发表关入口可装载判定**：`text` 能作为发表关装载 ⟺ `checkLevel(text).ok && (() => { try { assertPublishableLevel(parseLevel(text)); return true; } catch { return false; } })()`
  - 生成器需**覆盖 gate 反例**：0=0 特例（无箱无目标）、单箱单目标、开局已通关的关（所有箱在目标上，即用 `*` 满足所有 `.`）——这些**应过 base check 但不过 gate**，是本 property 的真实断言力所在

**Validates: Requirements 1.3**（普通入口结构守卫 · 发表关入口 fast-check 实证）

### Property 7: URL 关卡分派器的普适行为

*For any* 输入字符串 `nameCandidate`（生成器覆盖：LEVELS 键集合、LEVELS 外的随机字符串、空字符串、包含特殊字符的字符串），设 `search = nameCandidate === "" ? "" : "?level=" + encodeURIComponent(nameCandidate)`，`resolveLevelFromUrl(search, LEVELS, DEFAULT_LEVEL)` 返回的 `{ name, rawText }` 满足：

- 若 `nameCandidate` 非空且 `LEVELS[nameCandidate]` 有值：`name === nameCandidate && rawText === LEVELS[nameCandidate]`
- 否则（未指定 level 参数 · 或指定了 LEVELS 里没有的 name）：`name === DEFAULT_LEVEL && rawText === LEVELS[DEFAULT_LEVEL]`
- 返回值恒满足 `rawText === LEVELS[name]`（分派结果自洽——不允许 name 与 rawText 指向不同关卡）

**Validates: Requirements 1.5**

## Error Handling

- **URL 指定了不存在的关卡**：`resolveLevelFromUrl` 静默回退到 `DEFAULT_LEVEL`（默认关 = `level-push-1`），仅在控制台 `console.warn`，不阻断——这是对最终用户的容错（复制粘贴过来的旧 URL、typo 都能玩到默认关，而不是白屏）。
- **默认入口不含 `level-walk-only`**：`level-walk-only.txt` 是 MVP-1 走路对照资产、不是给最终用户玩的关卡。它保留在 `LEVELS` 里可通过显式 `?level=level-walk-only` 访问，但**不进默认关、不出现在 UI 层**（本 MVP 没有关卡菜单）——这是预期行为。`PUBLISHABLE_LEVELS` 白名单也不含它，即使被显式访问也不会跑 publishability gate（0=0 特例过 base check、绕过 gate）。
- **base check 失败的 `throw` 与 MVP-2 keydown `try-catch` 不冲突**：MVP-3 装载段的 `throw new Error(...)` 是**模块图加载期抛错**（在 `main.ts` 顶层执行栈），而 MVP-2 的 `stepPush` `try-catch` 在 `keydown` 事件回调内部——两者**不在同一执行栈**、不会互相捕获。`container.textContent` 已在 `throw` 前设置，浏览器页面在模块图加载失败后保留诊断文本可读；控制台可见 `console.error` + 未捕获的 `Error` 堆栈（模块图加载失败的浏览器默认行为）。
- **base check 未通过**：`main.ts` 装载段捕获 `checkResult.ok === false`，把 `issues` 印到控制台 + 网格挂载点显示可读诊断文本 + `throw` 中断模块图（fail-fast）。**不进装配流**——引擎不会尝试运行一个已知不合法的关卡。
- **base check 通过但 `parseLevel` 抛错**：Property 6 要求这种情况不该发生（base 与 parseLevel 的通过面必须一致）。若真发生 = base check 与 parseLevel 已经漂移，是 P1 级 bug——沿用 MVP-2 现有的模块图 fail-fast 语义暴露到浏览器控制台。
- **发表关但 `assertPublishableLevel` 抛错**：MVP-2 现有语义——控制台可见 Error、页面不渲染。MVP-3 不改这条。
- **CLI `check-level` 遇到读文件失败**：读文件抛错直接冒泡，node 默认打印 stack trace，exit code 非 0——不做特殊包装（这是 node 生态的默认行为，符合最小介入）。
- **CLI 命令行缺参数**：打印用法、`exit(2)`（区别于"不合法关卡"的 `exit(1)` 与"合法"的 `exit(0)`）。
- **`scanAscii` 遇到全空文本 / 单空行**：返回 `RawScan { width: 0, height: 0, walls: [], ..., invalidChars: [] }`——不抛错。让 `checkLevel` 的 rule 2/3（玩家计数、箱目标数）自然报出 `player-count` 不合法（0 玩家）。设计意图：低层 primitive 不做业务判断、只做纯扫描，业务判断留给上层。
- **flood-fill 起点缺失**（`RawScan.players.length === 0` 或含无箱无玩家的空关）：`checkLevel` 先报 `player-count`，边界闭合检查在无起点时**跳过**（不生成 `boundary-not-closed` issue）——避免"没有起点报无起点导致的诡异边界错"这种连锁噪声。

## Testing Strategy

> 遵守 `.kiro/steering/status-sync.md`：任何"通过"断言必须有同轮真实测试输出。守 `test-and-acceptance.md` 门禁三项（typecheck 0 错 / 相关测试全绿 / 端到端入口跑一次）。

**双层测试 · 属性 + 例子 · 分工**

- **属性测试（fast-check，≥100 iterations 每条）**：守 Property 1–7。每条属性一个测试文件或测试用例，测试内加注释 `// Feature: sokoban-mvp-3-levels, Property N: <property title>` 建立与 design 的追溯（与 MVP-1 / MVP-2 一致）。
- **例子测试（vitest）**：守具体分支、边界、集成路径、CLI 行为。
- **jsdom**：URL 关卡切换的浏览器侧行为验收（复用 MVP-2 win-lockout 里的 jsdom pattern）。
- **端到端**：三关合法子集用 `stepPush` 端到端跑到 `won=true` 或到"能开始玩的第一帧"。
- **CLI 冒烟**：`scripts/check-level.mjs` 对四份关卡跑一次、断言 exit code + stderr 与函数一致。
- **真人浏览器验收**：三个 URL（`?level=level-push-1` / `?level=level-push-big` / `?level=level-walk-only`）各切一次、各玩若干步、`level-malformed-leak` 走 CLI 报错路径（不进浏览器）。截图/记录进 REPORT.md。

**属性测试实现约束**（延续 MVP-1 / MVP-2 一致）：

- 库：fast-check（`experiments/exp06-sokoban/package.json` 已装）。
- 最小迭代：≥100 每条属性；生成器复杂时不下调。
- 每条属性测试头注释指向 design 中对应 Property 编号 + 标题。
- Ajv / TypeBox schema 与 MVP-2 同一套流程复用（本 MVP 未新增引擎侧契约基础设施）。
- fast-check 反例出现 → **修实现，不改测绕过**。反例本身是验证材料。

**测试文件与属性/AC 映射**：

| 测试文件 | 类型 | 守的 Property / AC |
| :--- | :--- | :--- |
| `tests/scan-ascii.test.ts`（新） | PROPERTY | Property 1（共享 primitive 一致性：scanAscii 与 parseLevel 坐标集合等价） |
| `tests/check-level.invalid-char.test.ts`（新） | PROPERTY + EDGE_CASE | Property 2 + 边界：非法字符出现在关卡首字符 / 末字符 / 相邻多处的 issue 精度 |
| `tests/check-level.player-count.test.ts`（新） | PROPERTY + EXAMPLE | Property 3 + 具体例子：0 玩家 / 2 玩家 / 3 玩家 |
| `tests/check-level.box-goal.test.ts`（新） | PROPERTY + EXAMPLE | Property 4 + 具体例子：3 箱 2 目标 / 1 箱 2 目标 / 0=0 合法（不该报） |
| `tests/check-level.boundary.test.ts`（新） | PROPERTY + EXAMPLE | Property 5 + 具体例子：外圈缺口在四个方向各测一次 / `level-malformed-leak.txt` 反例 |
| `tests/check-level.layered.test.ts`（新） | PROPERTY + EXAMPLE | Property 6 双向等价（**含 parseLevel 遇非法字符 / 边界不闭合 / 玩家计数错 / 箱目标不平衡等严格化抛错的对应关系**——因 MVP-3 后 parseLevel 委托 checkLevel）+ 三关正例（level-push-1 / level-push-big 发表关正例；level-walk-only 普通关正例、发表关反例） |
| `tests/resolve-level.test.ts`（新） | PROPERTY + EDGE_CASE | Property 7 + 边界：空 search、`?level=`（空值）、`?level=xxx&other=y`（多参数）、URL 编码 |
| `tests/main-url-loading.test.ts`（新 · jsdom） | EXAMPLE | AC 1.5：调用 `bootstrap(container, "?level=level-push-big", mockLevels, defaultLevel, publishableLevels)` 后，DOM 初始网格应对上目标关卡的期望字符——**通过 bootstrap 装载期一次性函数注入 mock levels + 任意 urlSearch，不需要 mock `import.meta.glob`、不需要多次 import main.ts**（详见 Components §5 · 可测试性） |
| `tests/check-level-cli.test.ts`（新） | EXAMPLE | AC 2.4 B：CLI 对四份关卡的 exit code + stderr 与 `checkLevel(readFileSync)` 结果等价 |
| `tests/assemble-push.test.ts`（改）| EXAMPLE | AC 1.2：新增 `level-push-big` 通关方向序列端到端 → won=true（level-push-1 通关序列 MVP-2 已有） |
| MVP-2 已有测试 | 回归 | 全部零改动继续绿——`parseLevel` 内部重构（调 `scanAscii`）的语义等价性守卫（AC 1.4 架构不变量的守法之一） |

**属性生成器的组织**（避免每份测试文件重造轮子）：

- 新增 `tests/generators.ts`（内部测试工具，非产品代码）：暴露 `arbLegalLevel(): Arbitrary<{ text: string, meta: { width, height, playerPos, boxes, goals, walls } }>`——生成"完全合法且边界闭合"的关卡文本作为 Property 2–5 的 baseline。
- 每条属性的"定向扰动"在测试文件内就地拼装：`arbLegalLevel.map(baseline => applyPerturbation(baseline))`。
- 生成器复用降低维护成本，也让"合法关的定义"只有一处真相（SSOT · 铁律 2 在测试层的落实）。

**SMOKE / 代码评审项**（不写自动化测试的项目，靠人工 + git diff）：

- **AC 1.3 后半**（"仅数据层变化即可添加或切换关卡"）：代码评审 `levels-manifest.ts` 使用 `import.meta.glob` 而非硬编码；grep 确认没有其它地方枚举关卡名。
- **AC 1.4**（"关卡增/删/改，引擎/装配块/转接件不变"）：git diff 检查——本 MVP 完成时，`engine/**` 应 0 改动；`src/blocks/**` / `src/adapters/**` / `src/configs/**` / `src/render.ts` / `src/driver.ts` / `index.html` 应 0 改动或仅有说明性注释；`src/grid.ts` 允许内部重构（抽出 `scanAscii`）但对外契约不变，由 MVP-2 单测零改动继续绿守；`src/main.ts` 仅装载段改（不新增 `@paradigm`）。
- **AC 5.3 / 范式标记**（MVP-3 隐式沿用 MVP-2 结论）：`grep "@paradigm" experiments/exp06-sokoban/src/` 预期**继续恰有 1 处代码标记且在 `src/main.ts`**——业务/装配层（`src/blocks/**` / `src/configs/**` / `src/adapters/**` / `src/grid.ts` / `src/scan-ascii.ts` / `src/check.ts` / `src/driver.ts` / `src/levels-manifest.ts`）**零命中**；渲染与脚手架（`src/render.ts` / `index.html` / `vite.config.ts`）零命中；`src/main.ts` 里 MVP-2 已有的那一处标记语义不变（仍只覆盖门控 / 终局拦截 / R 重开三条控制流，不扩大到"URL 装载"——URL 装载是纯装载期数据选择，见 §7 与 AFP 纪律小节）。
- **Property 1 / 6 结构守卫的补充静态检查**（tautology 补足 · 主力守法）：因 Property 1 / 6 普通入口部分在当前设计下是重言式（parseLevel 委托 checkLevel），fast-check 无实证反例价值——SMOKE 补两条静态检查作为**主力守法**：
  1. `grep -n "checkLevel(" src/grid.ts` **应命中** `parseLevel` 函数体内部——确认 `parseLevel` 走的是委托路径、没绕开 `checkLevel` 自己重写校验
  2. `grep -n "scanAscii(" src/grid.ts` **不应命中**（`parseLevel` 应从 `result.scan` 取扫描结果、不直接调 scanAscii；scanAscii 仅由 check.ts 调用）
  若两条 grep 结果不符预期 → **P1 级设计违反**，回退代码；这是能真正抓到"有人绕过 SSOT"的静态防线，比 fast-check tautology 更管用。

**门禁三项**（`test-and-acceptance.md`）在 tasks 阶段体现：

1. `npm run typecheck` 0 错。
2. `npm test` 全绿（含新增 9 份测试文件 + MVP-2 全部回归）。
3. **端到端入口跑一次** = 真人浏览器验收三个 URL + CLI 对四份关卡跑一次 + 截图/记录进 REPORT。

**发表前 checklist 状态**（roadmap D-014，只引用不复制）：MVP-3 是"MVP-2 之后的稳定重复 + 独立静态校验工具"，**本 MVP 不重跑 D-014 全表**——D-014 的门面 / 文章 / 首发平台条目在 MVP-2 收尾时的状态由 MVP-2 REPORT 记录，本 MVP 追加的只是"3 关关卡集 + base check 工具"这两条工程条目。tasks 阶段落地时 REPORT.md 追加"MVP-3 段"、逐项打钩 MVP-3 相关条目、其余条目引用 MVP-2 REPORT 的既有状态。

## AFP 纪律与范式标记（本 MVP 隐式承诺）

MVP-3 不引入新的非 AFP 范式，也不扩大 MVP-2 已有 `@paradigm NON-AFP: external-control-flow` 的语义边界。以下检查是本 MVP 的**隐式承诺**（不作为独立 tasks 条目、由 SMOKE 段的 grep 守）：

- `src/scan-ascii.ts` · **纯 AFP 机制**：纯函数（同 text 同结果）、无时钟 / 随机 / AI / 全局状态；零 `@paradigm` 标记。
- `src/check.ts` · **纯 AFP 机制**：纯函数、无时钟 / 随机 / AI / 全局状态；零 `@paradigm` 标记。
- `src/levels-manifest.ts` · **纯数据 · AFP 承诺范围内**：`import.meta.glob` 是打包期静态搜集，运行期是不可变的 `Record<string, string>` 常量——与"配置图静态可枚举"红线兼容；零 `@paradigm`。
- `src/main.ts` 装载段新增的 `resolveLevelFromUrl` · **纯函数**：签名 `(search, levels, defaultLevel) => { name, rawText }`，无副作用、无跨回合状态——因此**不新增** `@paradigm`；`main.ts` 头部现有的 `@paradigm NON-AFP: external-control-flow` 语义**不变**、只覆盖回合门控 / 终局拦截 / R 重开三条控制流，与 URL 装载 / base check 装载段无关。
- 引擎（`engine/**`）· **0 改动**——本 MVP 不动引擎，Q-024 / Q-025 未触及。

### 落地文件清单（tasks 阶段照此产出）

```
experiments/exp06-sokoban/
├── package.json                 # 加 script: "check-level": "tsx scripts/check-level.mjs"
├── vite.config.ts               # 不改
├── index.html                   # 不改（除非 tasks 阶段决定给"关卡切换"加一行 URL 使用说明）
├── src/
│   ├── grid.ts                  # 内部重构：parseLevel 委托 checkLevel（不再自扫描 / 自校验）；assertPublishableLevel 对外契约不变
│   ├── scan-ascii.ts            # 新增 · 独立文件 · scanAscii 共享 primitive · 避免 grid.ts ↔ check.ts 循环依赖
│   ├── check.ts                 # 新增 · base 静态 check · checkLevel + LevelCheckResult + CheckIssue + CheckRule + flood-fill
│   ├── levels-manifest.ts       # 新增 · import.meta.glob 静态搜集 + DEFAULT_LEVEL + PUBLISHABLE_LEVELS
│   ├── main.ts                  # 装载段微改：resolveLevelFromUrl + base check + 白名单查询；@paradigm 保持不变
│   ├── driver.ts                # 不改
│   ├── render.ts                # 不改
│   ├── jsonc.ts                 # 不改
│   ├── vite-env.d.ts            # 不改
│   ├── blocks/**                # 不改
│   ├── configs/**               # 不改
│   ├── adapters/**              # 不改
│   └── levels/                        # 目录结构承担发表关分类
│       ├── publishable/                # 发表关：扫进 LEVELS + PUBLISHABLE_LEVELS
│       │   ├── level-push-1.txt        # 迁入 publishable/（MVP-2 · 小 · 6×6）
│       │   └── level-push-big.txt      # 新增 · 大 · ≥10×10
│       ├── practice/                   # 普通关：扫进 LEVELS，不进 PUBLISHABLE_LEVELS
│       │   └── level-walk-only.txt     # 迁入 practice/（MVP-2 · 0=0 · 走路对照）
│       └── malformed/                  # 畸形关：不扫进 LEVELS，只走 CLI 报错
│           └── level-malformed-leak.txt # 新增 · 边界不闭合负例
├── scripts/
│   └── check-level.mjs          # 新增 · 薄壳 CLI · import checkLevel · 读文件 → 打印 → exit code
├── tests/
│   ├── scan-ascii.test.ts                 # 新 · Property 1
│   ├── check-level.invalid-char.test.ts   # 新 · Property 2
│   ├── check-level.player-count.test.ts   # 新 · Property 3
│   ├── check-level.box-goal.test.ts       # 新 · Property 4
│   ├── check-level.boundary.test.ts       # 新 · Property 5
│   ├── check-level.layered.test.ts        # 新 · Property 6 + 三关分类正/反例
│   ├── resolve-level.test.ts              # 新 · Property 7
│   ├── main-url-loading.test.ts           # 新 · jsdom · AC 1.5
│   ├── check-level-cli.test.ts            # 新 · AC 2.4 B EXAMPLE
│   ├── generators.ts                       # 新 · arbLegalLevel 共享生成器（测试内部工具）
│   ├── assemble-push.test.ts               # 改 · 加 level-push-big 通关序列
│   └── （MVP-2 已有测试 12 份）             # 回归零改动继续绿
└── REPORT.md                    # 追加"MVP-3 段"（tasks 阶段落地）
```

## Requirements 覆盖映射

| 需求 AC | 设计落点 | 守法 |
| :--- | :--- | :--- |
| R1.1 ASCII 字符集能直接加载 | `parseLevel`（MVP-2 已有，不改）+ `main.ts` 装载段（微改） | SMOKE：三关合法子集端到端装载可玩 |
| R1.2 3 关关卡集（大 / 小 / 畸形）+ 合法 2 关可通关 + 畸形关被 base 拦下 | `src/levels/level-push-1.txt`（小）/ `level-push-big.txt`（大 · 新增）/ `level-malformed-leak.txt`（畸形 · 新增） | EXAMPLE：`assemble-push` 加 big 通关序列；`check-level.boundary` 加 leak 反例 |
| R1.3 分层判定：普通只需 base；发表关 = base + gate；**仅数据层变化即可加/切关** | 前半：`checkLevel` + `PUBLISHABLE_LEVELS`（**从 `src/levels/publishable/` 目录派生**，非代码硬编码）；后半：`levels-manifest.ts` 用两次 `import.meta.glob` 分扫子目录——**加发表关 = 扔 txt 到 publishable/ 目录、不改代码**（兑现 R1.3 强承诺） | Property 6（分层等价）+ SMOKE（评审 manifest 目录派生 + grep 确认 `PUBLISHABLE_LEVELS` 里无硬编码字符串数组） |
| R1.4 关卡增/删/改，引擎 / 装配块 / 转接件不变 | 数据层组织 = `src/levels/`；代码层不动 `engine/**` / `src/blocks/**` / `src/adapters/**` / `src/configs/**` | SMOKE：git diff + MVP-2 单测零改动回归绿 |
| R1.5 浏览器 demo 能切换游玩全部合法关；最简可行形式；不做菜单页 / 关卡预览 / 美术资产 | URL 查询参数 `?level=<name>` + `resolveLevelFromUrl` + `import.meta.glob` 静态清单 | Property 7 + jsdom EXAMPLE + 真人验收三关 |
| R2.1 独立 base 静态校验工具 · 不装载不启动浏览器 · 判定合法性 | `src/check.ts` · `checkLevel(text): LevelCheckResult` + 薄壳 CLI `scripts/check-level.mjs` | EXAMPLE：从 node import 直调 + CLI 冒烟 |
| R2.2 base check 检查四条规则（恰一玩家 / 箱数=目标数含 0=0 / 边界闭合 / 字符集合法） | `checkLevel` 内四条规则；边界闭合用 flood-fill | Property 2 / 3 / 4 / 5 各覆盖一条 |
| R2.3 校验失败给足以定位的错误信息 · 最好精确到行列 · 无法精确则最相关坐标 | `CheckIssue.location` 分级：invalid-char → { line, column }；boundary-not-closed → { hint: Position }；player-count / box-goal → 全局计数 message | Property 2–5 的 location 精度断言 |
| R2.4 校验结果解耦但允许底层共享 parseLevel · 修改 parseLevel 只应改一处 | 抽出 `scanAscii` 独立文件（新 · `src/scan-ascii.ts`）；`checkLevel` 从 `scanAscii` 派生 issues；`parseLevel` 委托 `checkLevel`——**校验逻辑仅在 `check.ts` 一处**，装载层 `parseLevel` 不重复实现 | Property 1（scan 一致性）+ Property 6（结构性等价 · parseLevel 委托 checkLevel）+ AC 2.4 B EXAMPLE（CLI vs 函数等价） |
| 交付物 · 保留 MVP-2 publishability gate 不变 | `assertPublishableLevel` 一字不改；仍仅对 `PUBLISHABLE_LEVELS` 白名单调用 | Property 6 + 三关分类正/反例 |

## 设计阶段未决、留给 Tasks/实现的问题

- **`level-push-big.txt` 具体地图布局**：本设计给出草图（10×12、4 箱 4 目标），tasks 阶段手工微调平衡 + 用 `assemble-push` 端到端跑一遍通关序列作解性证明；不做 PCG 求解器。
- **`invalid-char` 的 line / column 是 1-indexed 还是 0-indexed**：实现前定一致，写进测试断言。建议 1-indexed（对齐编辑器习惯 / 用户阅读体验）；`{ hint: Position }` 里的 `Position.x/y` 沿用 `GridState` 的 0-indexed（`x = 0 向右、y = 0 向下、原点左上`）——两套坐标系服务不同受众（行列给用户读、Position 给代码用），文档层注明差异即可，不强行统一。
- **`checkLevel` 是否短路（首个 issue 就返回）还是全跑**：本设计已选**全跑**（Components §2 契约）——一次跑完把该说的话说完，用户不需要多轮"改一处再跑一次"。tasks 阶段落地时如实现 performance 有问题再评估短路，但生成器 + 测试断言都按"全跑"写。
- **`scripts/check-level.mjs` 用 `.mjs` 还是 `.ts`（tsx）**：本设计写作 `.mjs` 是脚本习惯（node 直跑）；实现层可用 `tsx scripts/check-level.mjs` 或 `tsx scripts/check-level.ts`，取决于 tsx 版本对 mjs import 路径映射的支持。tasks 阶段实测决定。
- **REPORT.md MVP-3 段的截图 / 动图规模**：MVP-3 是 MVP-2 之后的稳定重复，不重跑 D-014 的完整流程；REPORT 追加段主要记录"3 关集资产 + base check 工具的实测 + 切关 URL 的可玩佐证"三样，D-014 大表引用 MVP-2 REPORT 的既有状态。

