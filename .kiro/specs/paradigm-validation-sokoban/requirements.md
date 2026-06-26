# Requirements Document

> Spec: paradigm-validation-sokoban

## Introduction

本 spec 是 AssemFlow 项目第二阶段的核心载体。

**目标升级**：项目前期目标是"验证装配流编程（AFP）是否成立"。经第一阶段三个最小证伪实验后，目标升级为：

> **寻找 AI agent 介入模式下的更优编程范式。**

AFP 是当前主推假设，但不是唯一约束。允许并鼓励混合其它范式（reducer 模式 / 状态机 / ECS / 行为树 / FRP 等），只要能让 **AI agent 与人协作开发** 更高效、更可靠、更可治理。

**载体选择**：Sokoban（推箱子）。理由：

- 全民知名，规则一句话讲完，LLM 训练数据里有完整规则细节
- 回合制（每次按键 = 一次完整数据变换），完美对应 AFP 甜区
- **每一关 = 一份 ASCII 数据**——是"AI 产配置 / 人审 / 引擎确定执行"叙事的天然舞台
- 家族外延广（可扩展到 2048 / 贪吃蛇 / 扫雷 / 简化 Roguelike），引擎沉淀可复用
- 暴露 AFP 当前薄弱处（状态机 / 撤销 / 循环 / UI 输出）但不至于一上来全面溃败

**与 open-questions.md 的关系**：本 spec 是 Q-028 的具体化。前置 milestone 直接对应 Q-026（K-STATE）和 Q-027（K-LOOP）。

**与现有引擎的关系**：复用并扩展 `@assemflow/core`。引擎需要的能力扩展全部走"实验暴露需求 → 引擎补足"的反向驱动路径，不预先设计。

---

## Glossary

- **AFP**：装配流编程（Assembly Flow Programming），本项目主推的范式。详见 `.kiro/steering/afp-core.md`。
- **装配块（Block）**：纯机制、与业务无关的最小组件。详见五元构件表。
- **转接件（Adapter）**：业务适配 / 防腐层，按需分流。
- **配置（Config）**：接线蓝图，声明式策略。
- **装配流（Flow）**：由上述构件组合而成的完整业务流。
- **甜区**：AFP 假设成立的场景域。本 spec 重点划定 Sokoban 的甜区边界。
- **K-STATE**：长寿命有状态对象的状态演化议题，对应 Q-026。
- **K-LOOP**：循环 / 事件驱动议题，对应 Q-027。
- **混合范式**：在 AFP 范式之外引入的辅助范式，如 reducer、状态机、ECS、行为树。每处使用必须显式标注（见 Requirement 7）。
- **回合（Turn）**：玩家发起一次输入到游戏状态完成一次完整变换的最小执行单元。Sokoban 每次按键 = 一回合。
- **关卡（Level）**：一份描述初始网格状态的纯数据配置。
- **静态校验（check）**：在不运行游戏的前提下，对配置 + 关卡数据的合法性分析。

---

## Requirements

### Requirement 1: 能跑通经典 Sokoban 的最小完整玩法

**User Story:** 作为研究者，我希望最终产出能跑通经典 Sokoban 的核心玩法循环，以确保验证的不是"教学玩具"而是"真实可玩的程序"。

#### Acceptance Criteria

1. WHEN 用户用键盘控制角色在网格内移动 THEN 系统 SHALL 按 Sokoban 规则处理移动：空地可走、墙不可走、箱子可推（前方为空地或目标格）、不可拉、不可推两个并排的箱子。
2. WHEN 全部箱子都位于目标格上 THEN 系统 SHALL 判定关卡完成并提示玩家。
3. WHEN 玩家选择撤销 THEN 系统 SHALL 回退到上一步状态（包括角色位置和箱子位置）；可连续撤销直到关卡起始状态。
4. WHEN 玩家选择重置 THEN 系统 SHALL 回到当前关卡的起始状态。
5. WHEN 用户切换关卡 THEN 系统 SHALL 加载新关卡的初始状态并清空撤销栈。
6. WHEN 项目包含至少一份"经典关卡集"（不少于 10 关，取自公共领域的经典 Sokoban 关卡） THEN 系统 SHALL 全部能正常加载并通关（用自动求解或手动验证）。

