/**
 * 【A/B 行为等价测试】driver-a（纯块 + 配置A）vs driver-b（有状态块 + 配置B）。
 * ────────────────────────────────────────────────────────────
 * 覆盖设计 design.md 的两条 Correctness Property：
 *
 *   - Property 5（A/B 行为等价）：对任意输入序列（含 pedestrian 分叉），
 *     driver-a（调用方持状态，stepA 在配置A + 纯块上跑）与
 *     driver-b（StatefulRunner 在配置B + 有状态块上跑）产出的状态序列逐项相等。
 *     二者只差「状态归属」，不差行为——对比方公平。
 *
 *   - Property 6 + Error Handling（失败不前进，A/B 对称）：非法 input 经 A、B
 *     两路都抛错，且状态都不前进——抛错后再发一个合法 input，得到的下一状态
 *     必须与「非法 input 从未发生过」时一致（两侧均验证状态未前进）。
 *
 * 沿用 driver-a/driver-b 的配置读取约定（简化版 JSONC：只剥行注释后 JSON.parse）。
 *
 * Validates: Requirements 1.1, 2.1
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import type { FlowConfig } from "../../../engine/src/index.js";
import { stepA } from "../src/driver-a.js";
import { StatefulRunner } from "../src/driver-b.js";
import { createRegistryA, createRegistryB } from "../src/blocks/register.js";
import type { LightState, LightInput } from "../src/traffic-light.js";

// ── 配置读取（与 driver-a/driver-b 同款简化版 JSONC：只剥行注释）──────────
function loadConfig(path: string): FlowConfig {
  const raw = readFileSync(path, "utf-8");
  const stripped = raw.replace(/^\s*\/\/.*$/gm, "");
  return JSON.parse(stripped) as FlowConfig;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const configAPath = resolve(__dirname, "../src/configs/traffic-light-a.jsonc");
const configBPath = resolve(__dirname, "../src/configs/traffic-light-b.jsonc");

const configA = loadConfig(configAPath);
const configB = loadConfig(configBPath);

/** 经 driver-a 跑一段输入序列：调用方持状态，逐步 thread。返回状态序列。 */
function runViaA(initial: LightState, inputs: LightInput[]): LightState[] {
  const registry = createRegistryA();
  const trace: LightState[] = [];
  let state = initial;
  for (const input of inputs) {
    state = stepA(configA, registry, state, input);
    trace.push(state);
  }
  return trace;
}

/** 经 driver-b 跑一段输入序列：状态活在有状态块闭包内，调用方只发 input。返回状态序列。 */
function runViaB(initial: LightState, inputs: LightInput[]): LightState[] {
  const runner = new StatefulRunner(configB, createRegistryB(initial));
  return inputs.map((input) => runner.send(input));
}

const inputArb = fc.constantFrom<LightInput>("tick", "pedestrian");

describe("A/B 行为等价（Property 5）", () => {
  it("固定输入序列（含 pedestrian 分叉）：A 与 B 状态序列逐项相等", () => {
    const initial: LightState = "red";
    // red --tick--> green --tick--> green(驻留) --pedestrian--> yellow
    //   --tick--> red --pedestrian--> red --tick--> green
    const inputs: LightInput[] = [
      "tick",
      "tick",
      "pedestrian",
      "tick",
      "pedestrian",
      "tick",
    ];

    const traceA = runViaA(initial, inputs);
    const traceB = runViaB(initial, inputs);

    // 先确认序列确实经过了 pedestrian 分叉（green→yellow），避免空泛等价。
    expect(traceA).toEqual(["green", "green", "yellow", "red", "red", "green"]);
    expect(traceA).toEqual(traceB);
  });

  it("随机输入序列：A 与 B 状态序列恒逐项相等", () => {
    fc.assert(
      fc.property(
        fc.array(inputArb, { maxLength: 50 }),
        (inputs) => {
          const initial: LightState = "red";
          const traceA = runViaA(initial, inputs);
          const traceB = runViaB(initial, inputs);
          expect(traceA).toEqual(traceB);
        },
      ),
    );
  });
});

describe("失败不前进（Property 6 + Error Handling，A/B 对称）", () => {
  // 非法 input：枚举（tick/pedestrian）之外，由引擎 Ajv 在 execute 之前拦下。
  const illegal = "foo" as unknown as LightInput;

  it("方案 A：非法 input 抛错，且状态不前进", () => {
    const registry = createRegistryA();
    const state: LightState = "red";

    // 非法 input 必须抛错（assemble 返回 success:false → stepA 抛）。
    expect(() => stepA(configA, registry, state, illegal)).toThrow();

    // A 的状态由调用方持有：抛错后 state 变量未被改写，仍是 "red"。
    // 再发一个合法 tick，下一状态应与「非法从未发生」一致（red --tick--> green）。
    const next = stepA(configA, registry, state, "tick");
    expect(next).toBe("green");
  });

  it("方案 B：非法 input 抛错，且有状态块 current 不前进", () => {
    const runner = new StatefulRunner(configB, createRegistryB("red"));

    // 非法 input 必须抛错（块 execute 未运行）。
    expect(() => runner.send(illegal)).toThrow();

    // current 应仍停在 "red"：再发合法 tick 应得 green（red --tick--> green）。
    // 若非法 input 误前进了状态，这里会得到非 green 的结果。
    expect(runner.send("tick")).toBe("green");
  });

  it("A/B 对称：非法 input 后再发同一段合法序列，两路状态序列仍逐项相等", () => {
    const initial: LightState = "red";
    const legalTail: LightInput[] = ["tick", "pedestrian", "tick"];

    // A 路：先吃一个非法 input（抛错、state 不动），再跑合法尾段。
    const registryA = createRegistryA();
    let stateA: LightState = initial;
    expect(() => stepA(configA, registryA, stateA, illegal)).toThrow();
    const traceA: LightState[] = [];
    for (const input of legalTail) {
      stateA = stepA(configA, registryA, stateA, input);
      traceA.push(stateA);
    }

    // B 路：同样先吃一个非法 input（抛错、current 不动），再跑合法尾段。
    const runner = new StatefulRunner(configB, createRegistryB(initial));
    expect(() => runner.send(illegal)).toThrow();
    const traceB = legalTail.map((input) => runner.send(input));

    expect(traceA).toEqual(traceB);
  });
});
