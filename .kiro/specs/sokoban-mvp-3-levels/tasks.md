# Implementation Plan

> Spec: sokoban-mvp-3-levels · Tasks
> 需求见 `requirements.md`，设计见 `design.md`。落地目录 `experiments/exp06-sokoban/`（MVP-3 增量：3 关关卡集 + base 静态 check 独立工具 + URL 关卡切换 + `parseLevel` 内部重构委托 `checkLevel`）。

## Overview

把 MVP-3 设计落地为"加关卡 = 加数据 + 装载前可独立校验"的可发表增量：

关卡目录结构（publishable / practice / malformed 三层）+ git mv 迁移 MVP-2 两份关卡 + 新建大关 / 畸形关 → `src/scan-ascii.ts`（共享 primitive · 独立文件避 `grid.ts ↔ check.ts` 环）→ `src/check.ts`（`checkLevel` + 4 条规则 + flood-fill）+ `tests/generators.ts`（`arbLegalLevel` 共享生成器）→ 4 条规则的属性测试（Property 2/3/4/5）→ `src/grid.ts` 内部重构 `parseLevel` 委托 `checkLevel`（对合法输入行为不变、MVP-2 测试零改动继续绿）→ `check-level.layered.test.ts`（Property 1 一致性 + Property 6 分层等价 + 三关分类正/反例）→ `src/levels-manifest.ts`（`import.meta.glob` 打包期静态清单 + `PUBLISHABLE_LEVELS` 从目录派生）→ `resolveLevelFromUrl` 纯函数 + Property 7 → `bootstrap` 装载期一次性函数 + `main.ts` 顶层调用 + jsdom EXAMPLE → `scripts/check-level.mjs` 薄壳 CLI + package.json 加脚本 + CLI 冒烟 EXAMPLE → `level-push-big.txt` 布局微调 + `assemble-push` 加通关序列 EXAMPLE → 门禁一二（typecheck / vitest run 全绿）→ SMOKE（`@paradigm` grep + Property 1/6 tautology 结构守卫静态检查）→ 门禁三（真人浏览器三关 URL 验收 + CLI 对四份关卡跑一次）→ REPORT.md 追加 MVP-3 段 → SSOT 同步 + git status 快照。

纪律（贯穿全表，不许省）：

- **status-sync 铁律 1（verify-first）**：每个"完成 / 通过 / 已实现"勾选前必须有同轮真实工具输出撑着——typecheck / vitest run / grep / 浏览器实跑截图 / git status。凭记忆勾选 = 捏造。
- **test-and-acceptance 三项门禁**：typecheck 0 错 + 相关测试全绿 + 端到端入口跑一次；本 MVP 的端到端入口 = 真人浏览器验收（Task 14）+ CLI 冒烟四份关卡（Task 14 一并跑）。
- **PBT 追溯**：每个属性测试文件头加 `// Feature: sokoban-mvp-3-levels, Property N: <title>` 注释，与 design "Correctness Properties" 章节一一对应。fast-check ≥100 iterations；反例出现 → 修实现，不改测绕过。
- **SSOT 铁律 2 · 校验逻辑仅一处**：所有校验规则集中在 `src/check.ts` 一处；`parseLevel` 委托 `checkLevel`、不重复实现（Task 5 落）；CLI 只做"读文件 → 调函数 → 打印 → exit code"、不重复实现（Task 10 落）。Task 13 SMOKE 静态检查会守这条。
- **`@paradigm` 只允许 1 处**：业务/装配层（`src/blocks/**` `src/configs/**` `src/adapters/**` `src/grid.ts` `src/scan-ascii.ts` `src/check.ts` `src/driver.ts` `src/levels-manifest.ts`）**零标记**；渲染 / 脚手架 / 引擎 **零标记**；`src/main.ts` 沿用 MVP-2 已有恰 1 处（不扩到 URL 装载 / base check 装载段）。Task 13 grep 强制守。
- **R1.4 架构不变量守法**：MVP-3 收尾时 `engine/**` 应 0 改动；`src/blocks/**` / `src/adapters/**` / `src/configs/**` / `src/render.ts` / `src/driver.ts` / `src/jsonc.ts` / `index.html` 应 0 改动；`src/grid.ts` 允许内部重构（Task 5）但对外契约在合法输入下不变，由 MVP-2 现有单测零改动继续绿守（Task 12 门禁一二）。
- **失败结论与成立结论同等有价值**：fast-check 反例 → 修实现；引擎缺口 / 未预见的非 AFP 范式 → 如实登记 `docs/open-questions.md` 与 REPORT；不为 MVP-3 收尾强行圆满。

## Tasks

- [x] 1. 关卡目录结构 + git mv 迁移 + 新关卡资产骨架 + 路径引用更新
  - 建立三个子目录：`experiments/exp06-sokoban/src/levels/publishable/` / `practice/` / `malformed/`
  - **git mv 迁移**（作为独立动作、保留 git 历史；不是复制粘贴新建）：
    - `git mv experiments/exp06-sokoban/src/levels/level-push-1.txt experiments/exp06-sokoban/src/levels/publishable/level-push-1.txt`
    - `git mv experiments/exp06-sokoban/src/levels/level-walk-only.txt experiments/exp06-sokoban/src/levels/practice/level-walk-only.txt`
  - **新建关卡资产**（初稿；Task 11 会验证 push-big 可解性并微调）：
    - `src/levels/publishable/level-push-big.txt`：≥10×10、外圈墙闭合、恰 1 玩家、**4 箱 = 4 目标**、开局非通关；参考 design §6 "大关卡草图"起手（草图故意 3 箱 4 目标不平衡，本任务补第 4 箱到能推到某个 goal 的合法位置作为初稿）
    - `src/levels/malformed/level-malformed-leak.txt`：**外圈墙有缺口的畸形关**（照 design §6 "畸形关 ASCII 示例" 起手，或等价 4-连通可 flood-fill 到网格边缘的构造）；Task 4 的 boundary 属性测试与 Task 14 CLI 冒烟都会依赖它
  - **更新 MVP-2 遗留的路径引用**（临时过渡；Task 9 后 `main.ts` 会改从 `LEVELS` 清单装载，本任务只做"最小改动让代码仍能编译 + 测试仍能跑"）——**用内容匹配定位、不用行号**（行号会随其它人加 import / 注释而漂移）：
    - **`src/main.ts`**：先 `grep -n "level-push-1.txt" src/main.ts` 定位、把匹配行的 `"./levels/level-push-1.txt?raw"` 改为 `"./levels/publishable/level-push-1.txt?raw"`
    - **`tests/parse-level.test.ts`**：先 `grep -n "level-push-1.txt" tests/parse-level.test.ts` 定位、把匹配行的 `"../src/levels/level-push-1.txt?raw"` 改为 `"../src/levels/publishable/level-push-1.txt?raw"`
    - **`src/vite-env.d.ts`**：先 `grep -n "level-1.txt\\|level-push" src/vite-env.d.ts` 定位；若头注释里仍有 `level-1.txt` 陈旧引用则顺手改为 `level-push-1.txt`（纯注释、非硬性；命中即改、没命中就跳过）
  - **验收动作**（当轮真实输出，铁律 1）：
    - `git status` 显示 rename 记录（不是 delete + add）
    - `npm run typecheck` 得 0 错
    - `npm test` 得 MVP-2 全部 12 份测试仍绿（`parse-level` / `assemble-walk` / `assemble-push` / `move-with-push` / `win-check` / `determinism` / `invariants` / `render` / `win-lockout` / `move-step` / `input-adapter` / `jsonc`）——数据层迁移不改语义
  - _Requirements: R1.2（3 关关卡集雏形）, R1.4（关卡增/删/改不改代码——本任务是"数据层迁移 + 最小 import 路径调整"，代码逻辑零改动）_
  - _Design: §6 关卡资产（数据）· 增删；Architecture "关卡数据（打包期 · 目录结构承担发表关分类）"_

