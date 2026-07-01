// Feature: sokoban-mvp-2-push, Property 7: 胜利判定 = 所有箱子在目标格

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { checkWin } from "../src/blocks/win-check.js";
import type { GridState, Position } from "../src/grid.js";

// ── Helpers ──────────────────────────────────────────────────

const posEq = (a: Position, b: Position) => a.x === b.x && a.y === b.y;

const hasPos = (arr: readonly Position[], p: Position) =>
  arr.some((a) => posEq(a, p));

// ── Generators ───────────────────────────────────────────────

/**
 * 合法 GridState 生成器（用于 Property 7）：
 *  - width/height 3-8
 *  - player 随机
 *  - walls 随机子集（不含 player）
 *  - boxes 随机子集（不含 player、不含 walls）
 *  - goals 数量 = boxes 数量（parseLevel 契约保证），从非墙格子里取
 *  - 含 0=0 边界（boxes=[] + goals=[] 合法特例）
 */
const gridWithEqualCountArb: fc.Arbitrary<GridState> = fc
  .record({ width: fc.integer({ min: 3, max: 8 }), height: fc.integer({ min: 3, max: 8 }) })
  .chain(({ width, height }) => {
    const allCells: Position[] = [];
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++)
        allCells.push({ x, y });

    return fc.nat({ max: allCells.length - 1 }).chain((playerIdx) => {
      const player = allCells[playerIdx];
      const nonPlayer = allCells.filter((c) => !posEq(c, player));

      return fc.subarray(nonPlayer, { minLength: 0, maxLength: Math.min(8, nonPlayer.length) }).chain((walls) => {
        const nonWallNonPlayer = nonPlayer.filter((c) => !hasPos(walls, c));
        const maxBoxes = Math.min(4, nonWallNonPlayer.length);
        return fc.integer({ min: 0, max: maxBoxes }).chain((boxCount) => {
          return fc.subarray(nonWallNonPlayer, { minLength: boxCount, maxLength: boxCount }).chain((boxes) => {
            // goals: same count as boxes, from non-wall cells (can overlap with player or boxes)
            const nonWall = allCells.filter((c) => !hasPos(walls, c));
            if (nonWall.length < boxCount) {
              // fallback: no goals possible, use empty
              return fc.constant({
                width, height, walls, goals: [], player, boxes: [],
              } satisfies GridState);
            }
            return fc.subarray(nonWall, { minLength: boxCount, maxLength: boxCount }).map((goals) => ({
              width, height, walls, goals, player, boxes,
            } satisfies GridState));
          });
        });
      });
    });
  });

// ── Property 7: 胜利判定 = 所有箱子在目标格 ───────────────────

describe("checkWin · Property 7: 胜利判定 = 所有箱子在目标格", () => {
  it("checkWin(grid) === true 当且仅当每个箱子坐标都能在 goals 里找到匹配", () => {
    fc.assert(
      fc.property(gridWithEqualCountArb, (grid) => {
        const result = checkWin(grid);

        // 独立计算等价条件
        const allBoxesOnGoals = grid.boxes.every((b) =>
          grid.goals.some((g) => g.x === b.x && g.y === b.y),
        );

        expect(result).toBe(allBoxesOnGoals);
      }),
      { numRuns: 200 },
    );
  });

  /**
   * Validates: Requirements 2.1
   * 补充：特别验证 0=0 边界（空 boxes + 空 goals）→ checkWin 返回 true
   * （vacuously true：所有箱子（无箱子）都在目标格上）
   */
  it("0=0 边界：空 boxes + 空 goals → true（vacuously true）", () => {
    fc.assert(
      fc.property(
        fc.record({ width: fc.integer({ min: 3, max: 8 }), height: fc.integer({ min: 3, max: 8 }) }),
        ({ width, height }) => {
          const grid: GridState = {
            width, height,
            walls: [],
            goals: [],
            player: { x: 0, y: 0 },
            boxes: [],
          };
          expect(checkWin(grid)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ── EXAMPLE: 具体例子 ────────────────────────────────────────

describe("checkWin · EXAMPLE", () => {
  it("全在目标 → true", () => {
    const grid: GridState = {
      width: 5, height: 5,
      walls: [{ x: 0, y: 0 }],
      goals: [{ x: 2, y: 2 }, { x: 3, y: 3 }],
      player: { x: 1, y: 1 },
      boxes: [{ x: 2, y: 2 }, { x: 3, y: 3 }],
    };
    expect(checkWin(grid)).toBe(true);
  });

  it("差一个 → false", () => {
    const grid: GridState = {
      width: 5, height: 5,
      walls: [],
      goals: [{ x: 2, y: 2 }, { x: 3, y: 3 }],
      player: { x: 0, y: 0 },
      boxes: [{ x: 2, y: 2 }, { x: 4, y: 4 }], // 第二个箱子不在目标
    };
    expect(checkWin(grid)).toBe(false);
  });

  it("空 boxes（0=0 特例）→ true", () => {
    const grid: GridState = {
      width: 3, height: 3,
      walls: [],
      goals: [],
      player: { x: 1, y: 1 },
      boxes: [],
    };
    expect(checkWin(grid)).toBe(true);
  });

  it("boxes 和 goals 数量相等但位置不完全匹配 → false", () => {
    const grid: GridState = {
      width: 5, height: 5,
      walls: [],
      goals: [{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }],
      player: { x: 0, y: 0 },
      boxes: [{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 4, y: 4 }],
    };
    expect(checkWin(grid)).toBe(false);
  });

  it("多个箱子全部就位（顺序不同）→ true", () => {
    const grid: GridState = {
      width: 5, height: 5,
      walls: [],
      goals: [{ x: 1, y: 1 }, { x: 3, y: 3 }, { x: 2, y: 4 }],
      player: { x: 0, y: 0 },
      // boxes 与 goals 坐标相同但顺序不同
      boxes: [{ x: 3, y: 3 }, { x: 2, y: 4 }, { x: 1, y: 1 }],
    };
    expect(checkWin(grid)).toBe(true);
  });
});
