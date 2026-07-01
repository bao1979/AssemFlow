// Feature: sokoban-mvp-2-push, EXAMPLE: assemble-push 端到端（含通关一步）
/**
 * 端到端测试：加载 push.jsonc + createPushRegistry，构造一个 2-box 2-goal 小地图，
 * 通过 stepPush 驱动一段完整解法序列直到 won=true。
 * 每步断言 nextGrid 和 won 符合预期。
 *
 * 地图（ASCII）:
 *   ########
 *   #. @$$.#
 *   ########
 *
 * 解析后：
 *   width=8, height=3
 *   walls: 边框（top row, bottom row, (0,1), (7,1)）
 *   goals: (1,1), (6,1)
 *   player: (3,1)
 *   boxes: (4,1), (5,1)
 *
 * 解法：先向左走到 (2,1)，再向左走到 (1,1)... 不对，需要推箱子到目标格。
 * 重新设计：玩家在两个箱子中间是不可能同时推两个方向的。
 *
 * 更好的地图：
 *   #######
 *   #.$ @$#
 *   #  . .#
 *   #######
 *
 * 太复杂。用最简单的直线通道两步解法：
 *
 *   Level:
 *     #######
 *     #..$@.#
 *     #######
 *
 *   goals: (1,1), (5,1)
 *   boxes: (2,1), (3,1)
 *   player: (4,1)
 *
 *   Step 1: push left → player(3,1), boxes move: box@(3,1)→(2,1) can't (box@(2,1) behind)
 *   Hmm adjacent boxes can't be pushed together.
 *
 * Simplest solvable: single-axis, boxes separated.
 *
 *   Level (constructed as GridState directly):
 *     width=7, height=3
 *     walls: border
 *     goals: (1,1), (5,1)
 *     player: (3,1)
 *     boxes: (2,1), (4,1)
 *
 *   Solve:
 *     Step 1: push left → player(2,1), box(2,1)→(1,1). boxes: [(1,1), (4,1)]
 *     Step 2: push right (from (2,1)) → player(3,1), no box there. Just walk.
 *     Step 3: push right (from (3,1)) → player(4,1), box(4,1)→(5,1). boxes: [(1,1), (5,1)]
 *     After step 3: both boxes on goals → won!
 *
 *   Actually step sequence: left, right, right, right
 *     Step 1 (left): player@(3,1) → target(2,1) has box → behind(1,1) no box, no wall(wait, (1,1) is goal not wall)
 *       → push! player→(2,1), box (2,1)→(1,1). Boxes: [(1,1), (4,1)]
 *     Step 2 (right): player@(2,1) → target(3,1) empty → walk. Player→(3,1)
 *     Step 3 (right): player@(3,1) → target(4,1) has box → behind(5,1) no box, not wall
 *       → push! player→(4,1), box (4,1)→(5,1). Boxes: [(1,1), (5,1)]
 *     Both boxes on goals → won = true!
 *
 * Validates: Requirements 2.1, 2.2
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { parseJsonc } from "../src/jsonc.js";
import { stepPush, type PushResult } from "../src/driver.js";
import { createPushRegistry } from "../src/blocks/register.js";
import type { Direction, GridState, Position } from "../src/grid.js";
import type { FlowConfig, BlockRegistry } from "../../../engine/src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pushConfig: FlowConfig = parseJsonc<FlowConfig>(
  readFileSync(resolve(__dirname, "../src/configs/push.jsonc"), "utf-8"),
);
const registry: BlockRegistry = createPushRegistry();

// ── Test Level ───────────────────────────────────────────────

/** 7×3 直线通道，2 箱 2 目标，箱子分居玩家两侧。 */
function makeTestLevel(): GridState {
  const width = 7;
  const height = 3;

  // Border walls
  const walls: Position[] = [];
  for (let x = 0; x < width; x++) {
    walls.push({ x, y: 0 }); // top
    walls.push({ x, y: 2 }); // bottom
  }
  walls.push({ x: 0, y: 1 }); // left wall
  walls.push({ x: 6, y: 1 }); // right wall

  return {
    width,
    height,
    walls,
    goals: [{ x: 1, y: 1 }, { x: 5, y: 1 }],
    player: { x: 3, y: 1 },
    boxes: [{ x: 2, y: 1 }, { x: 4, y: 1 }],
  };
}

// ── Tests ────────────────────────────────────────────────────

describe("assemble-push 端到端", () => {
  it("2-box 2-goal 直线通道完整解法：3 步通关", () => {
    let grid = makeTestLevel();

    // Step 1: push left → box at (2,1) → (1,1), player → (2,1)
    const step1: PushResult = stepPush(pushConfig, registry, grid, "left");
    expect(step1.won).toBe(false);
    expect(step1.nextGrid.player).toEqual({ x: 2, y: 1 });
    expect(step1.nextGrid.boxes).toContainEqual({ x: 1, y: 1 });
    expect(step1.nextGrid.boxes).toContainEqual({ x: 4, y: 1 });
    grid = step1.nextGrid;

    // Step 2: walk right → player (2,1) → (3,1), no box at (3,1)
    const step2: PushResult = stepPush(pushConfig, registry, grid, "right");
    expect(step2.won).toBe(false);
    expect(step2.nextGrid.player).toEqual({ x: 3, y: 1 });
    // Boxes unchanged
    expect(step2.nextGrid.boxes).toContainEqual({ x: 1, y: 1 });
    expect(step2.nextGrid.boxes).toContainEqual({ x: 4, y: 1 });
    grid = step2.nextGrid;

    // Step 3: push right → box at (4,1) → (5,1), player → (4,1)
    const step3: PushResult = stepPush(pushConfig, registry, grid, "right");
    expect(step3.nextGrid.player).toEqual({ x: 4, y: 1 });
    expect(step3.nextGrid.boxes).toContainEqual({ x: 1, y: 1 });
    expect(step3.nextGrid.boxes).toContainEqual({ x: 5, y: 1 });
    // Both boxes on goals → won!
    expect(step3.won).toBe(true);
  });

  it("通关前每步 won 均为 false", () => {
    let grid = makeTestLevel();
    const preSolve: Direction[] = ["left", "right"];

    for (const dir of preSolve) {
      const result = stepPush(pushConfig, registry, grid, dir);
      expect(result.won).toBe(false);
      grid = result.nextGrid;
    }
  });

  it("静态地形在解法全程不变", () => {
    const initial = makeTestLevel();
    let grid = initial;
    const sequence: Direction[] = ["left", "right", "right"];

    for (const dir of sequence) {
      const result = stepPush(pushConfig, registry, grid, dir);
      expect(result.nextGrid.width).toBe(initial.width);
      expect(result.nextGrid.height).toBe(initial.height);
      expect(result.nextGrid.walls).toEqual(initial.walls);
      expect(result.nextGrid.goals).toEqual(initial.goals);
      grid = result.nextGrid;
    }
  });
});
