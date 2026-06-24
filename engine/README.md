# engine/ · 确定性装配引擎

> 理论身份：把"配置 + 装配块 + 转接件 + 数据"确定性地拼成装配流的执行器。
> 纪律来源：`.kiro/steering/afp-core.md`；目标能力见 `docs/ai/system-design.md`。

## 核心定位

**运行期零 AI。** 引擎只做确定性拼装与校验，不调用任何 LLM。AI 的工作全部发生在设计期（产配置、人审）。这条边界是 AFP 唯一站得住的楔子，引擎实现必须死守。

## 目标能力（一等公民）

1. **确定性拼装器（assembler）**：按配置拼装，产物可复现。
2. **契约校验器（contract-validator）**：装配块 I/O Schema + 版本校验。
3. **配置图分析（config-graph）**：where-used、死配置、影响面、类型校验，全部从配置结构静态算出。
4. **依赖白名单 + 制品校验（dependency-allowlist）**：防 slopsquatting。
5. **交付闸门**：产物必须过编译 + 跑归档测试才算交付。

## 实现形态（已定案）

- **库优先 + 薄 CLI**：核心是 `@assemflow/core` 库（可被冒烟脚本 import、被测试直调），`assemflow` CLI 是入口。
- **契约**：TypeBox 写（产标准 JSON Schema）+ Ajv 校验。
- **MVP 命令**：`assemflow check <config>`（静态校验配置图）/ `assemflow assemble <config>`（确定性装配）/ `assemflow graph <config>`（输出 mermaid 配置图）。解析器用 Node 内置 `util.parseArgs`（零依赖）。
- **assemble 形态**：MVP 用运行时编排，"过编译"由 tsc + Ajv 双保证；codegen（吐 `.ts`）留 v2。
- **可视化**：`graph` 输出 Mermaid 文本，交互式 SVG 留后续。

## 状态

Planned。技术栈与形态已定案（见 `docs/ai/system-design.md`）。等待实验①验证甜区假设后再决定是否动工。

> 当前为骨架，无实现。
