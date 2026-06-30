/**
 * 【装配流端到端测试】tests/assemble-walk.test.ts
 * ────────────────────────────────────────────────────────────
 * 验证走路逻辑在引擎上贯通（Requirements 1.2 / 1.6）：
 *   1. 端到端：assemble(walk.jsonc, registry, {grid, direction}) 返回 success:true，
 *      且 context.nextGrid 正确（地板→移动、撞墙/越界→停原格）。
 *   2. stepWalk 驱动：薄封装从 context 取出 nextGrid，与直接 assemble 一致。
 *   3. Property 5（方案 A 块保持纯）：复用同一 move-step 块/注册表跨多回合，
 *      行为只依赖当回合输入 {grid, direction}，块不持有跨回合状态。
 *
 * 测试用真实的 walk.jsonc 配置（剥行注释后 JSON.parse），保持诚实——
 * 不在 TS 里另造一份配置对象，避免与配置源漂移。
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { assemble, type FlowConfig } from "../../../engine/src/index.js";
import { createWalkRegistry } from "../src/blocks/move-step.js";
import { stepWalk } from "../src/driver.js";
import { parseLevel, type GridState } from "../src/grid.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = resolve(__dirname, "../src/configs/walk.jsonc");

/** 读真实 walk.jsonc：剥行注释后 JSON.parse（与 exp01 同法，保持诚实）。 */
function loadWalkConfig(): FlowConfig {
  const raw = readFileSync(CONFIG_PATH, "utf-8");
  const stripped = raw.replace(/^\s*\/\/.*$/gm, "");
  return JSON.parse(stripped) as FlowConfig;
}

// 单关：4×4 边框墙，角色初始在 (1,1)，内部 (1,1)/(2,1)/(1,2)/(2,2) 是地板。
//   #####
//   #@..#
//   #...#
//   #####
const LEVEL = ["#####", "#@..#", "#...#", "#####"].join("\n");

describe("装配流端到端：assemble(walk.jsonc) 走路 (R1.2 / R1.6)", () => {
  it("地板方向：assemble 成功，context.nextGrid 把角色移到目标格", () => {
    const config = loadWalkConfig();
    const registry = createWalkRegistry();
    const grid = parseLevel(LEVEL);
    expect(grid.player).toEqual({ x: 1, y: 1 });

    const result = assemble(config, registry, { grid, direction: "right" });

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    const nextGrid = result.context["nextGrid"] as GridState;
    expect(nextGrid.player).toEqual({ x: 2, y: 1 });
    // 静态地形原样带出
    expect(nextGrid.width).toBe(grid.width);
    expect(nextGrid.height).toBe(grid.height);
    expect(nextGrid.walls).toEqual(grid.walls);
  });

  it("撞墙方向：assemble 成功（撞墙非错误），角色停在原格", () => {
    const config = loadWalkConfig();
    const registry = createWalkRegistry();
    const grid = parseLevel(LEVEL); // player (1,1)，左/上都是边框墙

    const left = assemble(config, registry, { grid, direction: "left" });
    expect(left.success).toBe(true);
    expect((left.context["nextGrid"] as GridState).player).toEqual({ x: 1, y: 1 });

    const up = assemble(config, registry, { grid, direction: "up" });
    expect(up.success).toBe(true);
    expect((up.context["nextGrid"] as GridState).player).toEqual({ x: 1, y: 1 });
  });

  it("stepWalk 驱动：从 context 取出 nextGrid，与直接 assemble 取值一致", () => {
    const config = loadWalkConfig();
    const registry = createWalkRegistry();
    const grid = parseLevel(LEVEL);

    const viaStep = stepWalk(config, registry, grid, "down");
    const viaAssemble = assemble(config, registry, { grid, direction: "down" });

    expect(viaStep).toEqual(viaAssemble.context["nextGrid"]);
    expect(viaStep.player).toEqual({ x: 1, y: 2 });
  });
});

describe("Property 5：方案 A 块保持纯——复用同块跨多回合，行为只依赖当回合输入", () => {
  // **Validates: Requirements 1.6**
  // **Validates: Requirements 1.2**

  it("复用同一 registry/config 跑一串回合，每回合输出只由当回合 {grid, direction} 决定", () => {
    const config = loadWalkConfig();
    const registry = createWalkRegistry(); // 同一块实例，全程复用

    // 调用方持 grid，逐回合推进（外部主循环的回合序列）
    let grid = parseLevel(LEVEL); // (1,1)
    grid = stepWalk(config, registry, grid, "right"); // (2,1)
    expect(grid.player).toEqual({ x: 2, y: 1 });
    grid = stepWalk(config, registry, grid, "down"); // (2,2)
    expect(grid.player).toEqual({ x: 2, y: 2 });
    grid = stepWalk(config, registry, grid, "left"); // (1,2)
    expect(grid.player).toEqual({ x: 1, y: 2 });

    // 关键断言：跑完上面这串回合后，拿"初始网格 + right"再喂同一个复用的 registry，
    // 结果必须和第一回合完全一致——块不携带任何跨回合记忆（无残留状态）。
    const fresh = parseLevel(LEVEL);
    const replay = stepWalk(config, registry, fresh, "right");
    expect(replay.player).toEqual({ x: 2, y: 1 });
  });

  it("同一块同输入多次调用恒等；不同回合互不影响（无累积状态）", () => {
    const config = loadWalkConfig();
    const registry = createWalkRegistry();
    const grid = parseLevel(LEVEL);

    // 同输入连调多次：结果逐次相等（块无副作用、无记忆）
    const a = stepWalk(config, registry, grid, "right");
    const b = stepWalk(config, registry, grid, "right");
    const c = stepWalk(config, registry, grid, "right");
    expect(a).toEqual(b);
    expect(b).toEqual(c);

    // 交错喂入不同的当回合输入：每次输出只由当次输入决定，与历史无关。
    // 先用一个"已右移"的网格喂 down，再用原始网格喂 right，
    // 后者结果必须仍等于"原始网格 + right"的孤立结果。
    const moved = stepWalk(config, registry, grid, "right"); // (2,1)
    stepWalk(config, registry, moved, "down"); // 制造一段历史，不取结果
    const again = stepWalk(config, registry, grid, "right"); // 仍喂原始网格
    expect(again).toEqual(a);
  });
});
