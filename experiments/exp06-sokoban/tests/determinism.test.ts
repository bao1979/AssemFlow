/**
 * 走路纯块 move() 的确定性属性测试（fast-check）。
 *
 * 覆盖设计 design.md 的 Correctness Property 1（确定性）：
 *   随机合法关卡 + 随机方向序列，经 move 折叠跑两遍，网格序列必须逐项相等。
 *   （无时钟 / 无随机 / 无 AI——若块里偷读了非确定性来源，这条会失败。）
 *
 * Validates: Requirements 1.3
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { move } from "../src/blocks/move-step.js";
import type { Direction, GridState, Position } from "../src/grid.js";

const directionArb = fc.constantFrom<Direction>("up", "down", "left", "right");

/**
 * 合法网格生成器：角色总落在「非墙地板格」上（满足初始不变式）。
 * 做法：先枚举所有格 → 选一格当角色 → 墙从「其余格」里取子集（保证角色脚下不是墙）。
 */
const gridArb: fc.Arbitrary<GridState> = fc
  .record({ width: fc.integer({ min: 1, max: 8 }), height: fc.integer({ min: 1, max: 8 }) })
  .chain(({ width, height }) => {
    const allCells: Position[] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        allCells.push({ x, y });
      }
    }
    return fc.nat({ max: allCells.length - 1 }).chain((playerIdx) => {
      const player = allCells[playerIdx];
      const otherCells = allCells.filter((c) => !(c.x === player.x && c.y === player.y));
      return fc
        .subarray(otherCells)
        .map((walls) => ({ width, height, walls, player }) satisfies GridState);
    });
  });

/** 从初始网格出发，按方向序列逐步折叠，记录每步产出的网格序列。 */
function runSequence(initial: GridState, directions: Direction[]): GridState[] {
  const trace: GridState[] = [];
  let current = initial;
  for (const direction of directions) {
    current = move(current, direction);
    trace.push(current);
  }
  return trace;
}

describe("move · 确定性（Property 1）", () => {
  it("同一 (关卡, 方向序列) 跑两遍，网格序列逐项相等", () => {
    fc.assert(
      fc.property(gridArb, fc.array(directionArb, { maxLength: 50 }), (grid, directions) => {
        const runA = runSequence(grid, directions);
        const runB = runSequence(grid, directions);
        expect(runA).toEqual(runB);
      }),
    );
  });

  it("单步 move：同 (grid, direction) 多次调用结果恒等", () => {
    fc.assert(
      fc.property(gridArb, directionArb, (grid, direction) => {
        expect(move(grid, direction)).toEqual(move(grid, direction));
      }),
    );
  });
});
