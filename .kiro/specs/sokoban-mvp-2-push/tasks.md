# Implementation Plan

> Spec: sokoban-mvp-2-push · Tasks
> 需求见 `requirements.md`，设计见 `design.md`。落地目录 `experiments/exp06-sokoban/`（MVP-2 增量：在 MVP-1 走路资产之上加推箱 + 胜利判定 + 发表闸口硬约束）。

## Overview

把 MVP-2 设计落地为对外可发表的推箱子 demo：

网格 schema 扩展（goals + boxes）与 Sokoban 字符集 parseLevel + `assertPublishableLevel` → 走+推纯块 `move-with-push` + 胜利判定纯块 `win-check` → 组合注册 `createPushRegistry` + 装配流 `push.jsonc` + 驱动 `stepPush` → 转接件 `keyToDirection` 复用验证 → 关卡资产整理（`level-1.txt` → `level-walk-only.txt` 且 `.` → 空格；新建 `level-push-1.txt`） → 渲染扩展（字符优先级 + `.sokoban-win` DOM） → `main.ts`（`@paradigm NON-AFP: external-control-flow` + `assertPublishableLevel` fail-fast + won 门控 + R/r 重开 + `stepPush` try-catch） → 属性测试（Property 1-8 PBT）+ EXAMPLE（Property 9 publication-gate + assemble-push 端到端 + win-lockout jsdom） → 门禁三项（typecheck / 全量测试 / 真人浏览器验收） → @paradigm grep SMOKE → REPORT.md 追加 → 发表前 checklist 走查（roadmap D-014，只引用不复制） → SSOT 同步 + git status 快照。

纪律（贯穿全表，不许省）：

- **status-sync 铁律 1（verify-first）**：每个"完成 / 通过 / 已实现"勾选前必须有同轮真实工具输出撑着——typecheck / vitest run / grep / 浏览器实跑截图 / git status。凭记忆勾选 = 捏造。
- **test-and-acceptance 三项门禁**：typecheck 0 错 + 相关测试全绿 + 端到端入口跑一次；本 MVP 的端到端入口 = 真人浏览器验收（Task 14）。
- **PBT 追溯**：每个属性测试文件头加 `// Feature: sokoban-mvp-2-push, Property N: <title>` 注释，与 design "Correctness Properties" 章节一一对应；Property 9 是 EXAMPLE 级（正例 + 三反例），不做 fast-check 全称量化。
- **@paradigm 只允许 1 处**：业务/装配层（`src/blocks/**` `src/configs/**` `src/adapters/**` `src/grid.ts` `src/driver.ts`）**零标记**；渲染 / 脚手架 / 引擎 **零标记**；`src/main.ts` **恰 1 处**（承接回合门控 / 终局拦截 / R/r 重开三条非 AFP 控制流）。SMOKE 任务 Task 13 用 grep 强制守。
- **发表前 checklist 只引用不复制**：条目正本在 `docs/paradigm-validation-sokoban-roadmap.md` D-014，勾选状态记 REPORT，不抄条目进 tasks / REPORT（SSOT 纪律 · 铁律 2）。
- **失败结论与成立结论同等有价值**：fast-check 反例出现 → 修实现，不改测绕过；引擎缺口如实登记到 `docs/open-questions.md`；不为 MVP-2 收尾强行圆满。

## Tasks

- [x] 1. GridState 扩展 + Sokoban 字符集 parseLevel + publication-gate 断言（`src/grid.ts`）
  - 在 MVP-1 `GridState` 上加 `goals: readonly Position[]`（静态）与 `boxes: readonly Position[]`（动态）；`PositionSchema` / `GridStateSchema` / `DirectionSchema` 同步更新（TypeBox）
  - 加字段后确认 `grid.ts` 尾部 `_typeGuards` 静态断言（`_GridStateMatches` 等）仍编译通过——TypeBox 推导会自动跟随 `GridStateSchema`，但要在 Task 12 typecheck 门禁前先手工核对不留意外
  - `parseLevel(ascii)` 支持 Sokoban 传统字符集：`#` 墙 / `<space>` 地板 / `.` 目标 / `$` 箱子 / `*` 箱子在目标 / `@` 玩家 / `+` 玩家在目标；`*` 同时进 `boxes` + `goals`，`+` 同时定位 `player` + 追加 `goals`
  - base 契约校验：恰一 `@` 或一 `+`（缺 / 多角色抛 `Error`）；箱数（含 `*`）= 目标数（含 `*` + `+`），**允许 0=0 合法特例**承接 `level-walk-only.txt`（走路对照资产）；边界闭合不强校验（留 MVP-3）
  - 派生 `isBoxOnGoal(grid, pos)`：纯函数、不入字段（单一真相 = 坐标；避免"就位态"与坐标漂移）
  - `assertPublishableLevel(grid)`：**发表关额外硬约束**——`grid.boxes.length >= 2` && `grid.goals.length >= 2` && `checkWin(grid) === false`（开局非通关）；命中任一抛 `Error`，消息说明命中哪一条；与 base `parseLevel` 分层（一份代码支撑两个 MVP 关卡语义，避免 base 契约内塞条件分支）
  - 全部纯函数：不读时钟 / 不用随机 / 不调 AI
  - _Requirements: R1.1, R2.4_
  - _Design: §1 `src/grid.ts` + Data Models"派生态而非独立字段"；两层契约（base parseLevel 与 publication-gate）_