- [x] 2. `src/scan-ascii.ts` 新增（共享 primitive · 独立文件）+ `tests/scan-ascii.test.ts`
  - 新建独立文件 `src/scan-ascii.ts`——**不放 grid.ts**（三条理由已在 design §1 说清：职责单一 / check.ts 独立于装载层 / 测试可独立跑；避免 `grid.ts ↔ check.ts` 循环依赖）
  - 导出 `RawScan` interface（`width` / `height` / `walls` / `goals` / `boxes` / `players` / `invalidChars`；后者是 `{ pos: Position; ch: string }[]`；全部 `readonly`）
  - 导出 `scanAscii(text: string): RawScan` 纯函数——纯扫描、不做完整性判断（那是 `checkLevel` 的活）
  - **契约照 design §1 落实**（每条都在实现里显式支持，测试断言）：
    - 合法字符集 = `# . <space> @ $ * +` + 换行；`\r` 兼容（开头 `text.replace(/\r/g, "")`）
    - `*` 同时进 `boxes` 与 `goals`；`+` 同时进 `players` 与 `goals`
    - Ragged line 语义：短行末尾缺失的列位置**不进任何集合**——上层视为"网格内非墙空地"（与 MVP-2 parseLevel 既有行为一致）
    - 中间空行语义：视为"满宽度的一整行可通行非墙空地"
    - 全空文本 / 单空行：返回 `RawScan { width: 0, height: 0, walls: [], ..., invalidChars: [] }`——不抛错
    - `invalidChars` 是**权威记录**：合法字符集外的字符逐个记录 `{ pos, ch }`
  - 纯函数纪律：同 `text` 同结果、不读时钟 / 不随机 / 不调 AI / 无全局状态；**零 `@paradigm` 标记**
  - `tests/scan-ascii.test.ts` 新增：
    - PROPERTY: **Property 1 共享 primitive 一致性**——fast-check ≥100 iterations 生成合法 Sokoban ASCII（恰一 `@`/`+`、箱数 = 目标数含 0=0 特例、字符在合法集内），断言 `scanAscii(text)` 与 `parseLevel(text)`（MVP-2 已有）**对合法文本的坐标集合恒等**——`walls` / `goals` / `boxes` 作坐标排序后逐一相等；`players.length === 1 && players[0] === parseLevel(text).player`
      - **诚实标注**（design §Correctness Properties Property 1 已说明）：Task 5 完成后本 property 变成结构性重言式（`parseLevel` 内部直接从 `checkLevel(text).scan` 取扫描结果、走同一段代码），fast-check 无实证反例价值——保留 fast-check 生成作为"若哪天有人绕过就被抓"的执行守卫（主力守法在 Task 13 SMOKE 段的静态 grep）
      - 头注释：`// Feature: sokoban-mvp-3-levels, Property 1: 共享 primitive 一致性（结构守卫）`
    - EXAMPLE / EDGE_CASE：ragged line、中间空行、全空文本、单空行、`*` 与 `+` 同时出现、`\r\n` 换行、`invalidChars` 记录含 `pos` + `ch`
  - **验收动作**：`npm run typecheck` + `npm test -- scan-ascii` 得真实输出、全绿；MVP-2 现有测试仍绿
  - _Requirements: R2.4（校验结果解耦 · 允许底层共享 parseLevel · 修改扫描逻辑只应改一处）_
  - _Design: §1 `src/scan-ascii.ts` · scanAscii；Property 1_

- [x] 3. `src/check.ts` 新增（base 静态 check）+ `tests/generators.ts` 共享生成器
  - 新建 `src/check.ts`：导出 `CheckRule` union type（`"invalid-char" | "player-count" | "box-goal-imbalance" | "boundary-not-closed"`）+ `CheckIssue` interface（`rule` + `message` + 可选 `location`）+ `LevelCheckResult` union type（`{ ok: true; scan: RawScan } | { ok: false; issues: CheckIssue[] }`——**成功时携带 scan 供 parseLevel 直接复用**，避免冗余扫描）
  - 导出 `checkLevel(text: string): LevelCheckResult` 纯函数：
    - 内部调 `scanAscii(text)` 一次；**全跑不短路**（一次跑完把该说的话说完，收集所有 issues）
    - 4 条规则各自实现，参见 design §2 的错误信息模板：
      1. `invalid-char`：`scan.invalidChars` 逐条产 issue，`location: { line, column }` **精确到行列**；`message` 含实际非法字符
      2. `player-count`：`scan.players.length !== 1` 时产 issue（0 / 2+ 都命中）；`message` 含实际计数；无 location
      3. `box-goal-imbalance`：`scan.boxes.length !== scan.goals.length` 时产 issue；**允许 0=0 合法特例**（当 boxes.length === goals.length === 0，不产 issue）；`message` 同时含实际箱数 / 目标数；无 location
      4. `boundary-not-closed`：flood-fill 算法照 design §2 "边界闭合算法" 实现——起点 = 所有 `players + boxes`；4-连通穿"非墙格"；若到达网格外边界（`x === 0 || x === width-1 || y === 0 || y === height-1`）且不在 walls 中 → 产 issue，`location: { hint: Position }` = 第一个到达的边缘可达点
    - **flood-fill 起点缺失守法**：若 `scan.players.length === 0`（rule 2 已报），边界闭合检查**跳过**（不产 boundary-not-closed issue）——避免"无起点报诡异边界错"的连锁噪声
    - 行列坐标约定：`invalid-char.location.line/column` **1-indexed**（对齐编辑器习惯 / 用户阅读体验）；`boundary-not-closed.location.hint` 的 `Position.x/y` 沿用 `GridState` 的 **0-indexed**（`x = 0 向右 / y = 0 向下 / 原点左上`）——两套坐标系服务不同受众，注释里说明差异
  - 纯函数纪律：无状态、无副作用、无时钟 / 随机 / AI；**零 `@paradigm` 标记**
  - 新建 `tests/generators.ts`（**测试内部工具、非产品代码**、不进 `src/`）：
    - 导出 `arbLegalLevel(): fc.Arbitrary<{ text: string; meta: { width: number; height: number; playerPos: Position; boxes: Position[]; goals: Position[]; walls: Position[] } }>`
    - 生成"完全合法且边界闭合"的 Sokoban ASCII 关卡文本作为 Property 2–5 的 baseline
    - 生成约束：恰一玩家、箱数 = 目标数（允许 0=0）、字符仅在合法集内、外圈墙形成 flood-fill 意义上的闭合区域
    - 每份关卡至少 3×3、上限可配置（默认 8×8，避免生成过慢）
    - **SSOT · 铁律 2 在测试层的落实**：所有 Property 2-5 都从 `arbLegalLevel` map 派生扰动，"合法关的定义"只有一处真相
  - **验收动作**：`npm run typecheck` + `npm test -- generators` 或对生成器写一个 sanity check（生成 20 份 baseline 都应过 `checkLevel`）；`npm test -- check` 得 checkLevel 自身单元测试通过（生成器已在，property 测试可跟进）
  - _Requirements: R2.1（独立 base 静态校验 · 不装载不启浏览器）, R2.2（4 条规则）, R2.3（错误信息精度分级）_
  - _Design: §2 `src/check.ts` · checkLevel；Data Models · CheckRule / CheckIssue / LevelCheckResult；Testing Strategy · 属性生成器的组织_

- [x] 4. `checkLevel` 四条规则的属性测试（Property 2/3/4/5，各一份测试文件）
  - **文件 1 · `tests/check-level.invalid-char.test.ts`** —— **Property 2 非法字符必现形 + 精确到行列**
    - fast-check ≥100 iterations：`arbLegalLevel.map(baseline => 在 baseline 内某 (line, col) 位置替换为一个非合法字符 badCh)`（`badCh ∉ 合法字符集 ∪ { "\n" }`）
    - 断言：`checkLevel(text).ok === false`；`issues` 中必含至少一条 `rule === "invalid-char"`；该 issue 的 `location: { line, column }` **与扰动坐标精确相等**（1-indexed）；`message` 中包含实际 `badCh` 展示
    - EDGE_CASE：非法字符出现在关卡首字符 / 末字符 / 相邻多处（多个 invalidChars 都各产 issue，验证"全跑不短路"）
    - 头注释：`// Feature: sokoban-mvp-3-levels, Property 2: 非法字符必现形 + 精确到行列`
  - **文件 2 · `tests/check-level.player-count.test.ts`** —— **Property 3 玩家计数错误必现形 + 全局计数**
    - fast-check：`arbLegalLevel.map(baseline => 玩家标记数扰动)`——两种扰动：删除唯一 `@`/`+` 得 0 玩家 · 或复制一个位置得 2 玩家（可扩到 3 玩家 EXAMPLE）
    - 断言：`checkLevel(text).ok === false`；`issues` 中必含至少一条 `rule === "player-count"`；该 issue 的 `message` 中包含实际找到的玩家数（正则可匹配到"当前找到 N 个"或等价文本）；无 `location`（全局计数规则）
    - EXAMPLE：0 玩家、2 玩家、3 玩家 各手写一份具体关卡验证
    - 头注释：`// Feature: sokoban-mvp-3-levels, Property 3: 玩家计数错误必现形 + 全局计数`
  - **文件 3 · `tests/check-level.box-goal.test.ts`** —— **Property 4 箱目标不平衡必现形 + 全局计数**
    - fast-check：`arbLegalLevel.map(baseline => 在合法地板格随机加一个 $ 而不加对应 . · 或反之)`；生成器需保证扰动**只违反箱目标数守恒**这一条（玩家数仍恰 1、字符集仍合法、边界仍闭合）
    - 断言：`checkLevel(text).ok === false`；`issues` 中必含至少一条 `rule === "box-goal-imbalance"`；`message` 中**同时包含**实际箱数与实际目标数；无 `location`
    - EXAMPLE：3 箱 2 目标、1 箱 2 目标、0=0 合法（不该报，验证特例）、`*` 同时增箱增目标不破坏守恒
    - 头注释：`// Feature: sokoban-mvp-3-levels, Property 4: 箱目标不平衡必现形 + 全局计数`
  - **文件 4 · `tests/check-level.boundary.test.ts`** —— **Property 5 边界不闭合必现形 + hint 是合法泄漏点**
    - fast-check：`arbLegalLevel.map(baseline => 在外圈墙上随机戳一个洞（把外圈某个 # 替换为空格）)`
    - 断言：`checkLevel(text).ok === false`；`issues` 中必含至少一条 `rule === "boundary-not-closed"`；`location: { hint: Position }` 满足：`hint` 是网格内合法坐标（`0 <= hint.x < width && 0 <= hint.y < height`）；`hint` **不**在 walls 中；`hint` **位于**网格外边界（`hint.x === 0 || hint.x === width-1 || hint.y === 0 || hint.y === height-1`）——即"必是 flood-fill 到达的一个真实边缘可达点，不允许笼统兜底"
    - EXAMPLE：外圈缺口在四个方向（上 / 下 / 左 / 右）各测一次；`src/levels/malformed/level-malformed-leak.txt`（Task 1 已建）读入 → `checkLevel` 返回 `boundary-not-closed` issue、hint 为该关卡真实泄漏点
    - 头注释：`// Feature: sokoban-mvp-3-levels, Property 5: 边界不闭合必现形 + hint 是合法泄漏点`
  - **验收动作**：`npm test -- check-level.invalid-char check-level.player-count check-level.box-goal check-level.boundary` 得真实通过输出；四份 fast-check 各自 ≥100 iterations、反例出现 → 修 `checkLevel` 实现（不改测绕过）
  - _Requirements: R2.2（4 条规则各自能查出）, R2.3（诊断信息精度）_
  - _Design: §2 `checkLevel` · 4 条规则实现；Property 2 / 3 / 4 / 5；Testing Strategy 测试文件与属性 / AC 映射_

