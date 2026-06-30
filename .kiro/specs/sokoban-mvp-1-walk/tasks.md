# Implementation Plan

> Spec: sokoban-mvp-1-walk · Tasks
> 需求见 `requirements.md`，设计见 `design.md`。落地目录 `experiments/exp06-sokoban/`（MVP-1 部分）。

## Overview

把 MVP-1 设计落地为可玩实验：网格数据与解析 → 走路纯块 → 配置 → 转接件 → 走路驱动 → 渲染 → 浏览器主循环 → 测试 → K-LOOP/穿透观察报告。
纪律：每个"完成"勾选前必须有同轮真实工具输出（typecheck / vitest / 浏览器实跑佐证）——见 `.kiro/steering/status-sync.md`。业务逻辑层走纯 AFP（方案 A），不引入非 AFP 范式；渲染/脚手架不打 `@paradigm` 标记。

## Tasks

- [x] 1. 搭实验骨架（package.json / tsconfig / Vite，沿用 exp01 约定 + 浏览器入口）
  - 在 `experiments/exp06-sokoban/` 建 `package.json`（scripts: typecheck / test / dev / preview；deps: @sinclair/typebox + ajv；devDeps: vitest + tsx + typescript + @types/node + fast-check + vite + jsdom）
  - 建 `tsconfig.json`（对齐 exp01：ESM、strict）、`vite.config.ts`（最简）、`index.html`（挂载点 + 引 `src/main.ts`）
  - 跑 `npm install` 确认依赖就位
  - _Requirements: 2.1_

- [x] 2. 实现网格数据与解析 `src/grid.ts`
  - 定义 `Position`、`GridState`（width/height/`walls: Position[]`/player）、`Direction`
  - `walls` 用 `Position[]`（纯 JSON 数据，全量穿透下可见可审——见 design 未决问题）
  - 实现 `parseLevel(ascii)`：`#`→walls、`@`→player、`.`/空格→地板；畸形输入（无 `@`/多 `@`）**抛 `Error`**
  - 导出 TypeBox schema：`PositionSchema` / `GridStateSchema` / `DirectionSchema`
  - 纯函数：不读时钟 / 不用随机 / 不调 AI
  - _Requirements: 1.1_

- [x] 3. 解析测试 `tests/parse-level.test.ts`
  - 给定 ASCII 关卡，断言 `walls` 集合、`player` 坐标、宽高正确（Property 4）
  - 畸形输入（无 `@`、多 `@`）断言抛 `Error`
  - 跑 `npm test` 得真实通过输出后才勾选
  - _Requirements: 1.1_

- [x] 4. 实现走路纯块 `src/blocks/move-step.ts`
  - 实现纯函数 `move(grid, direction)`：目标格=player+delta；越界或命中 walls→停原格、否则→移动；静态地形原样带出
  - 撞墙/越界输出值确定且每次一致（测试用值等 `toEqual`，不强制新对象/复用）
  - 包成纯 `BlockDef`（name: "move-step"，入 {grid,direction}、出 {nextGrid}），导出 `createWalkRegistry()`
  - 沿用 exp01 的跨包深路径 import（`../../../../engine/src/index.js`）
  - _Requirements: 1.3, 1.4, 1.5, 4.1_

- [x] 5. 走路块测试（确定性 + 碰撞 + 不变式）
  - `tests/move-step.test.ts`：四方向移动、撞墙不动、出界不动、连续移动（Property 2）
  - `tests/determinism.test.ts`：fast-check 随机关卡+方向序列跑两遍逐项相等（Property 1）
  - `tests/invariants.test.ts`：随机方向序列下，每回合后 player 在界内、不在墙上、静态地形不变（Property 3）
  - 跑 `npm test` 得真实通过输出后才勾选
  - _Requirements: 1.3, 1.4, 1.5_

- [x] 6. 配置 `src/configs/walk.jsonc`（方案 A，状态显式接线）
  - step 引用 move-step，inputMap `{grid:"grid", direction:"direction"}`（grid 在配置里可见 = 方案 A）
  - 注释说明 `"grid":"grid"` 这行接线是"全量状态穿透可读性"的观察材料
  - _Requirements: 1.6, 4.1_

- [x] 7. 输入转接件 `src/adapters/input-adapter.ts`（防腐层）
  - 实现 `keyToDirection(key)`：方向键/WASD → up/down/left/right，其它 → null
  - `tests/input-adapter.test.ts`：各方向键与无关键的映射（Property 6）
  - _Requirements: 1.2_

- [x] 8. 走路驱动 `src/driver.ts`（纯 AFP，调用方持 grid）
  - 实现 `stepWalk(config, registry, grid, direction): GridState`：构造 initialInput `{grid, direction}` → `assemble` → 取 `context.nextGrid`
  - assemble 失败时抛异常（非法方向被 Ajv 在 execute 前拦下，调用方保留旧 grid、状态不前进）
  - `tests/assemble-walk.test.ts`：端到端断言 `assemble` 成功且 `context.nextGrid` 正确；验证方案 A 块保持纯（复用同块跨多回合，行为只依赖当回合输入，Property 5）
  - _Requirements: 1.2, 1.6_

