/**
 * 【方案 A 驱动器】调用方持久化（纯 AFP）
 * ────────────────────────────────────────────────────────────
 * 这是什么：MVP-0（K-STATE / Q-026）方案 A 的驱动层。状态在引擎外，逻辑纯——
 *           `下一状态 = f(当前状态, 输入)`，状态由【调用方】在两次调用之间保管。
 *
 * 在 AFP 里的角色：纯 AFP。块无记忆、引擎无记忆，每回合把完整 {state, input}
 *           作为 initialInput 喂进 `assemble()`，从结果上下文取 `nextState` 出来，
 *           由调用方存起来、下回合再喂进去。状态在数据流里【可见、可审】。
 *
 * 与方案 B 的对称点（design.md「失败语义对称」）：
 *           非法 input 被引擎 Ajv 在块 execute【之前】拦下 → assemble 返回 success:false。
 *           stepA 在此【抛异常】，且状态不前进（调用方保留旧 state）——
 *           与 driver-b 的 send() 失败语义一致，保证「调试容易程度」对比只反映
 *           状态归属差异，而非错误处理差异。
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// 跨包深路径 import：沿用 exp01 约定（等 @assemflow/core 发布或加 path alias 后再改）。
import { assemble, type AssembleResult } from "../../../engine/src/index.js";
import type { FlowConfig, BlockRegistry } from "../../../engine/src/index.js";

import { createRegistryA } from "./blocks/register.js";
import type { LightState, LightInput } from "./traffic-light.js";

// ── 配置读取（沿用 exp01：简化版 JSONC，只剥行注释）────────────
function loadConfig(path: string): FlowConfig {
  const raw = readFileSync(path, "utf-8");
  const stripped = raw.replace(/^\s*\/\/.*$/gm, "");
  return JSON.parse(stripped) as FlowConfig;
}

/**
 * 方案 A 的一步迁移：把 {state, input} 作为 initialInput 喂进引擎，
 * 跑配置 A（接线纯块 traffic-light-step），从结果上下文取 `nextState`。
 *
 * 失败语义（与 driver-b 对称）：assemble 失败（如非法 input 被 Ajv 拦下）时【抛异常】，
 * 状态不前进——调用方应保留旧 state，不要采用本次返回值。
 *
 * @throws 当 assemble 返回 success:false 时抛出，携带引擎诊断信息。
 */
export function stepA(
  config: FlowConfig,
  registry: BlockRegistry,
  state: LightState,
  input: LightInput,
): LightState {
  const initialInput: Record<string, unknown> = { state, input };
  const result: AssembleResult = assemble(config, registry, initialInput);

  if (!result.success) {
    // 与 B 对称：非法 input 在 execute 前被 Ajv 拦下，状态不前进。
    throw new Error(
      `方案 A assemble 失败（state=${state}, input=${input}）：${result.error ?? "未知错误"}`,
    );
  }

  return result.context.nextState as LightState;
}

// ── 直接运行入口（npm run assemble）─────────────────────────
// ESM「是否作为主模块运行」判定：比较本文件 URL 与进程入口脚本路径。
const isDirectRun =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const configPath = resolve(__dirname, "configs/traffic-light-a.jsonc");

  const config = loadConfig(configPath);
  const registry = createRegistryA();

  // 示例输入序列：含 pedestrian 分叉，展示 green 驻留态与行人触发切黄。
  //   red --tick--> green --tick--> green(驻留) --pedestrian--> yellow --tick--> red --pedestrian--> red --tick--> green
  const inputs: LightInput[] = [
    "tick", // red    → green
    "tick", // green  → green（驻留：tick 不推进绿灯）
    "pedestrian", // green  → yellow（行人请求切黄）
    "tick", // yellow → red
    "pedestrian", // red    → red（行人对红灯无影响）
    "tick", // red    → green
  ];

  // 调用方持有状态，循环在外部。
  let state: LightState = "red";
  console.log("【方案 A · 纯 AFP】状态轨迹（调用方持久化）");
  console.log(`  初始: ${state}`);
  for (const input of inputs) {
    const next = stepA(config, registry, state, input);
    console.log(`  ${state.padEnd(6)} --${input.padEnd(10)}--> ${next}`);
    state = next; // 调用方在回合间保管状态
  }
  console.log(`  终态: ${state}`);
}