- [x] 5. `src/grid.ts` 内部重构 · `parseLevel` 委托 `checkLevel`（对合法输入契约不变）
  - **本任务只改 `parseLevel` 内部实现**——外部签名 `(text: string) => GridState` 不变；`GridState` interface 不变；`assertPublishableLevel` 一字不改
  - 重构照 design §6.5 落实：
    ```ts
    import { checkLevel } from "./check.js";
    export function parseLevel(text: string): GridState {
      const result = checkLevel(text);
      if (!result.ok) {
        const primary = result.issues[0];
        throw new Error(`parseLevel: ${primary.rule} — ${primary.message}`);
      }
      const { scan } = result;
      return {
        width: scan.width, height: scan.height,
        walls: scan.walls, goals: scan.goals,
        player: scan.players[0], boxes: scan.boxes,
      };
    }
    ```
  - **依赖方向确认**：`grid.ts → check.ts → scan-ascii.ts` 单向链、无环；`grid.ts` **不直接 import** `scan-ascii.ts`（Task 13 SMOKE 段的 grep 会守：`grep -n "scanAscii(" src/grid.ts` 应不命中）
  - **无冗余扫描**：`parseLevel` 从 `result.scan` 取扫描结果、**不再自己调 `scanAscii`**（design §Overview §5 显式承诺）
  - **新增严格性对畸形输入生效**（MVP-2 关卡文本不受影响、MVP-3 新增测试须覆盖）：
    - 含非法字符 → `parseLevel` 抛 Error（`primary.rule === "invalid-char"`）
    - 玩家计数错 → 抛 Error（`primary.rule === "player-count"`；原 MVP-2 语义"缺 / 多角色抛 Error"改由 checkLevel 承担、消息更规整）
    - 箱目标不平衡 → 抛 Error（`primary.rule === "box-goal-imbalance"`）
    - 边界不闭合 → **新增**抛 Error（`primary.rule === "boundary-not-closed"`）——MVP-2 parseLevel 对这条是宽松的，MVP-3 严格化
  - **MVP-2 兼容性守法**：所有 MVP-2 关卡文本（`level-push-1.txt` / `level-walk-only.txt`）都是合法字符集 + 合法结构 + 边界闭合——本任务完成后 MVP-2 所有单测应零改动继续绿（`checkLevel(text).ok ⟺ parseLevel(text) 不抛错`）
  - **验收动作**（当轮真实输出，铁律 1 · 本任务是"内部重构不改语义"的高风险动作，必须实测守）：
    - `npm run typecheck` 得 0 错
    - `npm test` 全跑一次得**全部**已有测试仍绿——特别验证：
      - `tests/parse-level.test.ts`（含 Property 1 装载正确 + Property 9 publication-gate EXAMPLE）零改动继续绿
      - `tests/assemble-walk.test.ts` / `tests/assemble-push.test.ts` / `tests/determinism.test.ts` / `tests/invariants.test.ts` / `tests/win-lockout.test.ts` 等所有依赖 `parseLevel` 的测试零改动继续绿
      - Task 2 的 `scan-ascii.test.ts` Property 1（scanAscii ↔ parseLevel 坐标一致性）在本任务后从"独立断言"变成"结构性重言式"、依然绿
      - Task 4 的四条规则属性测试（Property 2-5）通过 `checkLevel` 直接验证、不受影响
    - 任一 MVP-2 测试红 → **修实现**（回归本任务重构方式）、不改测绕过；测试红本身即证明重构破坏了语义
  - _Requirements: R2.4（校验结果解耦但允许底层共享 · 修改 parseLevel 只应改一处）_
  - _Design: §6.5 MVP-2 parseLevel 内部重构；SSOT · 铁律 2 · 校验逻辑仅一处_

- [x] 6. `tests/check-level.layered.test.ts` 新（Property 6 分层等价 + 三关分类正/反例）
  - **文件头注释**：`// Feature: sokoban-mvp-3-levels, Property 6: 两层校验体系分层判定的等价性`
  - PROPERTY: **Property 6 分层等价**——分两半按 design §Correctness Properties 的诚实标注写：
    - **普通入口部分（tautology in current design · 保留 fast-check 作执行守卫）**：`arbLegalLevel` + 各类违反基线的扰动 → 断言 `checkLevel(text).ok ⟺ parseLevel(text) 不抛错`；因 Task 5 后 `parseLevel` 委托 `checkLevel`，本半是结构性重言式、fast-check 找不到反例——保留是为了"若哪天有人绕过 SSOT 会立刻被抓"
    - **发表关入口部分（有实测价值 · fast-check 主战场）**：生成器覆盖：合法关（能过 gate）、0=0 特例（过 base check、不过 gate 因 boxes < 2）、单箱单目标（过 base check、不过 gate 因 <2）、开局已通关（所有 `$` 都是 `*`、`checkWin(grid) === true`、过 base check、不过 gate）；断言 `checkLevel(text).ok && (() => { try { assertPublishableLevel(parseLevel(text)); return true; } catch { return false; } })()` 与 gate 通过/失败判据等价
  - EXAMPLE: **三关分类正/反例**——本 MVP 落地的三份关卡的期望行为一次性验证（Task 1 已建、Task 5 重构后可读入）：
    - `src/levels/publishable/level-push-1.txt`：读入 → checkLevel.ok === true；parseLevel 不抛；assertPublishableLevel 不抛（发表关正例）
    - `src/levels/publishable/level-push-big.txt`：同上（发表关正例）——注：本任务落地时 Task 11 可能尚未微调地图；本 EXAMPLE 允许在 Task 11 完成后重跑一次核对（当前波先跑一次得到反馈、Task 11 依此微调）
    - `src/levels/practice/level-walk-only.txt`：checkLevel.ok === true；parseLevel 不抛；assertPublishableLevel **抛错**（0=0 特例、不过 gate；普通关正例、发表关反例）
    - `src/levels/malformed/level-malformed-leak.txt`：checkLevel.ok === false 且含 `boundary-not-closed` issue；parseLevel **抛错**（MVP-3 严格化后的新增行为，Task 5 落地）
  - **对 Property 6 tautology 半的补充守法**：本测试文件也顺手加两条 SMOKE 断言（不用 fast-check、只是硬编码文本 assertion）：
    - 断言 `parseLevel` 遇非法字符抛错、抛错消息含 `"invalid-char"`
    - 断言 `parseLevel` 遇边界不闭合抛错、抛错消息含 `"boundary-not-closed"`
  - **验收动作**：`npm test -- check-level.layered` 得真实通过输出
  - _Requirements: R1.2（合法 2 关可加载可通关 + 畸形关被 base 拦下）, R1.3（分层判定：普通入口只需 base；发表关 = base + gate）_
  - _Design: §Correctness Properties Property 6；Testing Strategy · check-level.layered.test.ts_

- [x] 7. `src/levels-manifest.ts` 新增 · `import.meta.glob` 静态清单 + `PUBLISHABLE_LEVELS` 目录派生
  - 新建 `src/levels-manifest.ts` 照 design §4 落实：
    - `import.meta.glob("./levels/publishable/*.txt", { as: "raw", eager: true })` → `publishableModules`
    - `import.meta.glob("./levels/practice/*.txt", { as: "raw", eager: true })` → `practiceModules`
    - **`malformed/` 目录不扫**——畸形关不进浏览器 `LEVELS`、只走 CLI 报错验收路径
    - `normalize(modules)` 提取"去路径去后缀"短名：`"./levels/publishable/level-push-1.txt" → "level-push-1"`
    - 导出常量三件套：
      - `export const LEVELS: Readonly<Record<string, string>> = { ...publishable, ...practice }`
      - `export const DEFAULT_LEVEL = "level-push-1"`
      - `export const PUBLISHABLE_LEVELS: ReadonlySet<string> = new Set(Object.keys(publishable))` ← **从目录派生、非硬编码**
  - **纪律守法**：
    - `PUBLISHABLE_LEVELS` 里**不允许**出现任何硬编码字符串数组——只有 `new Set(Object.keys(publishable))` 派生路径；这兑现 R1.3 "仅数据层变化即可添加或切换关卡"的强承诺（加发表关 = 扔 txt 到 `publishable/` 目录、不改一行代码）
    - 文件顶部注释说明"`PUBLISHABLE_LEVELS` 从 publishable/ 目录派生，添加发表关走 `git mv` 或直接落 txt 到该目录、不改本文件"
    - **零 `@paradigm` 标记**：本文件是"AFP 承诺范围内的打包期静态数据搜集"，与"配置图静态可枚举"红线兼容（design §7 与 AFP 纪律小节论证过）
  - **验收动作**：
    - `npm run typecheck` 得 0 错——`import.meta.glob` 的类型由 `vite/client.d.ts`（`vite-env.d.ts` 已声明 `*?raw`）覆盖；若类型报错、需在 `vite-env.d.ts` 补 `import.meta.glob` 的返回类型声明或用 `as` 断言处理，具体做法照 vite 官方文档调整（不引入新范式）
    - 手写一个临时 sanity 断言（可在 Task 8 的 test 里、也可放独立 sanity check）：`Object.keys(LEVELS)` 至少含 `["level-push-1", "level-push-big", "level-walk-only"]`；`PUBLISHABLE_LEVELS.has("level-push-1") && PUBLISHABLE_LEVELS.has("level-push-big") && !PUBLISHABLE_LEVELS.has("level-walk-only")`——本任务当轮真实工具输出：`npm test` 走一遍全绿
  - _Requirements: R1.3（仅数据层变化即可加/切关 · 强承诺）, R1.5（浏览器 demo 切关最简可行 · 静态可枚举清单支撑）_
  - _Design: §4 `src/levels-manifest.ts`；Architecture 关卡切换机制的数据流；"发表关分类通过目录结构承担" 取舍_