- [x] 2. `parse-level.test.ts` 扩展（Property 1 装载正确 + Property 9 publication-gate EXAMPLE）
  - PROPERTY: **Property 1 装载正确**——fast-check ≥100 iterations 生成合法 Sokoban ASCII（恰一 `@`/`+`、箱数=目标数含 0=0 特例、字符在 `# . <space> @ $ * +` 内），断言 `walls` / `goals` / `boxes` / `player` 坐标一一对应；`width` = 最长行长度、`height` = 行数；覆盖 `*`（同时进 boxes + goals）与 `+`（同时定位 player + goals）交叉出现
  - EDGE_CASE: 缺 `@` / 多 `@` / 箱数 ≠ 目标数（且非 0=0）→ `parseLevel` 抛 `Error`；0=0 合法（走路对照资产可通过）
  - EXAMPLE: **Property 9 publication-gate**——用 Vite `?raw` import（例如测试文件顶部 `import levelPushRaw from "../src/levels/level-push-1.txt?raw"`，与 `main.ts` 同套装载路径，避开 vitest cwd 依赖，比 `readFileSync` 更 portable）读入发表关文本 → `parseLevel(levelPushRaw)` 装出 initialGrid → `assertPublishableLevel(initialGrid)` **不抛错**（正例）；三份故意畸形关卡文本作反例（<2 箱 / <2 目标 / 开局即通关 checkWin===true），断言 `assertPublishableLevel` 抛 `Error` 且错误消息可辨认命中的具体约束
  - 文件头注释（两条 Property 分开写）：
    - `// Feature: sokoban-mvp-2-push, Property 1: 装载正确`
    - `// Feature: sokoban-mvp-2-push, Property 9: 发表关满足 publication-gate 硬约束（EXAMPLE 级）`
  - 跑 `npm test -- parse-level` 得真实通过输出后才勾选
  - _Requirements: R1.1, R2.4_
  - _Design: Property 1, Property 9；Testing Strategy 测试文件与属性映射表_

- [x] 3. 走+推纯块 `src/blocks/move-with-push.ts`（算法入块，纯机制）
  - 实现纯函数 `moveWithPush(grid, direction): GridState`——**推链只允许一层**，判断顺序：
    - 目标格 = `player + Δ(direction)`；目标格越界 / 命中 walls → 停在原格
    - 目标格无箱、无墙、不越界 → 玩家前进一格（走路语义，MVP-1 R1.4/R1.5 在扩展 GridState 上继承）
    - 目标格有箱、箱前方一格越界 / 是墙 / 是另一个箱 → 玩家和该箱都停在原格（一次只推一个，不拉）
    - 目标格有箱、箱前方一格无箱无墙且不越界 → 玩家和该箱各前进一格
  - 静态地形 `width` / `height` / `walls` / `goals` 原样带出；动态 `player` / `boxes` 按上述规则更新
  - 撞墙 / 越界 / 推不动的输出值确定且每次一致
  - 包成纯 `BlockDef`：`name: "move-with-push"`；`inputSchema: Type.Object({ grid: GridStateSchema, direction: DirectionSchema })`；`outputSchema: Type.Object({ nextGrid: GridStateSchema })`
  - 沿用 exp01 跨包深路径 import（`../../../../engine/src/index.js`）
  - _Requirements: R1.3, R1.4, R1.5, R1.6_
  - _Design: §2 `move-with-push` + 块发现与复用讨论（新块 vs 扩 move-step vs 级联，选新块）_

- [x] 4. `move-with-push.test.ts` 新（Property 3 单次移动层 + Property 4 推可走 / Property 5 推不动 / Property 6 走路仍成立 + 边界 EDGE_CASE）
  - PROPERTY: **Property 3 网格不变式 + 箱子守恒（逐回合单次移动层）**——fast-check 生成合法 (grid, direction)，断言 `moveWithPush(grid, direction)` 输出 nextGrid 满足：(a) player 在 [0,width)×[0,height) 界内且不与 walls 重合；(b) 每个 boxes[i] 在界内、不与 walls 重合、boxes 内部两两不重合；(c) nextGrid.width/height/walls/goals 与 grid 恒等（静态地形单次移动不变）；(d) nextGrid.boxes.length === grid.boxes.length（守恒）；(e) nextGrid.player 不与 nextGrid.boxes 任何箱同格
    - 头注释：`// Feature: sokoban-mvp-2-push, Property 3: 网格不变式 + 箱子守恒（逐回合单次移动层）`
  - PROPERTY: **Property 4 推可走时前进**——fast-check 生成"人-箱-空"三联场景（前方有箱、箱后是地板或目标格且无箱、不越界），断言推箱后玩家 = 原玩家 + Δ、该箱 = 原箱 + Δ、其余 boxes 与静态地形不变
    - 头注释：`// Feature: sokoban-mvp-2-push, Property 4: 推可走时前进`
  - PROPERTY: **Property 5 推不动时都停**——三子情况：(i) 箱后越界、(ii) 箱后在 walls、(iii) 箱后在其他 boxes；每种断言玩家不动、boxes 集合不变、静态地形不变
    - 头注释：`// Feature: sokoban-mvp-2-push, Property 5: 推不动时都停`
  - PROPERTY: **Property 6 走路（前方无箱）规则在扩展 GridState 上仍成立**——前方无箱无墙不越界 → 玩家前进一格；前方越界 / 是墙 → 玩家不动；两种情况都断言 boxes 不变、静态地形不变
    - 头注释：`// Feature: sokoban-mvp-2-push, Property 6: 走路（前方无箱）规则在扩展 GridState 上仍成立`
  - EDGE_CASE: 并排两箱（人-箱-箱-空）→ 都停；边界向界外推 → 都停；地形字符不变；四方向均覆盖
  - 跑 `npm test -- move-with-push` 得真实通过输出后才勾选
  - _Requirements: R1.3, R1.4, R1.5, R1.6_
  - _Design: Property 3（单次移动层）, 4, 5, 6；Testing Strategy 测试映射表_

