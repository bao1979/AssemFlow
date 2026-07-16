/**
 * 【拼装脚本】真正跑在 engine.assemble() 上的版本
 * ────────────────────────────────────────────────────────────
 * 旧版本：自己写了一个 mini-registry，按 steps 遍历 + 调本地函数。
 * 这版：直接调 @assemflow/core 的 assemble()，复用引擎的：
 *   - Ajv 输入/输出双契约校验
 *   - checkConfig 静态校验（悬空引用 / 契约对齐 / 死配置）
 *   - 异常短路（块抛 Error → AssembleResult.error）
 *
 * 这层薄薄的封装做了两件事：
 *   1. 把 JSONC 配置读上来（去掉行注释后 JSON.parse）
 *   2. 给 initialInput 补几个空数组（users/sent/logs），让 inputMap 在第一次跑时就能取到
 *
 * 第 2 点暴露了引擎当前的能力缺口：inputMap 不支持"找不到时默认值"。
 * 这是个 ergonomic 缺口，不是正确性问题——业务侧用 initialInput 兜底足够。
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { assemble, type AssembleResult, type FlowConfig, parseJsonc } from "@assemflow/core";

import { createRegistry } from "./blocks/register.js";

// ── 配置读取 ────────────────────────────────────────────────
function loadConfig(path: string): FlowConfig {
  const raw = readFileSync(path, "utf-8");
  return parseJsonc<FlowConfig>(raw);
}

// ── 调用者面向的输入 ─────────────────────────────────────────
export interface RegisterInput {
  email: string;
  password: string;
  salt: string;
  timestamp: string;
}

// 兼容旧 API：RegisterResult 形状保持不变，方便 smoke 测试断言点不动
export interface RegisterResult {
  success: boolean;
  error?: string;
  context: Record<string, unknown>;
}

/**
 * 装配并运行注册流。
 *
 * 流程：读配置 → 构造注册表 → 注入初始上下文 → 调 engine.assemble()。
 */
export function assembleAndRun(configPath: string, input: RegisterInput): RegisterResult {
  const config = loadConfig(configPath);
  const registry = createRegistry();

  // initialInput = 调用方业务输入 + 三个累积数组的种子。
  // 引擎会把 params 和 initialInput 合并作为初始上下文。
  const initialInput: Record<string, unknown> = {
    ...input,
    users: [],
    sent: [],
    logs: [],
  };

  const result: AssembleResult = assemble(config, registry, initialInput);
  return {
    success: result.success,
    error: result.error,
    context: result.context,
  };
}

// ── 直接运行（npm run assemble）────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const isDirectRun = process.argv[1]?.includes("assemble");
if (isDirectRun) {
  const configPath = resolve(__dirname, "configs/register.jsonc");
  const result = assembleAndRun(configPath, {
    email: "test@example.com",
    password: "P@ss1234",
    salt: "fixed-salt-for-demo",
    timestamp: "2026-06-25T12:00:00Z",
  });
  console.log(JSON.stringify(result, null, 2));
}