---

### Requirement 2: 关卡由纯数据驱动，无需改代码

**User Story:** 作为 AI agent 或人类设计者，我希望"加新关卡"只需要产出一份纯数据配置，引擎能直接加载，以验证 AFP "AI 产配置 / 引擎确定执行"叙事在游戏场景下成立。

#### Acceptance Criteria

1. WHEN 关卡用 ASCII 字符表示（如 `#` 墙、`.` 目标、`@` 玩家、`$` 箱子、`*` 箱子在目标上、空格地板） THEN 系统 SHALL 能直接加载该 ASCII 字符串为可玩状态。
2. WHEN AI agent 产出一份新关卡数据 THEN 系统的静态校验工具 SHALL 能在不运行游戏的前提下判定：
   - 关卡是否有唯一玩家
   - 箱子数与目标数是否一致
   - 边界是否完整闭合
   - 关卡是否"可解"（可选——本期不强求，但留扩展位）
2.1. AND 若校验失败，错误信息 SHALL 明确指出第几行第几列、违反了哪条规则。
3. WHEN 一份新关卡通过静态校验 THEN 系统 SHALL 不需要任何代码修改就能加载和游玩该关卡。
4. WHEN 关卡集发生变更（增/删/改某关） THEN 系统的引擎代码、装配块、转接件 SHALL 全部保持不变；仅配置/数据层变化。

---

### Requirement 3: 核心玩法可由配置参数调整

**User Story:** 作为研究者，我希望验证"只改配置就能改行为"的甜区假设在游戏机制层是否成立——而非仅在关卡数据层。

#### Acceptance Criteria

1. WHEN 配置中声明"允许拉箱子"为 true THEN 系统 SHALL 在玩家移动时同时拉动相邻箱子；为 false 时保持经典禁止拉箱子行为。
2. WHEN 配置中声明"允许推多个箱子"为 true THEN 系统 SHALL 允许同时推动连续的箱子链；为 false 时保持经典禁止行为。
3. WHEN 上述两项配置变更 THEN 系统 SHALL 不需要修改任何装配块代码，仅改一处配置值。
4. WHEN 配置不在已声明枚举范围（比如 `allowPullBox` 给了 `"sometimes"`） THEN 静态校验 SHALL 在装配前报错。

---

### Requirement 4: 长寿命有状态对象的演化方案（M1 K-STATE 前置）

**User Story:** 作为研究者，我希望先验证"长寿命有状态对象的状态演化"在 AFP 或混合范式下怎么表达最干净，再上 Sokoban——避免一上来同时碰多个未知。

#### Acceptance Criteria

1. WHEN M1 阶段启动 THEN 系统 SHALL 先产出一个最小状态机示例（红绿灯或自动售货机），独立于 Sokoban。
2. WHEN 该示例完成 THEN 文档 SHALL 记录至少两种方案（A. 调用方持久化 / B. 引擎承载状态）的对比，包括：
   - 配置可读性
   - AI agent 产/改配置的成本
   - 调试与回放的容易程度
3. WHEN M1 给出结论 THEN 该结论 SHALL 直接落地为 Sokoban 的状态演化方式，不再二次设计。
4. WHEN M1 验证失败（两种方案都不令人满意） THEN 项目 SHALL 诚实记录失败，并探索第三方案（如引入 reducer / Redux 模式）；不允许"绕过 M1 强行做 Sokoban"。

---

### Requirement 5: 循环 / 事件驱动的执行语义（M2 K-LOOP 前置）

**User Story:** 作为研究者，我希望先验证"循环 / 事件驱动"在 AFP 或混合范式下怎么表达，再做 Sokoban 的主循环——避免主循环成为不可解的坑。

#### Acceptance Criteria