- [x] 5. 胜利判定纯块 `src/blocks/win-check.ts` + `win-check.test.ts`（Property 7）
  - 实现纯函数 `checkWin(grid): boolean` = ∀ b ∈ `grid.boxes`: ∃ g ∈ `grid.goals` with `g.x === b.x && g.y === b.y`（每个箱子坐标能在 goals 里找到匹配）
  - 在 `parseLevel` 已保证箱数=目标数前提下，该条件与"boxes 全集与 goals 全集在坐标上相等"等价（无需再算基数）
  - 包成纯 `BlockDef`：`name: "win-check"`；`inputSchema: Type.Object({ grid: GridStateSchema })`；`outputSchema: Type.Object({ won: Type.Boolean() })`
  - PROPERTY: **Property 7 胜利判定 = 所有箱子在目标格**——fast-check 生成 GridState（含 0=0 边界与非 0=0 场景），断言等价条件成立
    - 头注释：`// Feature: sokoban-mvp-2-push, Property 7: 胜利判定 = 所有箱子在目标格`
  - EXAMPLE: 全在目标 → true；差一个 → false；空 boxes（0=0 特例）→ true
  - 跑 `npm test -- win-check` 得真实通过输出后才勾选
  - _Requirements: R2.1_
  - _Design: §3 `win-check`；Property 7；返回 boolean 而非 GridState 的理由（win 是派生态）_

- [x] 6. 组合注册 + 装配流配置 + 驱动扩展（`src/blocks/register.ts` + `src/configs/push.jsonc` + `src/driver.ts`）
  - `src/blocks/register.ts` 新增 `createPushRegistry(): BlockRegistry`，注册 `move-with-push` + `win-check`；`createWalkRegistry`（MVP-1）保留不删（走路装配流回归）
  - `src/configs/push.jsonc` 新装配流两步：
    ```jsonc
    {
      "flowName": "sokoban-push",
      "steps": [
        { "block": "move-with-push", "inputMap": { "grid": "grid", "direction": "direction" } },
        { "block": "win-check",       "inputMap": { "grid": "nextGrid" } }
      ]
    }
    ```
    注释说明 `"grid": "nextGrid"` 是纯字段重命名（承接 step1 摊平出的 `context.nextGrid`）、未触及 Q-024；无条件分支 / 循环，守"配置图静态可枚举"红线
  - `src/driver.ts` 保留 `stepWalk`（MVP-1）；新增：
    ```ts
    export interface PushResult { readonly nextGrid: GridState; readonly won: boolean; }
    export function stepPush(config, registry, grid, direction): PushResult;
    // 内部：assemble(config, registry, { grid, direction })
    //       → { nextGrid: context.nextGrid, won: context.won }
    // assemble 失败（Ajv 拦下非法方向等）抛 Error；调用方保留旧状态由外围 try-catch 处理
    ```
  - _Requirements: R1.2, R1.6, R5.1_
  - _Design: §4 register.ts, §6 push.jsonc, §7 driver.ts；Architecture 数据流图_

- [x] 7. 转接件复用验证 + R/R 键旁路（`src/adapters/input-adapter.ts` + `tests/input-adapter.test.ts`）
  - `keyToDirection`（MVP-1）沿用一字不改——方向键 / WASD → up/down/left/right，其它 → null
  - `input-adapter.test.ts` 补充断言：`R` / `r` 返回 `null`（重开键**不走装配流**——重开 = "重装载关卡"，转接件不掺和；由 `main.ts` 侧独立分支承接）
  - 跑 `npm test -- input-adapter` 得真实通过输出后才勾选
  - _Requirements: R3.2_
  - _Design: §5 input-adapter；main.ts §9 R/r 重开分支旁路装配流_