- [x] 8. `resolveLevelFromUrl` 纯函数（放 `src/main.ts` 内）+ `tests/resolve-level.test.ts`（Property 7）
  - **在 `src/main.ts` 内新增导出**（`export function resolveLevelFromUrl(...)`；照 design §5 落实）：
    ```ts
    export function resolveLevelFromUrl(
      search: string,
      levels: Readonly<Record<string, string>>,
      defaultLevel: string,
    ): { name: string; rawText: string }
    ```
    - 内部用 `URLSearchParams(search).get("level")` 读参数
    - 匹配 `levels[requested]` 有值 → 返回 `{ name: requested, rawText: levels[requested] }`
    - 未指定 或 指定了不存在的关 → 返回 `{ name: defaultLevel, rawText: levels[defaultLevel] }`；后者可选 `console.warn` 一句（对用户友好、不阻断）
    - **纯函数**：同 `search` 同结果、无副作用、无跨回合状态 → **不新增 `@paradigm` 标记**（design §7 与 AFP 纪律小节明确论证）
  - 新建 `tests/resolve-level.test.ts`：
    - PROPERTY: **Property 7 URL 关卡分派器的普适行为**——fast-check ≥100 iterations 生成 `nameCandidate`（覆盖：`LEVELS` 键集合、`LEVELS` 外的随机字符串、空字符串、含特殊字符的字符串）；构造 `search = nameCandidate === "" ? "" : "?level=" + encodeURIComponent(nameCandidate)`；断言：
      - 若 `nameCandidate` 非空 且 `LEVELS[nameCandidate]` 有值：`name === nameCandidate && rawText === LEVELS[nameCandidate]`
      - 否则：`name === DEFAULT_LEVEL && rawText === LEVELS[DEFAULT_LEVEL]`
      - **恒等**：`rawText === LEVELS[name]`（分派结果自洽）
    - EDGE_CASE：空 search、`?level=`（空值）、`?level=xxx&other=y`（多参数）、URL 编码（如 `?level=level%2Dpush%2D1`）
    - 测试内自造 mock `levels` map（不 import `LEVELS`），Property 7 生成器对 mock 关卡名做参数化
    - 头注释：`// Feature: sokoban-mvp-3-levels, Property 7: URL 关卡分派器的普适行为`
  - **中间态注**：本任务只在 `main.ts` 中**新增导出** `resolveLevelFromUrl`（并新增其单测）——**不改变 `main.ts` 顶层装载逻辑**（顶层仍走 MVP-2 的 `import levelText from "./levels/publishable/level-push-1.txt?raw";` 单关装载）；把顶层改为清单化 + `bootstrap` 调用留给 Task 9。这样本任务完成后 `npm run dev` 仍只玩得到默认关（URL 切关要等 Task 9），但 typecheck + 全量测试仍绿。
  - **验收动作**：`npm test -- resolve-level` 得真实通过输出、fast-check ≥100 iterations 无反例
  - _Requirements: R1.5（浏览器 demo 能切换游玩全部合法关；URL 查询参数最简可行形式）_
  - _Design: §5 `src/main.ts` · resolveLevelFromUrl；Property 7；Error Handling · URL 指定了不存在的关卡_

- [x] 9. `bootstrap` 装载期一次性函数（`src/main.ts`）+ 顶层调用改造 + `tests/main-url-loading.test.ts`（jsdom EXAMPLE）
  - **`src/main.ts` 装载段照 design §5 "可测试性 · 抽装载段为装载期一次性函数 `bootstrap`" 落实**：
    - 新增 `export function bootstrap(container, urlSearch, levels, defaultLevel, publishableLevels, pushConfigRaw)`——**显式注入 `pushConfigRaw` 参数**（避免 bootstrap 隐式依赖模块顶层的 `import pushConfigRaw from "./configs/push.jsonc?raw";`，保测试可注入性；否则 jsdom 测试要么被迫依赖真实 push.jsonc 内容、要么改回模块作用域访问、两者都削弱注入语义）
    - 签名照 design 建议 + 本任务加 `pushConfigRaw` 参数：
      ```ts
      export function bootstrap(
        container: HTMLElement,
        urlSearch: string,
        levels: Readonly<Record<string, string>>,
        defaultLevel: string,
        publishableLevels: ReadonlySet<string>,
        pushConfigRaw: string,
      ): { currentGrid: GridState; levelText: string; levelName: string };
      ```
    - 内部按顺序执行：`resolveLevelFromUrl(urlSearch, levels, defaultLevel)` → `checkLevel(rawText)`（**base check · 装载前**）→ 失败：控制台 `console.error` + `container.textContent` 显示可读诊断 + `throw new Error("base check failed for level ...")`（fail-fast、模块图停在这里、不进装配流）→ `parseLevel(rawText)` → 若 `publishableLevels.has(levelName)` 则 `assertPublishableLevel(currentGrid)`（MVP-2 已有 · 一字不改）→ `createPushRegistry()` / `parseJsonc<FlowConfig>(pushConfigRaw)` → `render(currentGrid, container)` + 绑定 `keydown` 回调（沿用 MVP-2 门控 / R 重开 / try-catch 三条控制流，keydown 回调内部代码语义**不变**、只是从顶层挪进 bootstrap；`currentGrid` / `won` 走 bootstrap 内的局部变量 + 闭包捕获）
    - R 键重开分支：`currentGrid = parseLevel(levelText)`；`won = false`；`render` 更新；`return`——**不重跑 checkLevel**（首次已过）、**不重复 assertPublishableLevel**（首次已过）；语义与 MVP-2 完全相同
    - **`@paradigm` 标记纪律**：`main.ts` 头部现有的 `@paradigm NON-AFP: external-control-flow` 语义**仍只覆盖回合门控 / 终局拦截 / R 重开三条控制流**（这些在 keydown 回调内、bootstrap 只把回调注册进去、控制流本身没移入 bootstrap）——bootstrap 是"装载期一次性函数、DOM 副作用同参同效"，**不新增标记**、不扩展现有标记语义；design §5 与 AFP 纪律小节的论证不复制此处、以设计为准
  - **`main.ts` 顶层改造**：
    - 顶层从 `import { LEVELS, DEFAULT_LEVEL, PUBLISHABLE_LEVELS } from "./levels-manifest.js";` 拿清单
    - 删除 Task 1 引入的临时 `import levelText from "./levels/publishable/level-push-1.txt?raw";`（改由 `LEVELS[DEFAULT_LEVEL]` 承担）
    - **保留** `import pushConfigRaw from "./configs/push.jsonc?raw";`——作为 bootstrap 的显式参数传入
    - 顶层最终只保留一句 bootstrap 调用：`bootstrap(document.getElementById("grid")!, window.location.search, LEVELS, DEFAULT_LEVEL, PUBLISHABLE_LEVELS, pushConfigRaw);`
    - `walkConfigRaw` 若仍存留可保留或按需清理（MVP-2 tasks 已注明保留作对照）
  - 新建 `tests/main-url-loading.test.ts`（**jsdom 环境**，复用 MVP-2 `win-lockout.test.ts` 的 jsdom pattern）：
    - EXAMPLE：注入 mock `container = document.createElement("div")` + mock `levels`（含 3-4 份手写合法关卡文本）+ 任意 `urlSearch` + 真实 `pushConfigRaw`（可直接 `import pushConfigRaw from "../src/configs/push.jsonc?raw";` 或用 MVP-2 已知的最小 push 配置字符串——mock 与真实二选一、REPORT 记录选型）
    - 断言：`bootstrap(container, "?level=<big>", mockLevels, mockDefault, mockPublishable, pushConfigRaw)` 后，`container` 内 `<pre class="sokoban-grid">` 的文本首行 / 玩家位置字符对应目标关卡期望——**通过 bootstrap 装载期一次性函数注入依赖、不需要 mock `import.meta.glob`、不需要多次 import main.ts**（design §5 显式论证过测试可行性）
    - 断言：`?level=<不存在的名字>` → 回退到 `mockDefault`、DOM 反映默认关卡
    - 断言：`?level=<mock 里过 base check 但不过 gate 的关卡，如 0=0 特例>`+ 该关在 `mockPublishable` 集合中 → bootstrap 抛错（`assertPublishableLevel` fail-fast、模块图中断语义）
    - 断言：mock 里含**非法字符**的关卡文本 → bootstrap 抛错（base check fail-fast）；`container.textContent` 显示可读诊断（包含 rule 名 + message）
    - 头注释：`// Feature: sokoban-mvp-3-levels, EXAMPLE: bootstrap URL 装载 + base check + gate 分层`
  - **验收动作**：`npm test -- main-url-loading` 得真实通过输出；bootstrap 在 jsdom 下能跑通
  - _Requirements: R1.3（普通/发表关分层判定装载）, R1.4（关卡增/删/改不改代码——本任务对 main.ts 的改动是"清单化 + 抽 bootstrap"、不属于"因加关卡而改代码"）, R1.5（浏览器 demo 切换）_
  - _Design: §5 `src/main.ts` 微改 + bootstrap；Error Handling · base check 失败的 throw；Testing Strategy · main-url-loading.test.ts_

