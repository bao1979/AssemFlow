---
description: AFP 测试与验收流程规范——四层测试体系 + 验收命令结构，落实"生成产物必须过编译+跑归档测试才算交付"的硬边界
inclusion: manual
---

# 测试与验收流程规范（AFP 版）

> 落实 `afp-core.md` 硬边界第 5 条：生成产物必须过编译 + 跑归档测试才算交付，杜绝"看起来对"的幻觉代码。
> 参考实现技术栈：TypeScript + vitest + fast-check（理由见 `docs/ai/system-design.md` 技术栈评估；正式定案前以此为默认）。

## 四层测试体系

从快到慢、从隔离到集成，每层对应 AFP 的一种构件/产物：

| 层级 | 工具 | 运行方式 | 覆盖范围 | 需要装配产物吗 |
| :--- | :--- | :--- | :--- | :--- |
| 属性测试（PBT） | fast-check | `vitest run` | **装配块的纯机制性质**：确定性（同输入同输出）、契约不变量、边界 | 否 |
| 单元测试 | vitest + mock | `vitest run` | 装配块/转接件的具体行为；转接件的字段映射/类型转换/按需分流 | 否 |
| 配置图校验 | 引擎 CLI | `assemflow check <config>` | **配置即图的静态校验**：契约对齐、where-used、死配置、静态可枚举红线 | 否（只读配置） |
| 装配冒烟 | Node.js 脚本 | `node scripts/smoke-{flow}.mjs` | 按配置真实装配出装配流，端到端跑通；验证"只改配置就能出可编译+过冒烟的代码" | 是（先装配出产物） |

E2E（Playwright）在有 UI 产物且页面结构稳定后再引入。

## 为什么属性测试是 AFP 的第一层

装配块必须是**确定性纯机制**。属性测试天然验证这一点——给随机输入断言"同输入同输出""无副作用""契约不变量成立"。一个块若依赖时钟/随机/全局状态，属性测试会立刻抓到。这一层是装配块能否"全球复用、确定性执行"的工程闸门，不可省。

## 每条装配流/每个块必须提供的测试产物

### 装配块属性测试

- 路径：`blocks/<block>/<block>.property.test.ts`
- 每个属性标注它验证的纪律（确定性 / 契约不变量 / 边界）
- 用 fast-check 的 `fc.assert` + `fc.property`

### 装配块/转接件单元测试

- 路径：`blocks/<block>/<block>.test.ts`、`adapters/<adapter>/<adapter>.test.ts`
- mock 在被测函数的直接依赖层切断

### 配置图校验

- 对每份 `configs/` 下的配置跑引擎静态校验
- 必须零：契约不对齐、悬空引用、死配置、违反静态可枚举红线的分支/循环

### 装配冒烟脚本

- 路径：`scripts/smoke-{flow}.mjs`
- 先用引擎按配置装配出产物，再对产物跑真实端到端流程
- 每步检查关键输出，任何一步失败立即 `process.exit(1)`
- 脚本开头注释说明前置条件和用法

### 装配冒烟覆盖要求

1. **正常装配**：只给配置 + 装配块，引擎产出可编译产物，端到端跑通
2. **只改配置**：改一处配置（如切换枚举路由），重装配，验证行为随之变化且仍可编译/跑通
3. **契约违例**：故意接不齐的块，验证引擎在装配前报错而非运行期崩
4. **死配置/悬空引用**：引用不存在的块/版本，验证静态校验拦截
5. **复现性**：同一配置两次装配产物一致（确定性）

## 验收命令结构

参考实现在 `package.json` 注册：

```
"verify:{flow}:fast": "npx vitest run {该装配流相关的 blocks/adapters 测试}",
"check:{flow}":       "assemflow check configs/{flow}",
"verify:{flow}":      "npm run lint && npm run typecheck && npm run build && npm run check:{flow} && npm run verify:{flow}:fast",
"smoke:{flow}":       "node scripts/smoke-{flow}.mjs"
```

| 命令 | 用途 | 何时跑 |
| :--- | :--- | :--- |
| `verify:{flow}:fast` | 只跑该流相关的块/转接件测试（属性+单元），快速反馈 | 开发中频繁跑 |
| `check:{flow}` | 配置图静态校验（契约/死配置/可枚举） | 改配置后必跑 |
| `verify:{flow}` | lint + typecheck + build + 配置校验 + fast 测试 | 任务完成后、交付前 |
| `smoke:{flow}` | 装配冒烟，真实装配 + 端到端 | 交付前验收 |

验收命令不包含全量 `npm run test`——只跑当前装配流相关测试，保证信号干净。

## AI 执行任务时的测试流程

> AI 只在设计期产配置/写块/写转接件，运行期零 AI。测试是 AI 自检产物的手段，不是运行期介入。

### 开发阶段（每个子任务完成后）

1. `npm run typecheck` 确认类型/契约
2. 改了配置 → 跑 `assemflow check`
3. 改了块/转接件 → 跑相关属性测试 + 单元测试

### 检查点任务

1. `npm run verify:{flow}` 完整代码验证
2. 有冒烟脚本则提醒 Plucker518 手动跑

### 最终验收任务

1. `npm run verify:{flow}` 零错误
2. 提醒 Plucker518 跑 `npm run smoke:{flow}`
3. 状态同步（更新 `docs/ai/state.json`，见 status-sync.md）

## 装配冒烟脚本规范

### 脚本结构

```javascript
import "dotenv/config";

let passed = 0;
let failed = 0;

function ok(step, msg) { passed++; console.log(`  ✅ [${step}] ${msg}`); }
function fail(step, msg) { failed++; console.error(`  ❌ [${step}] ${msg}`); }

async function main() {
  console.log(`\n🎯 装配流 {flow} 冒烟测试\n`);
  // 1-装配产物  2-端到端跑通  3-改配置重装配  4-复现性...
  console.log(`\n${"─".repeat(50)}`);
  console.log(`  通过: ${passed}  失败: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error("💥 脚本异常:", e.message); process.exit(1); });
```

### 命名约定

- 步骤编号连续：`1-装配`、`2-跑通`、`3-改配置重装配`
- 每步输出 ✅/❌ + 关键数据
- 关键步骤失败立即 `process.exit(1)`，避免级联错误

## 现有装配流测试清单

| 命令 | 覆盖装配流 | 步骤数 |
| :--- | :--- | :--- |
| —（尚无） | 等待实验①启动后填入 | — |