- [x] 8. 关卡资产整理（`src/levels/`）
  - 重命名 `src/levels/level-1.txt` → `src/levels/level-walk-only.txt`
  - 把 `level-walk-only.txt` 中**所有 `.` 字符替换为空格**——新字符集下 `.` = 目标格（会误增 goals、破坏走路语义），空格 = 地板（与 MVP-1 中"`.` 与空格都是地板"完全等价）；替换后新 `parseLevel` 装出的 `GridState` 里 `goals = []`、`boxes = []`（因此 base parseLevel 契约允许 0=0 合法特例，见 Task 1）
  - 手写新关卡 `src/levels/level-push-1.txt`（Sokoban 字符集 `# . <space> @ $ * +`；尺寸够玩；**≥2 箱 + ≥2 目标 + 有解可通关**——由 Task 10 `main.ts` 装载后 `assertPublishableLevel` 硬守；具体地图布局手工调平衡，不做 PCG）
  - 同步 `tests/assemble-walk.test.ts` 中对旧文件名 `level-1.txt` 的引用（若有）；`walk.jsonc` 装配拓扑不动
  - _Requirements: R1.1, R2.4_
  - _Design: §11 关卡文件（拆两个独立文件不覆盖）；两层契约 = base parseLevel（允许 0=0）+ 发表关额外 assertPublishableLevel_

- [x] 9. 渲染扩展 + `index.html` 微改 + `render.test.ts`（Property 8）
  - `src/render.ts` 字符优先级表（同一格多态取上）：`+` > `@` > `*` > `$` > `.` > `#` > `' '`（空格）——具体见 design §8
  - 新签名：`render(grid: GridState, container: HTMLElement, opts?: { won?: boolean }): void`
  - 网格用 `<pre class="sokoban-grid">` 全量替换（`replaceChildren`，重渲染反映最新 grid + won、无残留）；`won === true` 时在 container 内追加独立 `<div class="sokoban-win">🎉 你赢了！按 R 重开</div>`；`won === false / undefined` 时不出现该元素
  - `render.ts` 头**不打 `@paradigm`**（渲染层不在 AFP"配置即图"承诺范围，见 afp-core.md 标记适用范围）
  - `index.html` 微改：
    - 标题 → "Sokoban MVP-2 · 推箱 + 胜利判定"
    - 说明栏加"把所有 `$` 推到 `.` 上（变成 `*`）即胜利"、"按 R 重开"
    - 新增 `.sokoban-win` 简朴 CSS（醒目色 + 大字，纯 CSS，够看清就行，不做美术资产）
  - `render.test.ts` 扩展：
    - PROPERTY: **Property 8 渲染字符优先级正确**——fast-check 生成合法 GridState（随机 player / boxes / goals / walls），断言 `<pre class="sokoban-grid">` 文本第 `y` 行第 `x` 列字符符合优先级表
      - 头注释：`// Feature: sokoban-mvp-2-push, Property 8: 渲染字符优先级正确`
    - EXAMPLE: `won === true` → `.sokoban-win` DOM 出现；`won === false / undefined` → 不出现；就位态 `$ → *` 前后对比 EDGE_CASE
  - 跑 `npm test -- render` 得真实通过输出后才勾选
  - _Requirements: R2.2, R3.1, R3.3, R4.1, R4.2, R4.3, R4.4_
  - _Design: §8 render.ts, §10 index.html；Property 8；胜利提示走独立 DOM 不塞网格的理由_

- [x] 10. 浏览器入口 `src/main.ts`（**打 `@paradigm NON-AFP: external-control-flow`** + 装载 + 门控 + 重开 + try-catch）
  - **文件头统一标记块**（含 `@reason` + `@afp-debt` 三字段齐；具体措辞照 design §9 抄）：
    ```ts
    /**
     * @paradigm NON-AFP: external-control-flow
     * @reason 回合门控（won → 拒绝方向键）、终局输入拦截、R/r 重开三条控制流是"跨回合的时间维度状态
     *         + 事件级条件分支"，用 AFP 数据流表达要么塞进配置的条件分支（违反"配置图静态可枚举"红线），
     *         要么把主循环推进引擎（违反 MVP-1 已钉的 K-LOOP 结论）。留浏览器 keydown 回调里是最简解。
     * @afp-debt 验证期结论：AFP 数据流不承担回合控制流是合理边界，非 AFP 在此处胜出。
     *          本 debt 不打算偿还——它是 D-013 目标的正面证据，将进 docs/paradigm-comparison.md。
     *          若门控扩到"暂停/多存档/回放"，需重评升级为 reducer / 状态机再重打标记。
     */
    ```
  - 修改 `main.ts` 顶部 `levelText` 的 `?raw` import：`./levels/level-1.txt?raw` → `./levels/level-push-1.txt?raw`（`pushConfigRaw` 同样从 `./configs/push.jsonc?raw` 新增 import，MVP-1 的 `walkConfigRaw` 保留不删也不再使用于 main.ts，可留作对照或按需清理）
  - 装载：`parseJsonc<FlowConfig>(pushConfigRaw)` → `createPushRegistry()` → `parseLevel(levelText)`（`levelText` 来自 `level-push-1.txt`）→ **`assertPublishableLevel(currentGrid)` fail-fast**（命中即抛 `Error`，页面不渲染，控制台可见）→ 初始 `render(currentGrid, container)`
  - `window.addEventListener("keydown", ...)`：
    - **R/r 重开分支**（绕开装配流；不是"下一回合"、是"重装载"）：`currentGrid = parseLevel(levelText)`；`won = false`；`render(currentGrid, container)`；`return`（重开走同一份 levelText，`assertPublishableLevel` 仅初始装载调一次，无需重复断言）
    - **胜利门控**：若 `won === true` 直接 `return`（R5.2：控制流留在浏览器侧、不进引擎）
    - `direction = keyToDirection(event.key)`；`null` 则 `return`；否则 `event.preventDefault()`
    - **`stepPush` 外围 try-catch**：失败（例如 Ajv 拦下非法 direction）→ `console.error("[sokoban] stepPush failed:", err)` + 保留旧 `currentGrid` / `won`、不整页崩
    - 更新 `currentGrid = result.nextGrid`；`won = result.won`；`render(currentGrid, container, { won })`
  - _Requirements: R1.2, R1.6, R2.2, R2.3, R2.4, R3.1, R3.2, R3.3, R5.2, R5.3_
  - _Design: §9 main.ts（含 `@paradigm` 的判据依 afp-core.md）_

