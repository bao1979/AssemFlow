/**
 * 【方案 B 驱动】红绿灯 · 运行时承载状态（有状态块原型）
 * ────────────────────────────────────────────────────────────
 * @paradigm NON-AFP: stateful-block / runtime-state
 * @reason 模拟"运行时承载状态"——当前灯色不由调用方在回合间 thread，而是活在
 *         registryB 注册的有状态块闭包里（`current`）。配置只接线 input，状态
 *         对配置与调用方都不可见。AFP 的无状态数据流（DAG）不表达这种跨调用记忆，
 *         故本驱动整体标记为 NON-AFP，与方案 A（纯 AFP，driver-a）并排做受控对比。
 * @afp-debt 这是 B 的最小忠实原型，缺 Q-026 设想的引擎一等机制：
 *           - 无一等 reset：要"重置状态"只能丢弃整个有状态块、重建 registryB；
 *           - 无状态快照 / 恢复：闭包里的 `current` 无法被引擎读出或回放；
 *           - 无多实例隔离：靠"每次 createRegistryB 新建块实例"凑隔离。
 *           这些缺失是 B 的真实成本，如实记入 REPORT，不靠提前改引擎粉饰。
 *
 * 关键设计点（与 design.md 对齐）：
 *   - **状态不在 StatefulRunner 里**，而在 registryB 的有状态块闭包内——这才是
 *     "运行时承载"。Runner 只是一层薄驱动，持有 config + registryB。
 *   - `send(input)` 调 `assemble(config, registryB, {input})`，块执行
 *     `current = transition(current, input)` 并把新状态摊平回 `context.state`。
 *   - 失败语义与 A **对称**：非法 input 被引擎 Ajv 在块 `execute` **之前**拦下，
 *     `assemble` 返回 `success:false`，Runner 在此抛错；因块 execute 未运行，
 *     闭包 `current` 不前进（Property 6：失败不前进）。
 *
 * 沿用 exp01 约定：跨包深路径 import 引擎公共 API、JSONC 去行注释后 JSON.parse。
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  assemble,
  BlockRegistry,
  type AssembleResult,
  type FlowConfig,
  parseJsonc,
} from "@assemflow/core";

import { createRegistryB } from "./blocks/register.js";
import type { LightState, LightInput } from "./traffic-light.js";

// ── 配置读取（使用 engine 统一的 JSONC 解析）─────────────────
function loadConfig(path: string): FlowConfig {
  const raw = readFileSync(path, "utf-8");
  return parseJsonc<FlowConfig>(raw);
}

/**
 * 方案 B 驱动器：薄驱动，状态活在 registryB 的有状态块闭包内（不在本对象上）。
 *
 * 用法：
 * ```ts
 * const runner = new StatefulRunner(cfgB, createRegistryB("red"));
 * for (const i of inputs) runner.send(i); // 调用方只发 input，不持有 state
 * ```
 */
export class StatefulRunner {
  // 注意：这里不存任何 `state` / `current` 字段——状态刻意只活在 registryB 的
  // 有状态块闭包内。Runner 仅持有 config 与 registry 这两个"接线材料"。
  private config: FlowConfig;
  private registryB: BlockRegistry;

  constructor(config: FlowConfig, registryB: BlockRegistry) {
    this.config = config;
    this.registryB = registryB;
  }

  /**
   * 发一个外部输入，推进有状态块内部的 `current`，返回新状态。
   *
   * 失败语义（与 driver-a 的 stepA 对称）：非法 input 被引擎 Ajv 在块 execute
   * 之前拦下 → `assemble` 返回 `success:false` → 这里抛错。因块未执行，闭包
   * `current` 不前进（Property 6）。
   */
  send(input: LightInput): LightState {
    const result: AssembleResult = assemble(this.config, this.registryB, {
      input,
    });
    if (!result.success) {
      throw new Error(`方案 B 装配失败: ${result.error}`);
    }
    return result.context.state as LightState;
  }

  /**
   * 重置状态。
   *
   * 反映 B 的成本：有状态块没有一等 reset——闭包里的 `current` 无法被外部直接
   * 改写。要回到初始态，只能**丢弃整个有状态块、重建 registryB**（新块实例的
   * 闭包从 `initial` 起算）。这正是 design.md 记的 @afp-debt：B 缺一等
   * reset / 快照 / 多实例隔离，只能靠"重建 registry"凑。
   */
  reset(initial: LightState): void {
    this.registryB = createRegistryB(initial);
  }
}

// ── 直接运行（演示：打印一段状态轨迹）──────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const isDirectRun = process.argv[1]?.includes("driver-b");
if (isDirectRun) {
  const configPath = resolve(__dirname, "configs/traffic-light-b.jsonc");
  const config = loadConfig(configPath);
  const runner = new StatefulRunner(config, createRegistryB("red"));

  const inputs: LightInput[] = [
    "tick", // red    → green
    "tick", // green  → green（驻留态：tick 不推进绿）
    "pedestrian", // green  → yellow（行人请求切黄）
    "tick", // yellow → red
    "pedestrian", // red    → red（行人无影响）
  ];

  const trace: LightState[] = [];
  for (const i of inputs) trace.push(runner.send(i));
  console.log("方案 B 状态轨迹:", trace.join(" → "));
}