- [x] 10. `scripts/check-level.mjs` 薄壳 CLI + `package.json` 加脚本 + `tests/check-level-cli.test.ts`（EXAMPLE · AC 2.4 B）
  - 新建 `scripts/check-level.mjs`（**薄壳、不重复实现校验逻辑**、只做"读文件 → 调函数 → 打印诊断 → 设 exit code"四件事、SSOT 铁律 2 落实）：
    - 用法：`node scripts/check-level.mjs <path/to/level.txt>` 或 `npm run check-level -- <path>`
    - `import { checkLevel } from "../src/check.ts"`——通过 `tsx` 直接跑 TS 源码、避开编译产物
    - Exit code 语义：`0`（合法）/ `1`（不合法 · stderr 印所有 issues · `[${rule}] ${message}`）/ `2`（缺参数 · stderr 印用法）
    - 照 design §3 "薄壳 CLI" 落实、字段与函数一一对应
  - `experiments/exp06-sokoban/package.json` 加脚本：
    ```json
    "check-level": "tsx scripts/check-level.mjs"
    ```
    - 若 `tsx` 版本对 `.mjs` 内 `import "../src/check.ts"` 路径映射有问题，改脚本文件名为 `.ts`（`scripts/check-level.ts` + `tsx scripts/check-level.ts`）——**本任务的落地实测阶段决定**（design "设计阶段未决" 明列此项）；哪种能跑就用哪种、REPORT 里记录选型
  - 新建 `tests/check-level-cli.test.ts`（EXAMPLE · AC 2.4 B）：
    - 用 `node:child_process` 的 `spawnSync` 派发子进程跑 `npx tsx scripts/check-level.mjs <path>`（或 `.ts`，与上面选型一致）
    - 对四份关卡跑一次、断言：
      - `src/levels/publishable/level-push-1.txt` → exit code 0；stdout 含 "通过"
      - `src/levels/publishable/level-push-big.txt` → exit code 0；stdout 含 "通过"
      - `src/levels/practice/level-walk-only.txt` → exit code 0；stdout 含 "通过"（0=0 特例过 base check、CLI 不管 gate）
      - `src/levels/malformed/level-malformed-leak.txt` → exit code 1；stderr 含 `[boundary-not-closed]` 或对应 rule 名 + message
    - 对**同一份关卡文本**，断言子进程输出的 issues 逐条**与 `checkLevel(readFileSync)` 的函数返回值一致**（CLI 是薄壳、必然等价——这是 SSOT 结构守卫）
    - 缺参数：`spawnSync` 不传 argv → exit code 2；stderr 含 "用法"
    - 头注释：`// Feature: sokoban-mvp-3-levels, EXAMPLE: check-level CLI 与 checkLevel 函数等价（AC 2.4 B）`
  - **验收动作**：
    - `npm run check-level -- src/levels/publishable/level-push-1.txt` 手动跑一次得 exit code 0 真实输出
    - `npm run check-level -- src/levels/malformed/level-malformed-leak.txt` 手动跑一次得 exit code 1 + stderr issues 真实输出
    - `npm test -- check-level-cli` 得真实通过输出
  - _Requirements: R2.1（独立命令行或函数使用 · 不装载不启浏览器）, R2.4（CLI 与函数底层共享 · 修改扫描逻辑只应改一处）_
  - _Design: §3 薄壳 CLI；Testing Strategy · check-level-cli.test.ts；"设计阶段未决" · `.mjs` 或 `.ts`_

- [x] 11. `level-push-big.txt` 具体地图微调 + 可解性证明 + `assemble-push` 加通关序列 EXAMPLE
  - **本任务落地时机**：Task 5 后（`parseLevel` 严格化）、Task 6 后（layered test 可作反馈信号）——若 Task 1 建的初稿本身平衡且过 checkLevel，本任务只做"验证可解 + 记录通关序列"；若初稿有小瑕疵，本任务微调
  - **工作量提示**：预计 30-90 分钟（取决于初稿质量与推箱试错次数）。若手工试推卡住超过 2 小时——**允许降级**：把布局缩到 **3 箱 3 目标 或 2 箱 2 目标**（下限 = 2 箱 2 目标，因为 `assertPublishableLevel` 硬要求 ≥2 箱 ≥2 目标；design §6 "约 4 箱 4 目标"是设计意图不是硬门槛）；也可以换更宽的通道拓扑。**可解性证据本身是发表证据、比"4 箱"的美学重要**；降级时如实记录到 REPORT（Task 15 · "level-push-big 可解性证明"节）。
  - **约束**（tasks 阶段落地必守；design §6 "大关卡草图" + "设计意图约束" · 依上述允许微调）：
    - ≥10×10 网格、外圈墙闭合
    - 恰 1 玩家；玩家位置可微调（草图给的是 `(2, 9)` 附近）
    - **箱目标数 ≥ 2 且平衡**（首选 4=4；允许降到 3=3 或 2=2；不做 PCG，手工设计）
    - 通道分隔避免"一步推到位"的平凡解
    - 过 `checkLevel`（base check）+ 过 `assertPublishableLevel`（gate：≥2 箱 ≥2 目标 + 开局非通关）
  - **可解性证明动作**：
    - 用 `stepPush(pushConfig, createPushRegistry(), initialGrid, direction)` 从 `parseLevel(bigLevelText)` 一步步推、真实产出到 `won === true`
    - **不使用求解器**——手工写出可行方向序列（例如 20-40 步的通关路径）
    - 若初稿实际不可解 / 存在 dead-end（箱贴墙推不动、通道太窄卡住）→ 微调 ASCII 布局重试；直到有一份可解 + 平衡的最终稿
  - `tests/assemble-push.test.ts` **改**（MVP-2 已有小图通关序列不删）：
    - 新增一个 `describe`：`"assemble-push · level-push-big 通关序列（EXAMPLE）"`
    - 从 `src/levels/publishable/level-push-big.txt` 用 `?raw` import 读入
    - `parseLevel(bigLevelText)` → 初始 grid → 完整方向序列驱动 `stepPush` → 每步断言 `result.nextGrid` 关键字段与 `result.won` 符合预期；末步 `won === true`
    - 头注释追加：`// Feature: sokoban-mvp-3-levels, EXAMPLE: assemble-push · level-push-big 通关（AC 1.2 大关卡可通关证据）`
  - **验收动作**：
    - `npm run check-level -- src/levels/publishable/level-push-big.txt` 得 exit code 0
    - `npm test -- assemble-push` 得 level-push-big 通关序列真实跑通、末步 won=true
    - 若可解性遇阻 → 微调 ASCII 布局、重跑到绿；如实记录调整过程到 REPORT（Task 15）
  - _Requirements: R1.2（3 关关卡集含大关卡正例 · 合法 2 关可通关）, R1.3（发表关正例过 base + gate）_
  - _Design: §6 关卡资产 · 大关卡草图 + 设计意图约束；"设计阶段未决" · level-push-big 具体地图布局_

- [x] 12. 门禁一二：`npm run typecheck` 0 错 + `npm test` 全绿（铁律 1 verify-first）
  - **前置**：Task 1–11 全部完成、代码 / 测试 / 关卡资产就位
  - `npm run typecheck` 得 0 错——真实工具输出（vitest 经 esbuild 剥类型不做完整类型检查，`tsc --noEmit` 必须单独跑；MVP-0 靠它抓过 vitest 漏掉的类型收窄 bug、`test-and-acceptance.md` 明列）
  - `npm test` 全跑一次全绿——真实工具输出，覆盖：
    - **MVP-3 新增 9 份测试文件**：`scan-ascii.test.ts` / `check-level.invalid-char.test.ts` / `check-level.player-count.test.ts` / `check-level.box-goal.test.ts` / `check-level.boundary.test.ts` / `check-level.layered.test.ts` / `resolve-level.test.ts` / `main-url-loading.test.ts` / `check-level-cli.test.ts`
    - **MVP-2 已有 12 份回归**：`parse-level` / `move-with-push` / `win-check` / `determinism` / `invariants` / `render` / `assemble-push` / `assemble-walk` / `move-step` / `input-adapter` / `win-lockout` / `jsonc` —— **全部零改动继续绿**（AC 1.4 架构不变量 + AC 2.4 SSOT 内部重构不改语义的双重守法）
    - Property 1-5 + Property 6 + Property 7 各 fast-check ≥100 iterations 全绿
  - fast-check 反例出现 → **修实现**（不改测绕过）、重跑至真绿；反例本身即验证材料、可入 REPORT
  - typecheck 或 test 未真绿 → 不勾选本任务，也不进入下游 Task 13 / 14
  - _Requirements: R 全量_
  - _Design: `test-and-acceptance.md` 门禁三项之 1 + 2；status-sync 铁律 1_