- [x] 11. 属性测试补齐 + 端到端 + 通关门控测试（一批测试文件，用一个任务扎口收）
  - `tests/determinism.test.ts` 改（**Property 2 一回合确定性 + 块无残留状态**）：三段——(a) 同 `(grid, direction)` 跑两遍 `stepPush`，两次 `(nextGrid, won)` 逐项相等；(b) **交叉输入**：`stepPush(cfg, reg, gridA, d)` → 保存 → 中间穿插 `stepPush(cfg, reg, gridB, d)` → 再次 `stepPush(cfg, reg, gridA, d)`，前后两次 gridA 的结果恒等（块无跨回合记忆，方案 A 纯性）；(c) 无时钟 / 无随机 / 无 AI——上述在任意机器 / 时间点跑均成立
    - 头注释：`// Feature: sokoban-mvp-2-push, Property 2: 一回合确定性 + 块无残留状态（方案 A 纯性）`
  - `tests/invariants.test.ts` 改（**Property 3 网格不变式 + 箱子守恒（方向序列层）**）：fast-check 随机方向序列下，每回合后聚合断言——玩家在 `[0,width)×[0,height)` 界内且不与 walls 坐标重合；每个 `boxes[i]` 在界内、不与 walls 重合、boxes 内部两两不重合；`nextGrid.width/height/walls/goals` 与 `grid` 恒等（静态地形跨回合不变）；`nextGrid.boxes.length === grid.boxes.length`（守恒：既不创造也不毁灭）；`nextGrid.player` 不与 `nextGrid.boxes` 任何箱同格（与 Task 4 单次移动层双层覆盖，各守各的层）
    - 头注释：`// Feature: sokoban-mvp-2-push, Property 3: 网格不变式 + 箱子守恒（方向序列层）`
  - `tests/assemble-push.test.ts` 新（**EXAMPLE 端到端**）：装配 `push.jsonc` + `createPushRegistry`；组织一份小地图（例如两箱两目标 + 直线通道）；完整方向序列驱动 `stepPush` 一步步走到 won=true；每步断言 `result.nextGrid` 与 `result.won` 符合预期（AC 1.2 在引擎上贯通）
    - 头注释：`// Feature: sokoban-mvp-2-push, EXAMPLE: assemble-push 端到端（含通关一步）`
  - `tests/win-lockout.test.ts` 新（**jsdom EXAMPLE**）：装配 main.ts 一样的小图；程序化派发 `keydown` 事件驱动至 won=true；断言：(i) won 后再派发方向键 → 不触发装配流（`currentGrid` 与 `won` 不变、DOM 不变）；(ii) 派发 `R` 键 → `parseLevel(levelText)` 重装载、`won` 复位为 false、方向键再度生效（AC 2.3 + R2.4 重置分支）
    - 头注释：`// Feature: sokoban-mvp-2-push, EXAMPLE: win-lockout（AC 2.3 通关后门控 + R 重开）`
  - 跑 `npm test -- determinism invariants assemble-push win-lockout` 得真实通过输出后才勾选
  - _Requirements: R1.2, R1.3, R1.4, R1.6, R2.1, R2.3, R2.4, R3.2, R3.3_
  - _Design: Property 2, 3；assemble-push.test.ts；win-lockout.test.ts；Testing Strategy 测试映射表_

- [x] 12. 门禁三项之一二（typecheck + 全量测试 gate；铁律 1 verify-first）
  - `npm run typecheck` 得 0 错——真实工具输出（vitest 经 esbuild 剥类型不做完整类型检查，`tsc --noEmit` 必须单独跑）
  - `npm test` 全绿——真实工具输出，覆盖 12 份测试文件：`parse-level` / `move-with-push` / `win-check` / `determinism` / `invariants` / `render` / `assemble-push` / `win-lockout` / `assemble-walk`（回归）/ `move-step`（回归）/ `input-adapter` / `jsonc`；Property 1-8 PBT + Property 9 EXAMPLE 齐
  - fast-check 反例出现 → **修实现**（不改测绕过），重跑至真绿；反例本身即验证材料
  - typecheck 或 test 未真绿 → 不勾选本任务，也不进入下游 Task 13/14
  - _Requirements: R 全量_
  - _Design: `test-and-acceptance.md` 门禁三项之 1+2；status-sync 铁律 1_

