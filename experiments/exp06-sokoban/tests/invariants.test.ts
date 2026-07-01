// Feature: sokoban-mvp-2-push, Property 3: 网格不变式 + 箱子守恒（方向序列层）
/**
 * 覆盖设计 design.md 的 Correctness Property 3（网格不变式 + 箱子守恒）：
 *   fast-check 随机方向序列，每回合后断言所有不变式：
 *     - player 在界内 [0, width) × [0, height)
 *     - player 不在墙上
 *     - boxes 每个都在界内
 *     - boxes 每个都不在墙上
 *     - boxes 坐标互不重叠（unique）
 *     - 静态地形 width / height / walls / goals 跨回合恒定不变
 *     - boxes 数量跨回合恒定（守恒）
 *     - player 不在任何 box 上
 *
 * 使用 moveWithPush 直接做序列层测试。
 *
 * Validates: Requirements 1.4, 1.5, 2.1
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { moveWithPush } from "../src/blocks/move-with-push.js";
import type { Direction, GridState, Position } from "../src/grid.js";

const directionArb = fc.constantFrom<Direction>("up", "down", "left", "right");

/**
 * 合法推箱网格生成器：
 *   - 玩家不在墙上、不与箱子重叠
 *   - 箱子不在墙上、箱子互不重叠
 *   - goals 数量 = boxes 数量
 */
const pushGridArb: fc.Arbitrary<GridState> = fc
  .record({ width: fc.integer({ min: 3, max: 7 }), height: fc.integer({ min: 3, max: 7 }) })
  .chain(({ width, height }) => {
    const allCells: Position[] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        allCells.push({ x, y });
      }
    }
    return fc.nat({ max: allCells.length - 1 }).chain((playerIdx) => {
      const player = allCells[playerIdx];
      const remaining = allCells.filter((c) => !(c.x === player.x && c.y === player.y));
      return fc.subarray(remaining, { maxLength: Math.min(remaining.length, 10) }).chain((walls) => {
        const nonWallNonPlayer = remaining.filter(
          (c) => !walls.some((w) => w.x === c.x && w.y === c.y),
        );
        const maxBoxes = Math.min(nonWallNonPlayer.length, 3);
        return fc.subarray(nonWallNonPlayer, { maxLength: maxBoxes }).chain((boxes) => {
          // Goals: pick from non-wall cells, count = boxes count
          const nonWallAll = allCells.filter(
            (c) => !walls.some((w) => w.x === c.x && w.y === c.y),
          );
          const goalCount = boxes.length;
          return fc
            .subarray(nonWallAll, { minLength: goalCount, maxLength: goalCount })
            .map((goals) => ({ width, height, walls, goals, player, boxes }) satisfies GridState);
        });
      });
    });
  });

// ── Helper ───────────────────────────────────────────────────

const posEq = (a: Position, b: Position): boolean => a.x === b.x && a.y === b.y;

function assertInvariants(current: GridState, initial: GridState): void {
  // 1. player 在界内
  expect(current.player.x).toBeGreaterThanOrEqual(0);
  expect(current.player.x).toBeLessThan(current.width);
  expect(current.player.y).toBeGreaterThanOrEqual(0);
  expect(current.player.y).toBeLessThan(current.height);

  // 2. player 不在墙上
  expect(current.walls.some((w) => posEq(w, current.player))).toBe(false);

  // 3. boxes 每个在界内
  for (const box of current.boxes) {
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x).toBeLessThan(current.width);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeLessThan(current.height);
  }

  // 4. boxes 每个不在墙上
  for (const box of current.boxes) {
    expect(current.walls.some((w) => posEq(w, box))).toBe(false);
  }

  // 5. boxes 坐标互不重叠
  const boxKeys = current.boxes.map((b) => `${b.x},${b.y}`);
  expect(new Set(boxKeys).size).toBe(boxKeys.length);

  // 6. 静态地形跨回合恒定不变
  expect(current.width).toBe(initial.width);
  expect(current.height).toBe(initial.height);
  expect(current.walls).toEqual(initial.walls);
  expect(current.goals).toEqual(initial.goals);

  // 7. boxes 数量守恒
  expect(current.boxes.length).toBe(initial.boxes.length);

  // 8. player 不在任何 box 上
  expect(current.boxes.some((b) => posEq(b, current.player))).toBe(false);
}

// ── Tests ────────────────────────────────────────────────────

describe("moveWithPush · 网格不变式 + 箱子守恒（Property 3，方向序列层）", () => {
  it("随机方向序列下，每回合后全部不变式成立", () => {
    fc.assert(
      fc.property(pushGridArb, fc.array(directionArb, { maxLength: 40 }), (initial, directions) => {
        let current = initial;
        for (const direction of directions) {
          current = moveWithPush(current, direction);
          assertInvariants(current, initial);
        }
      }),
      { numRuns: 300 },
    );
  });
});