- [x] 9. 渲染 `src/render.ts`（非 AFP，**不打 @paradigm**）
  - 实现 `render(grid, container)`：把 GridState 画成 DOM 文本网格（# 墙 / . 地板 / @ 角色），够清楚就行、无美术
  - 只画墙/地板/角色，预留扩展但不提前抽象（箱子/目标点留 MVP-2）
  - `tests/render.test.ts`（jsdom）：渲染后 DOM 中角色/墙位置正确；移动一回合后重渲染体现位移（Property 7）
  - _Requirements: 2.1, 2.3, 2.4_

- [x] 10. 浏览器主循环 `src/main.ts` + `levels/level-1.txt`（脚手架，**不打 @paradigm**）
  - 写单关 ASCII `src/levels/level-1.txt`（# 墙 / . 地板 / @ 角色，含可走通道）
  - `main.ts`：装载关卡（`parseLevel`）→ 渲染初始网格 → 绑定 `keydown` → 每次按键经 `keyToDirection` 转方向、调 `stepWalk`、更新 `currentGrid`、重渲染（外部主循环 = K-LOOP 选型落地）
  - _Requirements: 1.2, 2.1, 2.2, 2.4_

- [x] 11. 全量校验门禁 + 浏览器实跑佐证
  - 跑 `npm run typecheck` 得 0 错
  - 跑 `npm test` 全绿
  - 人工跑 `npm run dev`，在浏览器里用方向键走路、撞墙、确认角色移动当场可见；留截图/录屏作可玩佐证（status-sync：可玩断言需同轮真实运行佐证）
  - 三项齐了才进下一步
  - _Requirements: 2.1, 2.2, 2.4_

- [x] 12. 报告 `REPORT.md`（K-LOOP 结论 + 穿透观察）
  - K-LOOP（R3）结论：选"外部主循环"及理由；**如实记录**引擎当前无一等 loop step、回合制下无需引入
  - 全量状态穿透观察（三个具体观察点）：体量（一回合 initialInput JSON 大致多长）、可读性（`"grid":"grid"` 接线在网格规模下是否仍表意清晰）、AI 推测（照此 pattern 产新关卡配置是否增加出错风险，推测不下结论）
  - 是否触发方案 A 复审（呼应 exp04 REPORT 遗留）：据观察如实写"沿用 A"还是"需复审"
  - 记录实现期暴露的引擎缺口或不得不引入的非 AFP 范式（若有），登记到 `docs/open-questions.md`
  - _Requirements: 3.1, 3.2, 4.2_

- [x] 13. 同步状态文档（SSOT）
  - 更新 `docs/ai/state.json`：exp06-sokoban MVP-1 状态、结论摘要、updatedAt；MVP-1 完成则 nextSteps 指向 MVP-2
  - 更新 `docs/open-questions.md`：据 REPORT 证据**如实**更新 Q-027（K-LOOP）——可 `in_progress` 或 `resolved`（resolution/evidence/resolvedAt 齐全）；不预设结局
  - 只改变动字段，不重写全文
  - _Requirements: 3.1_

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1"], "description": "实验骨架（含 Vite/index.html），所有任务前置" },
    { "wave": 2, "tasks": ["2"], "description": "网格数据与解析（依赖 1）" },
    { "wave": 3, "tasks": ["3", "4", "7"], "description": "解析测试 / 走路块 / 转接件可并行（均依赖 2）" },
    { "wave": 4, "tasks": ["5", "6"], "description": "走路块测试与配置可并行（依赖 4）" },
    { "wave": 5, "tasks": ["8"], "description": "走路驱动 + 端到端（依赖 5、6、7）" },
    { "wave": 6, "tasks": ["9"], "description": "渲染（依赖 2；可与 8 并行，列后为稳妥）" },
    { "wave": 7, "tasks": ["10"], "description": "浏览器主循环（依赖 8、9）" },
    { "wave": 8, "tasks": ["11"], "description": "全量校验门禁 + 浏览器实跑佐证（依赖 10）" },
    { "wave": 9, "tasks": ["12"], "description": "报告（依赖 11）" },
    { "wave": 10, "tasks": ["13"], "description": "同步状态文档（依赖 12）" }
  ]
}
```

- Task 1 是所有任务前置。
- Task 3 / 4 / 7 都依赖 Task 2，可并行；Task 5 / 6 依赖 Task 4，可并行。
- Task 8 依赖 5、6、7；Task 10 依赖 8（驱动）与 9（渲染）。
- Task 11→12→13 严格串行收尾。

## Notes

- 全程不改引擎核心；走路在实验层搭（见 design.md Architecture）。引擎无 loop step 是 Q-027 的结论材料，不为此改引擎。
- 业务逻辑层是纯 AFP（方案 A），无非 AFP 范式、无需 `@paradigm` 标记；渲染 `render.ts`、主循环 `main.ts`、Vite 脚手架按 afp-core.md 判据不打标记。
- `walls` 用 `Position[]`（纯 JSON、全量穿透下可见可审），不用 `Set`（序列化会塌成 `{}`）。
- 任何"通过/跑通/可玩"断言必须有同轮真实 `npm test` / `npm run typecheck` / 浏览器实跑佐证，否则不勾选（status-sync 铁律 1）。
- 失败结论与成立结论同等有价值，REPORT 如实记录暴露的缺口与不得不引入的非 AFP 范式。
