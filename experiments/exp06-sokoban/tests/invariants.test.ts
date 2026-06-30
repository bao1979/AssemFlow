/**
 * 走路纯块 move() 的网格不变式属性测试（fast-check）。
 *
 * 覆盖设计 design.md 的 Correctness Property 3（网格不变式）：
 *   任意方向序列下，每回合后——
 *     - player 恒在 [0,width) × [0,height) 界内
 *     - player 坐标不与任何 walls 坐标重合
 *     - 静态地形 width/height/walls 跨回合恒定不变
 *
 * Validates: Requirements 1.4, 1.5
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { move } from "../src/blocks/move-step.js";
import type { Direction, GridState, Position } from "../src/grid.js";

const directionArb = fc.constantFrom<Direction>("up", "down", "left", "right");

/**
 * 合法网格生成器：角色总落在「非墙地板格」上（满足初始不变式，否则首回合前就违反）。
 * 先选一格当角色，墙从其余格里取子集——保证角色脚下不是墙。
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

const onWall = (p: Position, walls: readonly Position[]): boolean =>
  walls.some((w) => w.x === p.x && w.y === p.y);

describe("move · 网格不变式（Property 3）", () => {
  it("随机方向序列下，每回合后 player 在界内、不在墙上，静态地形不变", () => {
    fc.assert(
      fc.property(gridArb, fc.array(directionArb, { maxLength: 50 }), (initial, directions) => {
        let current = initial;
        for (const direction of directions) {
          current = move(current, direction);

          // player 在界内
          expect(current.player.x).toBeGreaterThanOrEqual(0);
          expect(current.player.x).toBeLessThan(current.width);
          expect(current.player.y).toBeGreaterThanOrEqual(0);
          expect(current.player.y).toBeLessThan(current.height);

          // player 不在墙上
          expect(onWall(current.player, current.walls)).toBe(false);

          // 静态地形跨回合不变
          expect(current.width).toBe(initial.width);
          expect(current.height).toBe(initial.height);
          expect(current.walls).toEqual(initial.walls);
        }
      }),
    );
  });
});