- [x] 13. SMOKE：`@paradigm` grep + Property 1/6 tautology 结构守卫静态检查（AC 5.3 沿用 + SSOT 铁律 2 守法）
  - **SMOKE 1 · `@paradigm` grep**：跑一次扫描——**Windows PowerShell 命令写成单行**（反引号跨行在从 Markdown 复制到终端时容易变普通换行导致命令截断）；PowerShell 与 \*nix grep 二选一：
    - PowerShell（单行、复制可直接粘）：
      ```powershell
      Get-ChildItem -Path experiments/exp06-sokoban -Recurse -File -Include *.ts,*.tsx,*.js,*.jsx,*.html,*.jsonc,*.json,*.md -Exclude *.d.ts | Where-Object { $_.FullName -notmatch "\\node_modules\\|\\dist\\|\\assets\\" } | Select-String -Pattern "@paradigm"
      ```
    - \*nix / Git Bash：
      ```bash
      grep -Rn --include='*.ts' --include='*.tsx' --include='*.js' --include='*.html' --include='*.jsonc' --include='*.json' --include='*.md' --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=assets "@paradigm" experiments/exp06-sokoban/
      ```
    - **期望命中数与位置**（继承 MVP-2 恰 1 处 + MVP-3 新增文件全零）：
      - `src/main.ts` → **恰 1 处**命中（MVP-2 已有 `NON-AFP: external-control-flow` + `@reason` + `@afp-debt` 三字段齐；本 MVP 不扩语义边界）
      - `src/scan-ascii.ts` → 0 命中（纯 AFP 机制）
      - `src/check.ts` → 0 命中（纯 AFP 机制）
      - `src/levels-manifest.ts` → 0 命中（纯数据 · AFP 承诺范围内）
      - `src/grid.ts` → 0 命中（内部重构后仍 0）
      - `src/blocks/**` / `src/configs/**` / `src/adapters/**` / `src/driver.ts` / `src/render.ts` → 0 命中
      - `index.html` / `vite.config.ts` / `scripts/check-level.mjs` → 0 命中
      - `REPORT.md` → **允许命中**（Task 15 追加段会引用"@paradigm 恰 1 处"作证据素材文本；文档命中 vs 代码命中人肉甄别；若混淆则代码与文档分两次扫）
    - 命中数或位置与预期不符 → 追根究底（多打？漏字段？位置错？误删？）并如实写进 REPORT.md 追加段（Task 15）；**不为对齐预期反手删标记**
  - **SMOKE 2 · Property 1/6 tautology 结构守卫静态检查**（design §Testing Strategy · SMOKE 段 "补两条静态检查作为主力守法" · 因两条 property 在当前设计下是重言式、fast-check 无实证反例价值、SMOKE 是主力守法）——**PowerShell / \*nix 命令并列给全**（本机默认 cmd/PowerShell）：
    - **[必查] `checkLevel(` 应命中 `src/grid.ts`** —— `parseLevel` 函数体内部必须调 `checkLevel`（走委托路径、没绕开自己重写校验）；命中位置应在 `parseLevel` 函数体内部而非 import 行
      - PowerShell：`Select-String -Path experiments/exp06-sokoban/src/grid.ts -Pattern "checkLevel\("`
      - \*nix / Git Bash：`grep -n "checkLevel(" experiments/exp06-sokoban/src/grid.ts`
    - **[必查] `scanAscii(` 除 import 行外不应命中 `src/grid.ts`** —— `parseLevel` 应从 `checkLevel` 返回的 `result.scan` 取扫描结果、**不直接调 `scanAscii`**
      - PowerShell：`Select-String -Path experiments/exp06-sokoban/src/grid.ts -Pattern "scanAscii\("`
      - \*nix / Git Bash：`grep -n "scanAscii(" experiments/exp06-sokoban/src/grid.ts`
    - 两条不符预期 → **P1 级设计违反**、回退到 Task 5 修 `parseLevel` 实现；这是能真正抓到"有人绕过 SSOT" 的静态防线、比 fast-check tautology 更管用
    - **[顺手扫] `scanAscii(` 应命中 `src/check.ts`**（`checkLevel` 内部调 `scanAscii` 一次）
      - PowerShell：`Select-String -Path experiments/exp06-sokoban/src/check.ts -Pattern "scanAscii\("`
      - \*nix / Git Bash：`grep -n "scanAscii(" experiments/exp06-sokoban/src/check.ts`
    - **[顺手扫] 全 `src/` 范围 `scanAscii(` 命中位置** —— 除 `src/scan-ascii.ts`（定义处）与 `src/check.ts`（调用处）外应 0 命中——`scanAscii` 不应被 `main.ts` / `grid.ts` / `blocks/**` 等直接使用
      - PowerShell：`Get-ChildItem -Path experiments/exp06-sokoban/src -Recurse -Filter *.ts | Select-String -Pattern "scanAscii\("`
      - \*nix / Git Bash：`grep -rn "scanAscii(" experiments/exp06-sokoban/src/`
  - **SMOKE 3 · R1.4 架构不变量的 git diff 守法**（design §Testing Strategy · SMOKE / 代码评审项）：
    - **注意路径**：引擎 `engine/**` 在**仓库根**（不是 `experiments/exp06-sokoban/engine`——后者根本不存在）；装配块 / 转接件 / 配置在实验目录内。命令要区分：
      ```bash
      git diff --stat <baseline> -- engine/ experiments/exp06-sokoban/src/blocks/ experiments/exp06-sokoban/src/adapters/ experiments/exp06-sokoban/src/configs/ experiments/exp06-sokoban/src/render.ts experiments/exp06-sokoban/src/driver.ts experiments/exp06-sokoban/src/jsonc.ts experiments/exp06-sokoban/index.html
      ```
      `<baseline>` = MVP-2 收尾时的 commit（Plucker518 提供或用 `HEAD~N` 反推；也可 `git log --oneline experiments/exp06-sokoban/ | grep MVP-2` 定位）
    - 期望：`engine/**` 0 改动（仓库根）；`experiments/exp06-sokoban/src/blocks/**` / `src/adapters/**` / `src/configs/**` / `src/render.ts` / `src/driver.ts` / `src/jsonc.ts` / `index.html` 0 改动或仅说明性注释——**兑现 R1.4 强承诺**
    - `experiments/exp06-sokoban/src/grid.ts` 允许内部重构（有 diff），但对外契约由 Task 12 MVP-2 单测零改动继续绿守（不看 diff 大小、看行为）
    - `experiments/exp06-sokoban/src/main.ts` 装载段有改动（bootstrap + resolveLevelFromUrl），属于本 MVP 承诺的合法改动、不违反 R1.4（R1.4 说的是"引擎 / 装配块 / 转接件不变"、`main.ts` 是浏览器入口不在此列）
    - `experiments/exp06-sokoban/tests/parse-level.test.ts` 若仅 import 路径微改（Task 1）也允许——同"路径变、行为不变"
  - **验收动作**：三次 grep + 一次 git diff 全走一遍、结果作为 Task 15 REPORT 追加段的正面证据素材保留；若任一条不符预期，回退到对应上游任务、不勾选本任务
  - _Requirements: R1.4（架构不变量守法）, R2.4（SSOT · 修改 parseLevel 只应改一处 · 静态检查主力守法）, R5.3（隐式沿用 MVP-2 @paradigm 结论）_
  - _Design: §Testing Strategy · SMOKE / 代码评审项；§AFP 纪律与范式标记；Property 1 / 6 诚实标注_

