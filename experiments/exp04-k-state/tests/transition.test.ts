/**
 * 纯转移核 transition() 的穷举与输入分叉测试。
 *
 * 覆盖设计 design.md 的三条 Correctness Property：
 *   - Property 2（转移完备）：3 状态 × 2 输入 = 6 组合逐一断言，无未定义迁移。
 *   - Property 3（转移封闭）：输出恒为合法 LightState（red/green/yellow 之一）。
 *   - Property 4（输入驱动路径）：同一状态 green 下 tick 与 pedestrian 产出不同下一状态，
 *     实证 nextState = f(state, input) 而非 f(state)。
 *
 * Validates: Requirements 1.1, 1.3
 */

import { describe, it, expect } from "vitest";
import {
  transition,
  type LightState,
  type LightInput,
} from "../src/traffic-light";

const STATES: LightState[] = ["red", "green", "yellow"];
const INPUTS: LightInput[] = ["tick", "pedestrian"];
const VALID_STATES = new Set<LightState>(STATES);

describe("transition · 转移完备（Property 2）+ 转移封闭（Property 3）", () => {
  // 设计转移表（design.md 钉死）——逐组合的期望输出。
  const expected: Record<LightState, Record<LightInput, LightState>> = {
    red: { tick: "green", pedestrian: "red" },
    green: { tick: "green", pedestrian: "yellow" },
    yellow: { tick: "red", pedestrian: "yellow" },
  };

  // 穷举 3×2=6 组合逐一断言。
  for (const state of STATES) {
    for (const input of INPUTS) {
      it(`transition(${state}, ${input}) === ${expected[state][input]}`, () => {
        const next = transition(state, input);
        // Property 2：每个组合都有定义（不返回 undefined）。
        expect(next).toBeDefined();
        // 逐组合精确断言。
        expect(next).toBe(expected[state][input]);
        // Property 3：输出恒为合法 LightState。
        expect(VALID_STATES.has(next)).toBe(true);
      });
    }
  }
});

describe("transition · 输入驱动路径（Property 4）", () => {
  it("green 是驻留态：tick 保持绿", () => {
    expect(transition("green", "tick")).toBe("green");
  });

  it("green 收到行人请求：切黄", () => {
    expect(transition("green", "pedestrian")).toBe("yellow");
  });

  it("同一状态下两种输入产出不同下一状态（f(state,input) 非 f(state)）", () => {
    expect(transition("green", "tick")).not.toBe(
      transition("green", "pedestrian"),
    );
  });
});