- [x] 13. SMOKE：`@paradigm` grep 校验（AC 5.3 / 5.4 正面证据）
  - 跑一次 grep 扫描（Windows PowerShell：`Get-ChildItem -Path experiments/exp06-sokoban -Recurse -File -Include *.ts,*.tsx,*.js,*.jsx,*.html,*.jsonc,*.json,*.md -Exclude *.d.ts | Where-Object { $_.FullName -notmatch "\\node_modules\\|\\dist\\|\\assets\\" } | Select-String -Pattern "@paradigm"`（Select-String 无 -Recurse 参数，用 Get-ChildItem -Recurse 递归喂管道；扫 src/ + index.html + vite.config.ts + REPORT.md 等，排除 node_modules / dist / 截图 assets 目录）；\*nix：`grep -Rn --include='*.ts' --include='*.tsx' --include='*.js' --include='*.html' --include='*.jsonc' --include='*.json' --include='*.md' --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=assets "@paradigm" experiments/exp06-sokoban/`）
  - **期望命中数与位置**：
    - `experiments/exp06-sokoban/src/main.ts` → **恰 1 处**命中（`NON-AFP: external-control-flow` + `@reason` + `@afp-debt` 三字段齐）
    - `experiments/exp06-sokoban/src/blocks/**` → 0 命中
    - `experiments/exp06-sokoban/src/configs/**` → 0 命中
    - `experiments/exp06-sokoban/src/adapters/**` → 0 命中
    - `experiments/exp06-sokoban/src/grid.ts` → 0 命中
    - `experiments/exp06-sokoban/src/driver.ts` → 0 命中
    - `experiments/exp06-sokoban/src/render.ts` → 0 命中（渲染不在 AFP 承诺范围）
    - `experiments/exp06-sokoban/index.html` → 0 命中（现在真的被扫）
    - `experiments/exp06-sokoban/vite.config.ts` → 0 命中（现在真的被扫）
    - `experiments/exp06-sokoban/REPORT.md` → **允许命中**（Task 15 的 REPORT 追加段会**引用**"src/main.ts 有 `@paradigm NON-AFP: external-control-flow`"作为正面证据素材文本；命中的是文档里的字符串，不是代码里的标记；grep 输出应能人肉甄别是"代码标记"还是"文档引用"——若混淆则改为把代码扫描与文档扫描分两次跑，推荐 `experiments/exp06-sokoban/src` + `experiments/exp06-sokoban/index.html` + `experiments/exp06-sokoban/vite.config.ts` 为一次；REPORT.md 单独跑）
  - 命中数或位置与预期不符 → 追根究底（多打？漏字段？位置错？误删？）并如实写进 REPORT.md 追加段；不为对齐预期反手删标记
  - 结果（命中列表 + 计数）作为 Task 15 REPORT 追加段的正面证据素材保留（"AFP 数据流不承担回合控制流是合理边界、非 AFP 在此处胜出"）
  - _Requirements: R5.3, R5.4_
  - _Design: §9 main.ts + Testing Strategy · AC 5.3/5.4 SMOKE_

- [x] 14. 门禁三项之三（真人浏览器验收 · `npm run dev`；铁律 1 verify-first）
  - Plucker518 手动跑 `npm run dev`（AI 不启长驻服务）——起 dev server 后在浏览器打开
  - 完整验收路径（**每步都要在画面上肉眼可见、非仅控制台**）：
    1. 加载后画面看到 `#` 墙 / 空格地板 / `.` 目标格 / `@` 玩家 / `$` 箱子（R3.1、R4.1）
    2. 方向键 / WASD 走路——角色移动当场可见（R3.2、R3.3）
    3. 推箱——把箱子推到地板：`$` 位置更新；把箱子推到目标格：显示 `*`（就位态区分 R4.2）
    4. 全部箱子推到目标格 → 出现 `.sokoban-win` 胜利提示 DOM（R2.2、R4.3）
    5. **通关后再按方向键 → 无反应**（AC 2.3 胜利门控）
    6. 按 R → 重开、`won` 复位、初始网格再次呈现（R2.3 重置分支）
    7. 再玩一遍走通——验证 R 重开与门控解锁真的对称成立
  - 录截图 / 动图作可玩佐证；佐证文件放 `experiments/exp06-sokoban/assets/`（就近）；REPORT.md 追加段引用
  - 任一步不达 → 不勾选，回退到相关任务（如"看不到胜利提示 → 回 Task 9 render.ts 或 Task 10 main.ts 排查"）
  - _Requirements: R2.2, R2.3, R2.4, R3.1, R3.2, R3.3, R3.4, R4.3_
  - _Design: `test-and-acceptance.md` 门禁三项之 3（端到端入口跑一次）；status-sync 铁律 1（浏览器可玩断言需同轮真实运行佐证）_