- [x] 14. 门禁三：真人浏览器验收（三关 URL）+ CLI 冒烟四份关卡（`test-and-acceptance.md` · 端到端入口跑一次）
  - **前置**：Task 12 门禁一二绿、Task 13 SMOKE 三项达标
  - **CLI 冒烟四份关卡**（AI 或 Plucker518 手动跑、当轮真实输出）：
    - `npm run check-level -- src/levels/publishable/level-push-1.txt` → 期望 exit code 0、stdout 含"通过"
    - `npm run check-level -- src/levels/publishable/level-push-big.txt` → 期望 exit code 0、stdout 含"通过"
    - `npm run check-level -- src/levels/practice/level-walk-only.txt` → 期望 exit code 0、stdout 含"通过"（0=0 特例过 base check）
    - `npm run check-level -- src/levels/malformed/level-malformed-leak.txt` → 期望 exit code 1、stderr 含 `[boundary-not-closed]` + hint 坐标
    - 四份关卡的 CLI 输出记录（可粘贴到 REPORT.md、Task 15）
  - **真人浏览器验收 URL**（Plucker518 手动跑 `npm run dev`——AI 不启长驻服务、`test-and-acceptance.md` 端到端入口规约）：
    - **URL 1**：`http://localhost:5173/?level=level-push-1` → 加载后画面看到 MVP-2 已验证的 6×6 小关；方向键 / WASD 走路 / 推箱 / 通关 / R 重开一整套沿用 MVP-2 验收路径成立（回归 MVP-2 覆盖面）
    - **URL 2**：`http://localhost:5173/?level=level-push-big` → 加载后画面看到 ≥10×10 大关卡；玩家位置符合 Task 11 落地；箱目标数 ≥ 2 且平衡；按 Task 11 记录的通关序列走通至胜利提示（`level-push-big` 可玩证据）
    - **URL 3（walk-only 特例 · 明确期望是"门控立即锁死"、不是"能走路"）**：`http://localhost:5173/?level=level-walk-only` —— **checkWin 语义决定了 0=0 特例加载后按下第一个方向键就会 won=true**（`grid.boxes.every(...)` 空数组返 true 是 JS `.every()` 的必然行为，MVP-2 win-check 就是这个契约；本 MVP 不改 checkWin——修改 checkWin 会碰 `src/blocks/**`、违反 R1.4 架构不变量）。因此 URL 3 的**预期行为**如下（不是"能走路"）：
      - **✅ 期望**：加载不白屏；`container` 内能看到 walk-only 关卡的 ASCII 布局（4 面墙 + 1 个玩家 + 空地）
      - **✅ 期望**：按下**任一方向键**后立即 `won = true`、门控锁死、后续方向键无响应；`render(...)` 显示胜利提示 DOM（沿用 MVP-2 语义）
      - **✅ 期望**：按 `R/r` 键重开、回到初始态；再按方向键仍立即胜利（可重复验证）
      - **✅ 期望**：`assertPublishableLevel` **不调**（walk-only 不在 `PUBLISHABLE_LEVELS` 白名单里、装载通过）
      - **📝 REPORT 记录**：这是 0=0 特例 + `checkWin` `.every()` 空数组返 true 的**预期行为**、不是 bug；证明 walk-only 是"通过 base check + 不进 gate"的对照资产（正如 design §Overview §1 与 Error Handling 已说明的"不出现在 UI 层"、"是对照资产不是给最终用户玩的关卡"）——URL 可显式访问但不适合作最终用户玩法目标
      - **不允许**把"能走若干步"作为通过标准——那与 checkWin 契约 + R1.4 架构不变量冲突，需先动 `src/blocks/win-check.ts`（本 MVP 不做）
    - **URL 4（未知关卡回退）**：`http://localhost:5173/?level=unknown-level` → 加载后画面回退到默认关 `level-push-1`；控制台 warn（Task 8 `resolveLevelFromUrl` 已实现 · Error Handling 落法）
    - 录截图 / 动图作可玩佐证；佐证文件放 `experiments/exp06-sokoban/assets/`（就近）；REPORT.md 追加段引用
  - **畸形关不进浏览器验收**：`?level=level-malformed-leak` 不能通过 URL 加载（`malformed/` 不扫入 LEVELS）——手动试一次断言回退到默认关（Task 8 语义确认），并如实记录到 REPORT
  - **注**：本任务是"承认 walk-only 加载后立即胜利是预期"、不是"验收放松为观察"——若未来 MVP 想让 walk-only 真能走路，需另开 spec 修 `checkWin`（例：让 0=0 情况下 win 由"走够 N 步"或"到达特定目标"决定），那属于 R1.4 允许的"改装配块"改动、但不在本 MVP 承诺范围
  - 任一步不达 → 不勾选、回退到相关任务（如"level-push-big 通关序列跑不通 → 回 Task 11 微调地图"、"URL 切关不生效 → 回 Task 7 / 8 排查清单派生 / 分派器"、"CLI 输出与函数不一致 → 回 Task 10 排查薄壳"）
  - _Requirements: R1.5（浏览器 demo 能切换游玩全部合法关）, R2.1（独立 CLI 判定合法性）, R2.3（错误信息足以定位）_
  - _Design: `test-and-acceptance.md` 门禁三项之 3；Testing Strategy · 真人浏览器验收 + CLI 冒烟；Error Handling · URL 不存在关卡_

- [x] 15. `REPORT.md` 追加 MVP-3 段
  - MVP-1 / MVP-2 REPORT 保留不动、末尾追加"MVP-3 段"、含以下小节（design §"REPORT.md 规模" 已定：不重跑 D-014 全表、只记 MVP-3 相关工程条目）：
    - **3 关关卡集资产实测**：三份合法关卡 + 一份畸形关的浏览器 / CLI 表现记录（Task 14 截图 / 动图 + CLI 四次输出粘贴）
    - **base check 工具实测**：CLI 对四份关卡跑一次的完整 stdout / stderr / exit code 记录；`checkLevel` 函数与 CLI 输出的等价性证据（Task 10 `check-level-cli.test.ts` 结果引用）
    - **URL 切关可玩佐证**：三个 URL（push-1 / push-big / walk-only）的浏览器截图 / 动图；`?level=unknown` 回退默认关的一次实测记录
    - **`parseLevel` 内部重构语义等价性**：Task 5 前后 MVP-2 现有 12 份测试零改动继续绿的证据（`git diff tests/` 应对 MVP-2 已有测试文件 0 改动，或仅路径 import 微改；`npm test` 输出对比）；SSOT 铁律 2 落地——校验逻辑仅在 `check.ts` 一处
    - **SMOKE 三项结果**：`@paradigm` grep 命中列表 + 计数（预期"恰 1 处命中 `src/main.ts`、其余零"是否成立）；Property 1/6 tautology 静态检查（`grep checkLevel src/grid.ts` 应命中 + `grep scanAscii src/grid.ts` 除 import 外不命中）结果；R1.4 架构不变量 git diff 记录（`engine/**` / `blocks/**` / `adapters/**` / `configs/**` / `render.ts` / `driver.ts` / `index.html` 0 改动）
    - **发表关分类目录派生的证据**：`ls src/levels/publishable/` 显示的文件列表；`grep -n "PUBLISHABLE_LEVELS" src/levels-manifest.ts` 显示的派生代码位置——**兑现 R1.3 "仅数据层变化即可添加或切换关卡"强承诺**
    - **`level-push-big.txt` 可解性证明**：Task 11 手工通关序列 + `assemble-push` 端到端跑通证据；若初稿有微调则记录调整历程
    - **CLI 选型决定**（`.mjs` 或 `.ts` · design "设计阶段未决" 明列）：Task 10 落地时实测的最终选择 + 一句理由
    - **引擎缺口 / 未预见的非 AFP 范式**：若实现期有额外冒出的非 AFP 范式或引擎缺口 → 登记 `docs/open-questions.md` + 本段说明；不为收尾强行圆满
    - **发表前 checklist 状态**（roadmap D-014 · **只引用不复制**）：MVP-3 是 MVP-2 之后的稳定重复、**不重跑 D-014 全表**；本 MVP 追加"3 关关卡集 + base check 工具 + URL 切关"三条工程条目的打钩状态；其余条目引用 MVP-2 REPORT 的既有状态（`docs/paradigm-validation-sokoban-roadmap.md` D-014 为条目正本 · SSOT 铁律 2）
  - _Requirements: 交付物 · R5.3（保持 MVP-2 `@paradigm` 结论）_
  - _Design: §Testing Strategy · REPORT MVP-3 段规模_

- [x] 16. SSOT 同步 + `git status` 快照（收尾 · status-sync 铁律 1 + 2）
  - `docs/ai/state.json`：更新 `exp06-sokoban` MVP-3 状态、结论摘要、`updatedAt`（当天日期）；`nextSteps` 依 Task 15 REPORT 结果指向 MVP-4（撤销 + maxMoves）或对外发布节奏；**只改变动字段、不重写全文**
  - `docs/open-questions.md`：
    - **Q-028 状态更新**：MVP-3 推进的判据（3 关稳定重复"加关卡 = 加数据"证据 + 独立 CLI 校验能力兑现"引擎作为配置的 CAD 工具"能力）如实追加到 Q-028 的进度描述 / "关联既有缺口" 块；**是否 resolved 由证据是否覆盖全部判据决定**（路线图 D-014 与 requirements Introduction 有约束——MVP-3 的证据链未必覆盖全部判据、可能仍 `open`；不预设结局）
    - 本 MVP 未预见的引擎缺口 / 非 AFP 范式 → 用 `in_progress` 或新增 `open` 缺口如实登记
  - `git status` 得当轮真实输出（铁律 1）——反映本 MVP 落地的所有文件变动：
    - **新增**：`src/scan-ascii.ts` / `src/check.ts` / `src/levels-manifest.ts` / `src/levels/publishable/level-push-big.txt` / `src/levels/malformed/level-malformed-leak.txt` / `scripts/check-level.mjs` / `tests/scan-ascii.test.ts` / `tests/generators.ts` / `tests/check-level.invalid-char.test.ts` / `tests/check-level.player-count.test.ts` / `tests/check-level.box-goal.test.ts` / `tests/check-level.boundary.test.ts` / `tests/check-level.layered.test.ts` / `tests/resolve-level.test.ts` / `tests/main-url-loading.test.ts` / `tests/check-level-cli.test.ts`
    - **rename**（git mv）：`src/levels/level-push-1.txt → src/levels/publishable/level-push-1.txt` / `src/levels/level-walk-only.txt → src/levels/practice/level-walk-only.txt`
    - **改动**：`src/grid.ts`（parseLevel 内部重构）/ `src/main.ts`（bootstrap + resolveLevelFromUrl）/ `tests/assemble-push.test.ts`（加 big 通关序列）/ `tests/parse-level.test.ts`（路径 import 微改）/ `src/vite-env.d.ts`（注释更新）/ `package.json`（加 check-level 脚本）/ `REPORT.md`（追加 MVP-3 段）
    - **零改动**（R1.4 守法确认）：`engine/**` / `src/blocks/**` / `src/adapters/**` / `src/configs/**` / `src/render.ts` / `src/driver.ts` / `src/jsonc.ts` / `index.html` / `vite.config.ts`
  - 按 `.kiro/steering/git-workflow.md`：**AI 默认不自动 commit**；提醒 Plucker518 可以提交并附建议指令（中文提交信息、PowerShell 兼容 `;` 分隔）。**先 `git status` 检查工作区、若含非 MVP-3 的无关改动则改用选择性 add**（避免把不属于本 MVP 的改动一起提交）：
    ```powershell
    # 1. 先看清工作区
    git status
    # 2. 若工作区干净（只有 MVP-3 相关改动）——可全量 add
    git add -A
    # 或 2. 若有无关改动混在里面——按目录选择性 add（推荐、更安全）
    git add experiments/exp06-sokoban/ .kiro/specs/sokoban-mvp-3-levels/ docs/ai/state.json docs/open-questions.md
    # 3. 提交（中文说明）
    git commit -m "sokoban MVP-3: 3 关关卡集 + base 静态 check 独立工具 + URL 切关（exp06-sokoban）"
    ```
  - _Requirements: SSOT 纪律；status-sync 铁律 1 + 2；git-workflow_
  - _Design: §Testing Strategy · REPORT 收尾；status-sync SSOT 模型_

