/**
 * 纯转移核 transition() 的确定性属性测试（fast-check）。
 *
 * 覆盖设计 design.md 的 Correctness Property 1（确定性）：
 *   同一输入序列经 transition 折叠跑两遍，状态序列必须逐项相等。
 *   （无时钟 / 无随机 / 无 AI——若块里偷读了非确定性来源，这条会失败。）
 *
 * Validates: Requirements 1.2
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  transition,
  type LightState,
  type LightInput,
} from "../src/traffic-light";

const stateArb = fc.constantFrom<LightState>("red", "green", "yellow");
const inputArb = fc.constantFrom<LightInput>("tick", "pedestrian");

/** 从初始状态出发，按输入序列逐步折叠，记录每步产出的状态序列。 */
function runSequence(initial: LightState, inputs: LightInput[]): LightState[] {
  const trace: LightState[] = [];
  let current = initial;
  for (const input of inputs) {
    current = transition(current, input);
    trace.push(current);
  }
  return trace;
}

describe("transition · 确定性（Property 1）", () => {
  it("同一 (初始状态, 输入序列) 跑两遍，状态序列逐项相等", () => {
    fc.assert(
      fc.property(
        stateArb,
        fc.array(inputArb, { maxLength: 50 }),
        (initial, inputs) => {
          const runA = runSequence(initial, inputs);
          const runB = runSequence(initial, inputs);
          expect(runA).toEqual(runB);
        },
      ),
    );
  });

  it("单步 transition：同 (state, input) 多次调用结果恒等", () => {
    fc.assert(
      fc.property(stateArb, inputArb, (state, input) => {
        expect(transition(state, input)).toBe(transition(state, input));
      }),
    );
  });
});
