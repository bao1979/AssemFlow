# AssemFlow 系统设计

> 状态：研究稿 v0.1 阶段的设计基线。引擎尚未实现，本文件记录**目标架构**与**已定纪律**，随实施推进更新。
> 纪律来源：`.kiro/steering/afp-core.md`。理论来源：`docs/装配流编程-可行性分析.md`。

## 架构总览

AssemFlow 是装配流编程（AFP）的参考实现引擎，核心是一条清晰的时间线划分：

```
设计期（Design-time）                运行期（Run-time）
─────────────────────              ─────────────────────
AI 发现装配块                        引擎确定性拼装
AI 产配置（接线蓝图）       ──►       零 AI
人审配置                             编译 + 跑归档测试
                                    可复现、可审计
```

这条边界是 AFP 区别于 vibe coding / Bit Hope AI 的唯一楔子，不可逾越。

## 五元构件的数据/职责模型

| 构件 | 目录 | 产出物形态 | 契约 |
| :--- | :--- | :--- | :--- |
| 装配块 Block | `blocks/` | 纯机制代码 + I/O Schema + 版本 + 测试 | 强契约：输入/输出 Schema、语义化版本 |
| 转接件 Adapter | `adapters/` | 防腐层代码（字段映射/类型转换/按需分流） | 转接协议；只组合不继承 |
| 配置 Config | `configs/` | 声明式接线蓝图（结构/接线/枚举路由） | 静态可枚举；算法不入配置 |
| 数据 Data | `data/` | 运行时/测试数据 | — |
| 装配流 Flow | 由 `configs/` 定义 | 上四者组合出的完整业务流 | 由配置引用关系构成的图 |

## 引擎目标能力（一等公民）

1. **确定性拼装器（assembler）**：按配置把装配块 + 转接件拼成可运行产物，运行期零 AI。
2. **契约校验器（contract-validator）**：装配块 I/O Schema + 版本校验，拼装前类型对齐。
3. **配置图分析（config-graph）**：where-used、死配置检测、改一处的影响面波及、类型校验——全部从配置结构静态算出。这是"配置债看得见"优势的兑现点。
4. **依赖白名单 + 制品校验（dependency-allowlist）**：装配块依赖必须白名单内、可审计，掐死 slopsquatting。
5. **交付闸门**：生成产物必须过编译 + 跑归档测试才算交付。

> 模块状态/进度见 `state.json`（唯一真相源），此处不重复。

## 目录结构

```
AssemFlow/
├─ README.md                     # 对外门面（GitHub 首页，中文；英文版待生成）
├─ .kiro/
│  ├─ steering/                  # 项目纪律
│  │  ├─ afp-core.md             #   AFP 范式纪律（宪法）
│  │  ├─ language.md             #   语言规范（含对外文档双语例外）
│  │  ├─ status-sync.md          #   文档同步规范（SSOT 模型）
│  │  ├─ content-separation.md   #   装配块纯度规范
│  │  └─ test-and-acceptance.md  #   AFP 四层测试体系
│  └─ skills/                    # AFP AI 工作流技能（discover/author/adapter/extract）
├─ docs/
│  ├─ 装配流编程-可行性分析.md     # 可行性分析 v0.1
│  └─ ai/
│     ├─ state.json              #   唯一高频状态真相源（SSOT）
│     ├─ system-design.md        #   本文件：架构 + 目录（中频）
│     └─ decisions-archive.json  #   决策归档（低频）
├─ blocks/      装配块（纯机制，强契约）
├─ adapters/    转接件（业务适配/防腐层）
├─ configs/     配置（接线蓝图，定义装配流）
├─ data/        数据（运行时/测试）
├─ engine/      确定性装配引擎（运行期零 AI）
└─ experiments/ 三个最小证伪实验
```

## 技术栈评估与论证

> 结论：**TypeScript + vitest + fast-check（已定案，D-004）**。这套栈虽继承自 clawerworld，但经评估对 AFP 高度契合，并非随意沿用。以下为论证。

### 为什么 TypeScript 适配 AFP（逐条对纪律）

| AFP 需求（来自 afp-core.md） | TS 栈的现成支撑 |
| :--- | :--- |
| 装配块强契约（I/O Schema） | Zod / TypeBox / JSON Schema，类型即契约，编译期对齐 |
| 配置即图的静态分析（where-used / 死配置 / 影响面 / 类型校验） | TS 编译器 API + ts-morph 做 AST 与引用图分析；类型系统直接给类型校验 |
| 装配块是确定性纯机制 | fast-check 属性测试验证"同输入同输出 / 无副作用 / 不变量"，是验证纯机制的利器 |
| 版本迁移 codemod（block@v1→v2） | jscodeshift / ts-morph，且 LLM 擅长这类机械迁移 |
| 生态对标 npm（文档核心类比） | semver、package.json 即"治理关节"的现成标准，无需重造 |
| 设计期工具 + 运行期引擎同栈 | 单语言贯穿，降低引擎复杂度 |

