/**
 * 【块注册】把纯转移核 `transition()` 包装成引擎的 BlockDef，并提供 A/B 两套注册表。
 * ────────────────────────────────────────────────────────────
 * 这是 A/B 的实现分叉点（受控变量：状态存活在哪）：
 *   - A · 纯块 `traffic-light-step`：入 {state, input}、出 {nextState}。块无记忆，
 *         状态由调用方在回合间 thread——状态在数据流里可见、可审（纯 AFP）。
 *   - B · 有状态块工厂 `createStatefulLightBlock(initial)`：闭包持 `current`，
 *         入 {input}、出 {state}，execute 读写 current——状态活在「引擎所运行的块」内，
 *         对配置与调用方不可见（违背"配置即图"，故带 @paradigm 标记）。
 *
 * 两块复用同一个纯函数 `transition()`，转移逻辑保持同一，避免逻辑差异污染 A/B 对比。
 * 沿用 exp01 约定：跨包深路径 import 引擎公共 API（../../../../engine/src/index.js）。
 */

import { BlockRegistry, type BlockDef } from "../../../../engine/src/index.js";
import { Type } from "@sinclair/typebox";

import {
  transition,
  type LightState,
  type LightInput,
  TrafficLightInput,
  TrafficLightOutput,
} from "../traffic-light.js";

// ── A · 纯块 ──────────────────────────────────────────────
// 状态进出、块无记忆：每回合拿到完整 {state, input}，算出 {nextState} 返回。
// I/O 契约直接复用 traffic-light.ts 的 schema（state+input → nextState）。
const trafficLightBlock: BlockDef = {
  name: "traffic-light-step",
  inputSchema: TrafficLightInput,
  outputSchema: TrafficLightOutput,
  execute: (input) => {
    const { state, input: signal } = input as {
      state: LightState;
      input: LightInput;
    };
    return { nextState: transition(state, signal) };
  },
};

// ── B · 有状态块工厂 ──────────────────────────────────────
/**
 * @paradigm NON-AFP: stateful-block
 * @reason 模拟"运行时承载状态"——闭包持有 `current`，跨多次 assemble 调用持续存在；
 *         配置只喂 input，状态对配置/调用方不可见。AFP 数据流不表达这种记忆。
 * @afp-debt 缺 Q-026 设想的一等机制（状态快照 / reset / 多实例隔离）——本原型靠
 *           "每次 createRegistryB 重建块实例"来 reset，其缺失记入 REPORT 作为 B 的成本。
 *
 * 入 {input}、出 {state}；execute 执行 `current = transition(current, input)` 并返回新状态。
 */
function createStatefulLightBlock(initial: LightState): BlockDef {
  let current = initial; // 跨多次 assemble 调用持续存在的运行时状态（活在闭包里）
  return {
    name: "traffic-light-stateful",
    inputSchema: Type.Object({
      input: Type.Union([
        Type.Literal("tick"),
        Type.Literal("pedestrian"),
      ]),
    }),
    outputSchema: Type.Object({
      state: Type.Union([
        Type.Literal("red"),
        Type.Literal("green"),
        Type.Literal("yellow"),
      ]),
    }),
    execute: (input) => {
      const { input: signal } = input as { input: LightInput };
      current = transition(current, signal);
      return { state: current };
    },
  };
}

// ── 注册表构造 ────────────────────────────────────────────

/**
 * 方案 A 的注册表：登记纯块 `traffic-light-step`。
 * 块无状态，可安全复用同一注册表。
 */
export function createRegistryA(): BlockRegistry {
  const reg = new BlockRegistry();
  reg.register(trafficLightBlock);
  return reg;
}

/**
 * 方案 B 的注册表：每次调用都登记一个**全新**的有状态块实例（initial 起点）。
 * 每次新实例 → 状态隔离 / reset：这正是 B 缺一等 reset 机制时的替代手段
 * （重建 registry 来重置 `current`）。
 */
export function createRegistryB(initial: LightState): BlockRegistry {
  const reg = new BlockRegistry();
  reg.register(createStatefulLightBlock(initial));
  return reg;
}