1. WHEN M2 阶段启动 THEN 系统 SHALL 先产出一个最小循环示例（轮询累加器 / 事件序列处理器），独立于 Sokoban。
2. WHEN 该示例完成 THEN 文档 SHALL 记录至少两种方案（A. 主循环在外部 / B. 引擎支持 loop step）的对比，判据同 Requirement 4.2。
3. WHEN M2 给出结论 THEN Sokoban 的"按键 → 一次回合处理"循环 SHALL 按该方案实现。
4. WHEN Sokoban 的回合循环逻辑需要新增（如"按键 → 计算移动 → 检测胜利 → 渲染"），其增加 SHALL 由配置接线表达；新增控制流不允许偷偷塞进块内部当算法。

---

### Requirement 6: AI agent 介入模式可被验证为更优

**User Story:** 作为研究者，本项目的最终判据不是"AFP 能不能做 Sokoban"，而是"AI agent 在这个工程结构下能否高效介入"。我需要客观判据。

#### Acceptance Criteria

1. WHEN 给 AI agent 一段自然语言需求（如"加一关 8x8 的迷宫，难度中等"或"加一种新地形：冰块，玩家踩上去会滑到对面"） THEN agent SHALL 能在 ≤ 3 轮对话内产出一份能通过静态校验的配置 / 转接件 / 块。
2. WHEN AI agent 误改了 A 块，引擎的 `where-used` / 影响面分析 SHALL 能在 ≤ 1 秒内列出受影响的配置和流。
3. WHEN AI agent 产出的内容被引擎拒绝（check 不通过） THEN 拒绝信息 SHALL 足够具体，让 agent 能在不依赖人类提示的情况下自我修正。
4. WHEN 同一需求分别用「纯 AFP」和「最佳混合范式」实现 THEN 文档 SHALL 给出对比表，量化（行数 / agent 轮数 / 出错率）哪种在 AI 介入下更优。
5. WHEN 项目结束 THEN 系统 SHALL 沉淀出一份"在哪些机制上用 AFP、哪些机制上用其它范式、为什么"的清单——这是本 spec 的最重要交付物，比游戏本身更重要。

---

### Requirement 7: 范式混合的边界必须文档化

**User Story:** 作为研究者，我接受混合范式，但混合不是和稀泥。每处用了非 AFP 范式都必须说清楚为什么。

#### Acceptance Criteria

1. WHEN 项目中某模块使用了非 AFP 范式（如 reducer / 类 / 继承 / 全局状态） THEN 该模块的 README 或代码注释 SHALL 明确标注：
   - 用了什么范式
   - 为什么 AFP 在这里不合适
   - 这种妥协的代价
2. WHEN 某混合方案被证明优于纯 AFP THEN 该结论 SHALL 反过来更新 afp-core.md，明确"AFP 在 X 场景下应该让位于 Y 范式"。
3. WHEN 项目结束 THEN 整个仓库的范式分布 SHALL 可被一张图概述：哪些目录是 AFP、哪些是别的、边界为什么这么划。

---

### Requirement 8: 引擎复用边界——做完后能复用到其它网格游戏

**User Story:** 作为研究者，我希望 Sokoban 不是"一个一次性 demo"，引擎沉淀下来能复用到至少一个其它网格回合制游戏。

#### Acceptance Criteria

1. WHEN Sokoban 主项目完成 THEN 项目 SHALL 选定一个其它网格回合制游戏（2048 / 贪吃蛇 / 扫雷 / 简化 Roguelike 之一）作为复用验证。
2. WHEN 复用验证启动 THEN ≥ 60% 的 Sokoban 装配块和引擎代码 SHALL 不经修改地复用到新游戏。
3. WHEN 复用验证完成 THEN 文档 SHALL 记录"哪些抽象自然复用、哪些被迫返工、为什么"。
4. IF 复用率低于 60% THEN 文档 SHALL 诚实记录"Sokoban 引擎其实只是 Sokoban 引擎"，并分析阻碍通用化的根本原因——这同样是有价值结论，不是失败。