## Task Dependency Graph

> 所有 16 个任务都是 leaf task（无 sub-task 使用 decimal notation），全部必做（无 `*` 可选标记）——MVP-3 是"稳定重复 + 独立静态校验工具"的证据链、每份测试与每道门禁都是发表证据前置。

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2", "3"] },
    { "id": 2, "tasks": ["4", "5"] },
    { "id": 3, "tasks": ["6", "7", "8", "10"] },
    { "id": 4, "tasks": ["9", "11"] },
    { "id": 5, "tasks": ["12"] },
    { "id": 6, "tasks": ["13"] },
    { "id": 7, "tasks": ["14"] },
    { "id": 8, "tasks": ["15"] },
    { "id": 9, "tasks": ["16"] }
  ]
}
```

**波次依赖说明**：

- **Wave 0**（Task 1）：数据层迁移 · 目录结构 + git mv + 新关卡骨架 + 路径引用最小更新——是所有下游任务的物理前置（后续 `levels-manifest.ts` / `layered.test.ts` / CLI 冒烟都要读这些文件）
- **Wave 1**（Task 2, 3）：新增独立文件 · `scan-ascii.ts` + `check.ts` + `tests/generators.ts` —— 都只依赖 Task 1 的关卡文件存在（Task 2 的 Property 1 依赖 `parseLevel` 已在的 MVP-2 语义；Task 3 独立于 Task 2 但生成器与 checkLevel 同一文件族、放同波便于协同）
- **Wave 2**（Task 4, 5）：checkLevel 四条规则的属性测试 + grid.ts 内部重构；两者都只依赖 Task 3 的 `checkLevel` + `generators.ts` 就位（Task 5 独立于 Task 4——parseLevel 委托只需 checkLevel 接口稳定即可、不依赖属性测试通过）
- **Wave 3**（Task 6, 7, 8, 10）：layered test / levels-manifest / resolve-level 纯函数 / CLI —— 都只依赖 Wave 2 完成
  - Task 6 依赖 Task 5（parseLevel 严格化后测三关分类）
  - Task 7 依赖 Task 1 的目录结构 + Wave 2 完成（避免 checkLevel 尚未就位时无法验证清单）
  - Task 8（resolve-level 纯函数）独立于其它 Wave 3 任务、可并行
  - Task 10（CLI）只依赖 Task 3 的 `checkLevel` + Task 1 的关卡文件、可并行
- **Wave 4**（Task 9, 11）：bootstrap + main.ts 顶层改造 依赖 Task 7 的 LEVELS 清单 + Task 8 的 resolveLevelFromUrl + Task 5 的 parseLevel 严格化；Task 11（level-push-big 微调 + assemble-push 通关序列）依赖 Task 5（严格化）+ Task 6（layered test 反馈信号）；两者独立于彼此、可并行
- **Wave 5**（Task 12）：门禁一二串联点——依赖 Wave 4 全部完成、所有代码 / 测试就位
- **Wave 6**（Task 13）：SMOKE grep + 静态检查——依赖 Task 12 绿（否则代码可能还在改动、grep 结果不代表最终态）
- **Wave 7**（Task 14）：真人浏览器验收 + CLI 冒烟——依赖 Task 12 绿 + Task 13 SMOKE 达标（避免在 SMOKE 未过时启动 dev server 造成误报）
- **Wave 8**（Task 15）：REPORT 追加——依赖 Task 13 grep 结果 + Task 14 佐证素材
- **Wave 9**（Task 16）：SSOT 同步 + git status 快照收尾——依赖 REPORT 已写

## Notes

- **status-sync 铁律 1（verify-first）贯穿全表**：Task 1（git status + typecheck + MVP-2 测试仍绿）、Task 5（MVP-2 现有测试零改动继续绿的验证）、Task 12（typecheck + 全量测试）、Task 13（grep 计数 + 静态检查）、Task 14（CLI 冒烟 + 浏览器可玩）、Task 16（git status）六处必须有同轮真实工具输出；任何一处凭记忆勾选即无效。
- **test-and-acceptance 三项门禁**在 Task 12 + Task 14 两个任务里齐备：typecheck 0 错 + 相关测试全绿 + 端到端入口跑一次（本 MVP 的端到端入口 = 真人浏览器 3 URL + CLI 对 4 份关卡跑一次）。
- **PBT 追溯注释**（`// Feature: sokoban-mvp-3-levels, Property N: <title>`）在每份属性测试文件头必写；Property 1 / 6 的诚实标注（tautology in current design · fast-check 保留作执行守卫、SMOKE 静态检查是主力守法）也要如实记入头注释——不能包装成"实证价值高"。
- **`@paradigm` 只允许 1 处** 且必须在 `src/main.ts`（MVP-2 已打、本 MVP 不扩语义边界）；业务 / 装配层 + MVP-3 新增文件（`scan-ascii.ts` / `check.ts` / `levels-manifest.ts`）零标记是 D-014 `docs/paradigm-comparison.md` 的正面证据材料延续，Task 13 grep 守。
- **SSOT 铁律 2 · 校验逻辑仅一处**：Task 5 `parseLevel` 委托 `checkLevel` + Task 10 CLI 只做薄壳 + Task 13 SMOKE 静态检查——三重守法确保修改扫描 / 校验逻辑只应改一处；这是 MVP-1 白屏 bug（两份 JSONC 解析漂移）的直接教训延续。
- **R1.4 架构不变量守法**：MVP-3 完成时 `engine/**` / `src/blocks/**` / `src/adapters/**` / `src/configs/**` / `src/render.ts` / `src/driver.ts` / `src/jsonc.ts` / `index.html` 应 0 改动；由 Task 12 MVP-2 单测零改动继续绿 + Task 13 git diff 双重守。
- **发表前 checklist 只引用不复制**（SSOT · 铁律 2）：条目正本在 `docs/paradigm-validation-sokoban-roadmap.md` D-014；REPORT 追加段与 tasks 只记引用与勾选状态、不搬条目文本——搬条目就漂移。MVP-3 不重跑 D-014 全表、只打 MVP-3 相关工程条目的钩。
- **失败结论与成立结论同价**：fast-check 反例 → 修实现、不改测绕过；Task 11 若 level-push-big 初稿不可解 → 微调、如实记录调整过程到 REPORT；引擎缺口 / 未预见的非 AFP 范式 → 如实登记 `docs/open-questions.md` 与 REPORT、不为收尾强行圆满。
- **本表所有子任务都是必做**（无 `*` 可选标记）：MVP-3 是"稳定重复 + 独立静态校验工具"的证据链，每份测试与每道门禁都是发表证据前置、不是"MVP-only 加速跳过"的候选。
- **Wave 0-3 期间 `main.ts` 处于过渡态**：Task 1 后 `main.ts:19` 指向 `./levels/publishable/level-push-1.txt?raw`（能编译、能 dev）；Task 5 后 parseLevel 严格化（能编译、若 URL 装载路径没更新仍能跑默认关）；Task 9 后 `main.ts` 顶层改为调 `bootstrap` + 清单化——这三次改动的中间态都保持"可 typecheck + MVP-2 测试仍绿"，避免长时间破窗。若中间波次必须启动 `npm run dev` 排查其它问题、按当前 main.ts 状态跑即可（可能是"只玩得到默认关 level-push-1"、URL 切关要等 Task 9）。
- **Task 6 layered test 与 Task 11 level-push-big 微调的时序小提示**：Task 6 首次跑时 `level-push-big.txt` 用的是 Task 1 初稿——若初稿不完美（例如箱位置导致 dead-end），Task 6 的 layered EXAMPLE 半段可能会因 `assertPublishableLevel` 判定通过但实际不可解而暂时不能"过 gate + 可通关"双重满足；Task 11 依此反馈微调、微调后回跑 Task 6 EXAMPLE 部分。这是设计意图允许的迭代路径、不算违反流程。
- **Wave 3 是"最能吃到多任务并行"的一层**：Task 6 / 7 / 8 / 10 都只依赖 Wave 2 完成、彼此互不阻塞——若时间紧张、这层可并发推进。
