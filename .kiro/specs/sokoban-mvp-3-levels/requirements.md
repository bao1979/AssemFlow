# Requirements Document

> Spec: sokoban-mvp-3-levels · MVP-3 of the Sokoban paradigm-validation chain.
> 全局共识、术语、Godot 参照、范式标记约定见 `docs/paradigm-validation-sokoban-roadmap.md`。

## Introduction

Sokoban 范式验证链的第 3 站，对应 `open-questions.md` 的 **Q-028**——验证 AFP "AI 产配置 / 引擎确定执行"在游戏场景下成立的核心环节。

目标是让"加新关卡"只需产出一份纯 ASCII 数据，引擎无需改代码即可加载；并且读者能在浏览器中亲眼玩到全部合法关卡（不只是路线图承诺，而是可感知的证据）。

**精简版决定**（发表后决定，见路线图 D-014）：
- **关卡集从 5 关压缩到 3 关**（一大一小一畸形）——3 关足以证明"稳定重复而非碰巧加一次"；再多的关卡是打磨性质、不再产生新证据。
- **主要工程价值转向"独立静态校验工具"（`check`）**——引擎作为"配置的 CAD 工具 + 编译器"的能力兑现：在不装载运行、不启动浏览器的前提下、就能对一份关卡数据判定合法性并给出足以定位问题的错误信息。

MVP-2 已经证明过一次"加一份 ASCII → `parseLevel` → `assertPublishableLevel` 装载即用"；MVP-3 的增量价值是把这个动作**稳定重复**在多关，并把**校验能力从"装载期"扩展到"装载前"**。

### 两层校验体系（承接 MVP-2、扩展到 MVP-3）

本 MVP 明确 Sokoban 关卡的两层校验分工，避免与 MVP-2 已有分层冲突：

| 层 | 范围 | 内容 | 何时跑 |
| :--- | :--- | :--- | :--- |
| **base 静态 check** | 所有关卡都要过 | 恰一玩家、箱数=目标数（含 0=0 合法特例）、边界闭合、字符集合法 | 本 MVP 新增·装载前 |
| **publishability gate** | 仅发表关额外要过 | ≥2 箱 / ≥2 目标 / 开局非通关 | MVP-2 已实现·装载后 |

- 普通关（如走路对照资产 `level-walk-only.txt`）只需过 base check
- 发表关（如 `level-push-1.txt`）需过 base check + publishability gate

**前置**：MVP-2（sokoban-mvp-2-push）的完整单关推箱子玩法。

## Glossary

完整术语见 `docs/paradigm-validation-sokoban-roadmap.md` 的 Glossary。本 MVP 关键词：

- **关卡（Level）**：一份描述初始网格状态的纯数据（ASCII）。
- **base 静态 check**（本 MVP 新增）：不运行游戏、不装载 `parseLevel` 时对关卡数据合法性的分析——引擎作为"配置的 CAD 工具"的能力兑现。区别于 MVP-2 已实现的**装载期校验**（`parseLevel` 内部会拦部分错，`assertPublishableLevel` 是发表关额外硬约束）。
- **publishability gate**：MVP-2 已实现的发表关额外硬约束（≥2 箱 / ≥2 目标 / 开局非通关）。本 MVP **不改动**其定义，只在两层体系中定位它的位置。

## Requirements

### Requirement 1: ASCII 关卡数据驱动 + 关卡切换（3 关稳定重复）

**User Story:** 作为 AI agent 或人类设计者，我希望"加新关卡"只需产出一份纯 ASCII 数据、引擎无需改代码即可加载；这个动作在多关上稳定成立（不是碰巧加一次）；且读者能在浏览器中亲眼玩到全部合法关卡。

#### Acceptance Criteria

1. WHEN 关卡用 Sokoban ASCII 字符表示（`#` 墙、`.` 目标、`@` 玩家、`$` 箱子、`*` 箱子在目标上、`+` 玩家在目标上、空格地板） THEN 系统 SHALL 能直接加载该 ASCII 为可玩状态。

2. WHEN 项目提供一个含 **3 关**的关卡集 THEN 覆盖以下三类：
   - 一份**大关卡**（正例）：地图较大、箱子较多，展示复杂度上的稳定重复
   - 一份**小关卡**（正例）：地图较小、快速展示解法，用于教学
   - 一份**故意畸形关卡**（负例）：**违反只有 base 静态 check 才能抓到的规则**——具体为"边界不闭合"或"含非法字符"（MVP-2 `parseLevel` 目前对这两类是宽松处理，不会报错；因此畸形关必须命中这一层才能证明 MVP-3 新增了实质检测能力，而不是重复 MVP-2 已有的检查）
   AND 合法的 2 关 SHALL 能正常加载并可通关；畸形关 SHALL 被 base 静态 check 拦下并给出错误信息。

3. WHEN 一份关卡数据 THEN 加载游玩的前置条件按**入口所属类型**分层判定：
   - **普通入口**（如走路对照资产、大 / 小关卡）：只需通过 **base 静态 check** 即可加载游玩
   - **发表关入口**（如 `level-push-1.txt`）：需同时通过 **base 静态 check** AND MVP-2 已实现的 **publishability gate**
   系统 SHALL 无需修改任何代码，仅数据层变化即可添加或切换关卡。

