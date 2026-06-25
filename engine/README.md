# engine/ · 确定性装配引擎（@assemflow/core）

> 理论身份：把"配置 + 装配块"确定性地拼成装配流的执行器。
> 纪律来源：`.kiro/steering/afp-core.md`；设计细节见 `docs/ai/system-design.md`。

## 核心定位

**运行期零 AI。** 引擎只做确定性拼装与校验，不调用任何 LLM。

## 已实现能力（13 测试全过）

| 能力 | 说明 | 接口 |
| :--- | :--- | :--- |
| check | 静态校验配置图：悬空引用、契约对齐（类型兼容）、死配置检测 | CLI `assemflow check <config> --blocks <manifest>` + 库 API |
| assemble | 确定性装配：按 steps 顺序执行块，Ajv 校验输入+输出双契约 | **仅库 API**（需注册块的 execute 函数） |
| graph | 输出 Mermaid 配置图 | CLI `assemflow graph <config>` + 库 API |

**`assemble` 不走 CLI。** 原因：assemble 必须注册块实现代码（execute 函数），纯 CLI 无法提供。使用方式：

```typescript
import { BlockRegistry, assemble } from "@assemflow/core";
const reg = new BlockRegistry();
reg.register({ name: "...", inputSchema, outputSchema, execute });
const result = assemble(config, reg);
```

## 待扩展

- where-used 影响面分析
- 依赖白名单机制集成进引擎
- codegen（吐 `.ts` 源码）留 v2

## 契约

TypeBox 写（产标准 JSON Schema）+ Ajv 运行时校验（输入+输出双校验）。

## 运行

```powershell
cd engine
npm install
npm test          # 13 测试
npm run typecheck # 0 错误
```
