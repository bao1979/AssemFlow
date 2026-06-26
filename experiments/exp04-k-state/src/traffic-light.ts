/**
 * 【纯转移核】红绿灯状态机（traffic-light）
 * ────────────────────────────────────────────────────────────
 * 这是什么：MVP-0（K-STATE / Q-026）的纯机制核心。一个与游戏无关、
 *           带最小外部输入的状态机：`下一状态 = f(当前状态, 输入)`。
 *
 * 在 AFP 里的角色：纯机制（AFP 纯装配块逻辑）。它只回答一个问题——
 *           "给定当前灯色与一个外部输入，下一灯色是什么？"
 *           状态存哪、谁来循环喂输入，都不归它管（那是方案 A/B 驱动器的事）。
 *
 * 为什么是这套转移表：MVP-0 的关键点是"外部输入能改变迁移路径"。
 *           green 被设为**驻留态**——tick 保持绿，只有 pedestrian 才切黄。
 *           于是同一状态 green 下，两种输入产出不同的下一状态：
 *             transition("green", "tick")       = "green"
 *             transition("green", "pedestrian") = "yellow"
 *           这实证了 `nextState = f(state, input)` 而非 `f(state)`，
 *           与 Sokoban `nextState = f(grid, direction)` 同形。
 *
 * AFP 纪律点：
 *   1. 纯函数——不读时钟、不用随机、不调 AI、无副作用。同 (state,input) 永远同结果。
 *   2. 状态体量刻意极小（单枚举）。不引入大体量状态——那是 MVP-1 网格的变量。
 *   3. 转移表对 3 状态 × 2 输入 = 6 组合全覆盖，无未定义迁移。
 */

import { Type, type Static } from "@sinclair/typebox";

/** 灯色状态：刻意保持单枚举，状态体量极小（Requirement 1.3）。 */
export type LightState = "red" | "green" | "yellow";

/** 外部输入：tick（时钟推进）与 pedestrian（行人请求）。 */
export type LightInput = "tick" | "pedestrian";

/**
 * 转移表（设计 design.md 钉死，外部输入改变迁移路径是 MVP-0 关键点）：
 *
 * | 当前状态 | tick   | pedestrian |
 * | red    | green  | red        |
 * | green  | green  | yellow     |  ← green 是驻留态
 * | yellow | red    | yellow     |
 *
 * 用一张静态查表表达，保证转移完备（全 6 组合有定义）且转移封闭（输出恒为合法 LightState）。
 */
const TRANSITION_TABLE: Record<LightState, Record<LightInput, LightState>> = {
  red: { tick: "green", pedestrian: "red" },
  green: { tick: "green", pedestrian: "yellow" },
  yellow: { tick: "red", pedestrian: "yellow" },
};

/**
 * 纯机制：给定当前状态与一个外部输入，确定性地算出下一状态。
 * 同 (state, input) 永远同 nextState——无时钟 / 无随机 / 无 AI。
 */
export function transition(state: LightState, input: LightInput): LightState {
  return TRANSITION_TABLE[state][input];
}

/**
 * 输入契约（喂给 BlockDef 与引擎 Ajv 校验）：当前状态 + 外部输入，二者均为枚举。
 * 非法值（枚举之外）由引擎 Ajv 在 execute 之前拦下。
 */
export const TrafficLightInput = Type.Object({
  state: Type.Union([
    Type.Literal("red"),
    Type.Literal("green"),
    Type.Literal("yellow"),
  ]),
  input: Type.Union([Type.Literal("tick"), Type.Literal("pedestrian")]),
});
export type TrafficLightInput = Static<typeof TrafficLightInput>;

/**
 * 输出契约：下一状态，恒为合法 LightState 枚举（转移封闭）。
 */
export const TrafficLightOutput = Type.Object({
  nextState: Type.Union([
    Type.Literal("red"),
    Type.Literal("green"),
    Type.Literal("yellow"),
  ]),
});
export type TrafficLightOutput = Static<typeof TrafficLightOutput>;