- [x] 15. `REPORT.md` 追加 MVP-2 段
  - MVP-1 REPORT 保留不动，末尾追加"MVP-2 段"，含以下小节：
    - **真人浏览器验收记录**：Task 14 截图 / 动图 + 通关方向序列文字样例
    - **装配流两步运行轨迹样例**：一份 `initialInput { grid, direction }` → step1 `move-with-push` 输出 `nextGrid` → step2 `win-check` 输出 `won` 的 context 变化文字轨迹（回应 R1.2 与 R1.6 在引擎上贯通）
    - **方案 A 复审再观察**（MVP-1 REPORT 建立的三观察点在 boxes/goals 加入后重跑一遍）：体量——`initialInput` 紧凑 JSON 字符数实测 + 相对 MVP-1 ~800 字符对比；可读性——`push.jsonc` 两条 inputMap 是否仍一望即知；AI 推测——照此 pattern 产新关卡（MVP-3 场景）是否增加出错风险（推测、不下结论）；据实测**如实**写"沿用 A"或"触发复审"（若触发按 exp04 REPORT 预置方案 C 出口评估，本 MVP 不预造）
    - **`@paradigm` grep 结果**（Task 13 输出）：命中列表 + 计数；预期"恰 1 处命中 `src/main.ts`、业务/装配层零命中"是否成立；成立即作为 D-014 `docs/paradigm-comparison.md` 的正面证据素材保留；不成立就如实写不成立原因
    - **引擎缺口 / 非 AFP 范式如实记录**：实现期若额外冒出未预见的非 AFP 范式（例如门控被迫升级为 reducer / 状态机）→ 改标 `@paradigm NON-AFP: state-machine` 并在此说明触发条件；引擎缺口登记到 `docs/open-questions.md`（不为收尾强行圆满）
    - **发表前 checklist 打钩状态**（Task 16 走查结果的引用；不复制条目——正本在 roadmap D-014）
  - _Requirements: 交付物；R5.3_
  - _Design: §12 REPORT.md 追加段_

- [x] 16. 发表前 checklist 走查（roadmap D-014，退出条件；只引用不复制）
  - 打开 `docs/paradigm-validation-sokoban-roadmap.md` D-014 "发表前 checklist"，逐项走过一遍
  - **只引用不复制**——checklist 条目正本在 roadmap（SSOT · 铁律 2），不抄条目进 REPORT / tasks / state.json；REPORT 追加段的"发表前 checklist 打钩状态"小节只记状态（✅/❌/N/A 三档 + 一句备注），条目名以 roadmap 为准
  - 覆盖三栏：**工程**（真人验收 + 本地能跑起来 + 动图/截图 + 同轮真实测试输出）、**对外门面**（根 README + LICENSE + CONTRIBUTING + good-first-issue 拆分 + 首发平台）、**文章**：`docs/paradigm-comparison.md` **必须至少有骨架落地**（章节标题 + MVP-2 的 `@paradigm` 恰 1 处正面证据点已录入 + Godot 词汇借用/拒绝的对比条目占位）。**不接受 `N/A 待发布节奏`**——本 MVP 是发表闸口，"文章 = 以后再说"就把发表口径弱化了；发布节奏调整的只能是"文章的完整版"，骨架 + 首要证据点是发表前置。骨架未落地 → 回退到本任务补齐骨架，不算 MVP-2 交付完成
  - **任一项未达** → 回退到相关任务补齐；如"截图/动图未录 → 回 Task 14 补录"、"@paradigm 数量位置不对 → 回 Task 10 修 main.ts 头或 Task 13 重扫"；未达就不算 MVP-2 交付完成
  - _Requirements: 发表闸口退出条件（需求 Introduction + 交付物 · 路线图 D-014）_
  - _Design: §12 REPORT.md 发表前 checklist；SSOT 纪律_