---

### Requirement 9: 渲染与输入是边界，不算 AFP 甜区

**User Story:** 作为研究者，我接受"渲染 / 输入"是 AFP 边界外的范畴，不强求它们用 AFP 实现。但边界必须画清。

#### Acceptance Criteria

1. WHEN 游戏需要画到 Canvas / DOM THEN 该渲染层 SHALL 被明确标注为"输出适配层"，不强求是装配块；但它的输入 SHALL 是纯数据（游戏状态），不是回调或事件流。
2. WHEN 用户键盘按键 THEN 输入适配层 SHALL 把按键事件转换成"一次确定的回合输入"喂给装配流；输入适配层同样不强求是 AFP 范式。
3. WHEN 渲染或输入适配层发生变更 THEN 装配块、转接件、配置 SHALL 不受影响。
4. WHEN 渲染失败或输入异常 THEN 错误 SHALL 在适配层处理，不污染游戏核心状态。

---

### Requirement 10: 实验产出物（交付清单）

**User Story:** 作为项目维护者，我需要明确知道 spec 完成时应该有什么东西。

#### Acceptance Criteria

1. WHEN spec 完成 THEN 仓库 SHALL 包含：
   - `experiments/exp04-k-state/`：M1 状态机最小实验 + 报告
   - `experiments/exp05-k-loop/`：M2 循环最小实验 + 报告
   - `experiments/exp06-sokoban/`：完整 Sokoban 实现（前端可玩 + 关卡集 + AI 产关卡 demo）
   - `docs/paradigm-comparison.md`：纯 AFP vs 混合范式的对比报告（Requirement 6.4 / 7.3 的具体落地）
2. WHEN spec 完成 THEN `docs/ai/state.json` SHALL 同步更新：Q-026/027/028 转 resolved + evidence 链接齐全。
3. WHEN spec 完成 THEN `docs/装配流编程-可行性分析.md` 或新增的修订文档 SHALL 反映"AFP 适用域 / 混合范式分布"这一最终结论。

---

## Out of Scope（本 spec 不做）

- **实时帧驱动游戏**：保留为未来研究方向，本 spec 限定回合制。
- **网络对战 / 多人**：与范式验证无关，引入会模糊判据。
- **3D 渲染 / 复杂动画**：渲染层只做"够清楚就行"，演示价值优先。
- **真实生产部署 / 性能优化**：本 spec 是研究稿产出，不是商用产品。
- **声音 / BGM / 美术资产**：与范式验证无关。
- **AI 对手 / 路径规划**：经典 Sokoban 不需要敌人；若 Requirement 8 复用验证选了 Roguelike，再补 AI 对手议题。
- **关卡自动生成（procedural generation）**：让 LLM 产关卡（人类语言驱动）属于 Requirement 6 范围；纯算法生成不在本 spec。

---

## 依赖与前置

- **前置已完成**：实验①/②/③ 提供的 AFP 基础设施和纪律
- **本 spec 同时推进**：
  - Q-024 inputMap 表达力增强（小工程，并行可加速 M3 配置纯净度）
- **本 spec 暂不依赖**：
  - Q-001（演化）—— 本期不动块版本
  - Q-014（块身份）—— 用文件路径引用够用
- **明确不要等**：
  - Q-002（配置驱动复用）/ Q-003（AI 产配置）—— 这两个会被本 spec 顺带证伪或证实

---

## 验证纪律提醒（执行期不许改）

按 `.kiro/steering/status-sync.md` 的纪律：

- 任何"M1 完成 / M2 完成 / Sokoban 跑通"的断言，**必须有同轮真实测试输出 + git 状态确认**。
- 失败的方案 / 暴露的引擎缺口 / 不得不引入的非 AFP 范式，**全部如实记录**，不许粉饰。
- 失败也是合法结论。"AFP 在 Sokoban 上证伪"和"AFP 在 Sokoban 上成立"同等有价值——只要诚实。