### 权衡与缓解

- **风险**：JS/PyPI 是 LLM 幻觉包重灾区（文档 20% 数据）。**缓解**：依赖白名单已是硬边界，从源头掐死 slopsquatting。
- **若目标业务域含高性能计算**：在装配块层用 native 模块或 WASM，引擎/契约层仍用 TS。

### 配置格式（已定案）

**配置源 = JSON（开发期 JSONC 允许注释）+ JSON Schema 校验；HTML 收编为引擎派生的可视化视图。**

选型论证：

- **JSON vs YAML/HTML/TOML/DSL**：JSON 在"AI 产出稳定性、人审门槛（Plucker518 已熟悉）、JSON Schema 校验生态、物理上塞不进逻辑"四项上综合最优。
- **为何排除 HTML 作配置源**：HTML 是显示标记语言而非数据/接线描述；可内嵌 `<script>`/事件属性，物理上守不住"算法不入配置"红线；缺成熟结构校验标准。HTML 只作输出端的派生视图。
- **为何排除 YAML**：缩进敏感易错 + 隐式类型转换坑（如版本号被当数字、NO→false）+ Plucker518 不熟。
- **为何排除 TOML/自定义 DSL**：TOML 不适合 AFP 配置的图/深嵌套结构；自定义 DSL 要造解析器与工具链，早期不值得（先有杀手级引擎，别造太多轮子）。

JSON 缺点的缓解：

- **无注释** → 开发期用 JSONC（VS Code 原生支持，引擎用 jsonc-parser 解析），或用 `"$comment"`/`"description"` 字段。
- **裸 JSON 人审累** → 引擎把配置图渲染成 HTML/SVG 可视化（Mermaid/流程图）供审阅，呼应"代码只是蓝图派生物"——HTML 视图是配置的派生视图，不是源。

### 契约 Schema 库（已定案）

**TypeBox 写契约（产出标准 JSON Schema）+ Ajv 运行时校验。排除 Zod。**

澄清分层（三者不在同一层，真正要选的只是"写法"）：

- **JSON Schema** = 契约的真相格式
- **Ajv** = 运行时校验器
- **TypeBox** = 写法（用 TS 写、产物即标准 JSON Schema、`Static<T>` 拿 TS 类型，转换无损）

决定性约束：装配块契约要全球共享、要被引擎静态分析（配置图做契约对齐时读契约），**因此契约真相必须是可移植/可序列化的纯数据（JSON Schema）**。

- **为何排除 Zod**：Zod 的 schema 是 TS 代码，想取代 JSON Schema 的地位，与"契约真相必须是可被机器导航的纯数据"冲突（等于在契约层重蹈"代码做配置"覆辙）；且 zod→json-schema 转换有损。
- 一栈到底：TypeBox 定义 → 编译出 JSON Schema 制品（可共享/可分析）→ Ajv 校验配置与数据 → TS 侧 `Static` 拿类型。

### 引擎 CLI 形态（已定案）

**库优先 + 薄 CLI。** 引擎核心是 `@assemflow/core` 库（可被冒烟脚本 import、可被测试直调），`assemflow` CLI 只是入口。

CLI 命令：

| 命令 | 职责 | 状态 |
| :--- | :--- | :--- |
| `assemflow check <config> --blocks <manifest>` | 静态校验配置图：悬空引用、契约对齐、死配置。需块清单（含 schema，不含 execute） | 已实现 |
| `assemflow graph <config>` | 输出 Mermaid 配置图 | 已实现 |
| `assemflow where-used <block>` | 影响面分析 | 后续 |

**`assemble` 不走 CLI，仅通过库 API 调用。** 原因：assemble 必须注册块的 `execute` 函数（真实代码），纯 CLI 无法提供——需要使用者在 TS 代码里 `import { assemble } from "@assemflow/core"` 并注册块。这是设计决定，不是能力缺失。

- CLI 解析器用 Node 内置 `util.parseArgs`（零依赖）。
- **`assemble` 产出形态**：运行时编排（读配置 → Ajv 校验输入+输出双契约 → 按图串块执行）。codegen（吐 `.ts` 源码）留作 v2 增强。

### 配置可视化（已定案）

**MVP 用 Mermaid，交互式 SVG 留作后续增强。**

- `assemflow graph` 输出 mermaid 文本，可直接嵌进 Markdown/PR/handoff，跨平台零渲染依赖（承接"跨平台显示"诉求），且 mermaid 文本是可 diff、可审计的纯数据制品。
- 交互式可视化（点节点看契约、高亮 where-used，自绘 SVG/d3）价值高但属引擎成熟期体验增强，后续再做。