4. WHEN 关卡集增 / 删 / 改某关 THEN 引擎代码、装配块、转接件 SHALL 全部不变；仅数据层变化。

5. WHEN MVP-3 交付 THEN 浏览器 demo SHALL 能**切换并游玩全部合法关卡**（不含畸形关；畸形关只走 base check 工具报错的验收路径，不作为浏览器可玩内容）。切换方式采用**最简可行形式**（如 URL 查询参数、下拉选择器、快捷键循环——具体形态留 Design 阶段决定），**不做菜单页 / 关卡预览 / 美术资产设计**。

### Requirement 2: 独立静态校验工具（base check）

**User Story:** 作为设计者（或未来的 AI agent），我希望在不装载运行、不启动浏览器时就能判定一份关卡数据是否合法，并得到足以定位问题的错误信息，用于快速迭代关卡设计。

#### Acceptance Criteria

1. WHEN 存在一份关卡 ASCII 数据（文件或字符串） THEN 独立的 base 静态校验工具 SHALL 在**不装载运行、不启动浏览器**的前提下判定该关卡是否合法。

2. WHEN base 静态校验工具执行 THEN 它 SHALL 检查以下规则：
   - **恰好一个玩家**（`@` 或 `+` 之一，且总数为 1）
   - **箱子数**（`$` + `*`）等于**目标数**（`.` + `*` + `+`），允许 0=0 特例
   - **边界闭合**（外圈墙形成封闭区域，玩家 / 箱子不会"泄漏"到界外）——这是 MVP-2 `parseLevel` 目前不检查、MVP-3 独有的能力
   - **字符集合法**（仅允许 `# . @ $ * +` 空格；出现其它字符即报错）——同样是 MVP-3 独有的严格能力

3. WHEN base 静态校验失败 THEN 系统 SHALL 给出**足以定位问题**的错误信息——**最好精确到行 / 列 / 规则名**；若某类规则（如边界闭合）在物理上无法精确到单一坐标，THEN 给出**最相关的坐标或坐标范围**即可（例如：泄漏区域的行列范围、最近的可疑坐标）。**具体精度留 Design 阶段确定**——需求阶段保留"足以定位"这条判据，若 Design 阶段发现"精确到行列"不可行，允许降级为"最相关坐标"，但不允许降级为笼统的"关卡不合法"。

4. WHEN base 静态校验工具作为独立命令行或函数使用 THEN 它 SHALL **在校验结果的层面与运行时装载路径解耦**——即"这份关卡是否合法"的判定完全由 base check 说了算，不依赖真实调用 `parseLevel` 装载出 GridState 后再检查。
   **但允许底层实现共享 `parseLevel`**（守 SSOT 铁律 2「一条信息只存一处」；不为"接口解耦"而人为分叉两份 ASCII 解析逻辑——避免 MVP-1 白屏 bug 那类"两份实现漂移"再次发生）。
   判据：修改 `parseLevel` 的合法字符集、行列扫描逻辑，只应改一处代码；base check 与运行时装载应共享同一份"关卡如何被读进来"的实现。

## 交付物

- `experiments/exp06-sokoban/`：
  - **3 关 ASCII 关卡集**（大 / 小 / 畸形，畸形关违反边界闭合或非法字符）
  - **独立 base 静态校验工具**（不装载即可校验，共享底层 parseLevel 实现）
  - **浏览器 demo 关卡切换机制**（最简可行形式）
  - 保留 MVP-2 已实现的 publishability gate 不变

## Out of Scope

- **关卡菜单页 / 关卡预览 / 关卡选择 UI 的美术设计** —— R1.5 明确采用最简可行形式（URL / 下拉 / 快捷键），不做美术资产。
- **关卡可解性自动判定**（静态校验不含求解器，留扩展位不实现）。
- **纯算法关卡自动生成**（LLM 产关卡属路线图交付物 A）。
- **maxMoves 与撤销**（MVP-4）。
- **多于 3 关的关卡集** —— 超过 3 关是打磨性质、不再产生新证据；若后续社区有兴趣继续加关，走 PR 通道即可（见 `CONTRIBUTING.md`），本 MVP 不承诺。
- **重写 MVP-2 的 publishability gate** —— 本 MVP 明确沿用 MVP-2 已实现的 `assertPublishableLevel`，仅在两层校验体系中定位它，不改动其定义。
- 详见路线图"全链 Out of Scope"。

## 验证纪律提醒

按 `.kiro/steering/status-sync.md`：任何"完成 / 跑通"的断言必须有同轮真实测试输出 + git 状态确认；失败结论同等有价值，如实记录。

**特别提示**：AC 2.4 的"允许底层共享 `parseLevel`"是本 MVP 显式承诺——Design 阶段若发现真的需要分叉两份解析逻辑，必须在 REPORT 中如实说明理由（不能默默分叉，那正是 MVP-1 白屏 bug 的复发路径）。