- [x] 17. SSOT 同步 + git status 快照（收尾）
  - `docs/ai/state.json`：更新 `exp06-sokoban` MVP-2 状态、结论摘要、`updatedAt`；`nextSteps` 依 Task 16 checklist 结果指向 MVP-3 或对外发布节奏；只改变动字段，不重写全文
  - `docs/open-questions.md`：**Q-028 保持 `open` 状态**——MVP-2 只推进它的判据 3 部分证据积累（`@paradigm` 恰 1 处 + 业务/装配层零命中、方案 A 复审仍沿用 A），判据 1、2 必须等 MVP-3 / MVP-4 才有可能触及。Q-028 至少要 MVP-4 收尾才可能进入 resolved 候选，本 MVP 收尾即宣 resolved = 结论超前。**只**更新 Q-028 的进度描述与"关联既有缺口"块（追加 MVP-2 的证据引用），不改状态、不写 `resolution`；如实登记本 MVP 未预见的引擎缺口则用 `in_progress` 或新增 `open` 缺口，不预设结局
  - 跑 `git status` 得当轮真实输出（status-sync 铁律 1）——反映本 MVP 落地的所有文件变动（`grid.ts` / `blocks/` / `configs/` / `driver.ts` / `render.ts` / `main.ts` / `index.html` / `levels/` / `tests/` / `REPORT.md`）
  - 按 `.kiro/steering/git-workflow.md`：**AI 默认不自动 commit**；提醒 Plucker518 可以提交并附建议指令（中文提交信息，PowerShell 兼容 `;` 分隔）：
    ```powershell
    git add -A
    git commit -m "sokoban MVP-2: 推箱 + 胜利判定 + 发表闸口硬约束（exp06-sokoban）"
    ```
  - _Requirements: SSOT 纪律；status-sync 铁律 1 + 2；git-workflow_

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1", "7", "8"], "description": "grid.ts 扩展 + adapter 复用验证 + 关卡资产整理；关卡资产是纯数据、不依赖任何代码，与 Task 1/7 完全独立" },
    { "wave": 2, "tasks": ["2", "3", "5", "9"], "description": "parse-level.test / move-with-push 块 / win-check 块+测试 / render 扩展+测试——都仅依赖 Task 1 的 GridState & schema，可并行；Property 9 正例的 level-push-1.txt 已在 Wave 1 产出" },
    { "wave": 3, "tasks": ["4", "6"], "description": "move-with-push.test 依赖块 3；register+push.jsonc+driver 依赖块 3 与 5" },
    { "wave": 4, "tasks": ["10"], "description": "main.ts 依赖 driver（6）+ 关卡（8）+ render（9）+ assertPublishableLevel（1）" },
    { "wave": 5, "tasks": ["11"], "description": "属性 + 端到端 + jsdom 测试补齐；win-lockout 依赖 main.ts，其余依赖 driver" },
    { "wave": 6, "tasks": ["12"], "description": "typecheck + 全量测试 gate（依赖所有代码与测试就位）" },
    { "wave": 7, "tasks": ["13", "14"], "description": "@paradigm grep SMOKE 与真人浏览器验收，gate 绿后并行" },
    { "wave": 8, "tasks": ["15"], "description": "REPORT.md 追加 MVP-2 段（依赖 13 grep 结果 + 14 浏览器佐证）" },
    { "wave": 9, "tasks": ["16"], "description": "发表前 checklist 走查（依赖 REPORT 已写）" },
    { "wave": 10, "tasks": ["17"], "description": "SSOT 同步 + git status 快照收尾" }
  ]
}
```

- Task 1（grid.ts）是所有代码任务的前置；Task 7（adapter）与 Task 8（关卡资产 = 纯数据、不依赖任何代码）无强依赖、并入 Wave 1（这也让 Task 2 的 Property 9 正例装载能在 Wave 2 拿到 `level-push-1.txt`，避免同波并行竞态）。
- Wave 2 四项都只依赖 Task 1，可并行——最能吃到多任务调度的一层。
- Wave 3 的 Task 4 与 Task 6 依赖各自的块（3、5），可并行。
- Wave 4 → 5 → 6 严格串行（main.ts → 测试补齐 → gate）。
- Wave 7 的 grep SMOKE（13）与真人验收（14）都在 gate 绿后运行、彼此独立。
- Wave 8 → 9 → 10 是收尾串行链，任何一项失败都回退到对应上游任务。

## Notes

- **status-sync 铁律 1（verify-first）贯穿全表**：Task 12（typecheck + 全量测试）、Task 13（grep 计数）、Task 14（浏览器可玩）、Task 17（git status）四处必须有同轮真实工具输出，任何一处凭记忆勾选即无效。
- **test-and-acceptance 三项门禁**在 Task 12 + Task 14 两个任务里齐备：typecheck 0 错 + 相关测试全绿 + 端到端入口跑一次（本 MVP 的端到端入口 = 浏览器实跑）。
- **PBT 追溯注释**（`// Feature: sokoban-mvp-2-push, Property N: <title>`）在每份属性测试文件头必写；Property 9 走 EXAMPLE 级（正例 + 三反例），不用 fast-check 全称量化——这是 design 的显式决定，别自作主张改 PBT。
- **`@paradigm` 只允许 1 处**且必须在 `src/main.ts`（Task 10 打、Task 13 grep 守）；业务 / 装配层零标记是 D-014 `docs/paradigm-comparison.md` 的正面证据材料，别为图省事把 `@paradigm` 塞进 driver 或 block。
- **发表前 checklist 只引用不复制**（SSOT · 铁律 2）：条目正本在 `docs/paradigm-validation-sokoban-roadmap.md` D-014；REPORT 追加段与 tasks 只记引用与勾选状态，不搬条目文本——搬条目就漂移。
- **失败结论与成立结论同价**：fast-check 反例出现 → 修实现，不改测绕过；引擎缺口 / 未预见的非 AFP 范式 → 如实登记 `docs/open-questions.md` 与 REPORT，不圆满收尾。
- **本表所有子任务都是必做**（无 `*` 可选标记）：MVP-2 是对外发表闸口，每份测试与每道门禁都是发表前置，不是"MVP-only 加速跳过"的候选。
- **`walk.jsonc` / `move-step.ts` / `stepWalk` / `createWalkRegistry` 全部保留**（MVP-1 走路对照资产）——它们是"新块 vs 旧块"块发现结论的物证，也是 assemble-walk 回归的锚点，别顺手删。
- **Wave 1-3 期间 `main.ts` 处于导入路径瞬时失效状态**：Task 8（Wave 1）rename `level-1.txt → level-walk-only.txt` 完成后，`main.ts:36` 的 `import levelText from "./levels/level-1.txt?raw"` 会指向不存在的文件；Task 10（Wave 4）会把 import 切到 `level-push-1.txt` 修复该状态。此期间**不必启动 `npm run dev`**（Vite 会 404）；Wave 2/3 的单元测试不触达 main.ts，Task 12（Wave 6）的 typecheck 在 Task 10 之后跑，均不受影响。若必须在中间波次起 dev server 排查其它问题，临时把 main.ts 的 import 手工指到 `level-walk-only.txt`（Task 10 会重新覆盖为 `level-push-1.txt`）。
