// Feature: sokoban-mvp-2-push, Property 3: 网格不变式 + 箱子守恒（逐回合单次移动层）
// Feature: sokoban-mvp-2-push, Property 4: 推可走时前进
// Feature: sokoban-mvp-2-push, Property 5: 推不动时都停
// Feature: sokoban-mvp-2-push, Property 6: 走路（前方无箱）规则在扩展 GridState 上仍成立

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { moveWithPush } from "../src/blocks/move-with-push.js";
import type { Direction, GridState, Position } from "../src/grid.js";

// ── Helpers ──────────────────────────────────────────────────

const DELTA: Record<Direction, Position> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const directionArb = fc.constantFrom<Direction>("up", "down", "left", "right");

const posEq = (a: Position, b: Position) => a.x === b.x && a.y === b.y;

const hasPos = (arr: readonly Position[], p: Position) =>
  arr.some((a) => posEq(a, p));

const inBounds = (p: Position, w: number, h: number) =>
  p.x >= 0 && p.x < w && p.y >= 0 && p.y < h;

// ── Generators ───────────────────────────────────────────────

/**
 * 合法 GridState 生成器（含 boxes + goals）：
 *  1. 选 width/height (3-8)
 *  2. 随机选 player（一个格子）
 *  3. 从剩余格子里选 walls 子集
 *  4. 从剩余非墙格子里选 boxes 子集（不与 player 重合）
 *  5. goals 从所有非墙格子里取（可与 player/boxes 重合，符合 Sokoban 语义）
 */
const gridArb: fc.Arbitrary<GridState> = fc
  .record({ width: fc.integer({ min: 3, max: 8 }), height: fc.integer({ min: 3, max: 8 }) })
  .chain(({ width, height }) => {
    const allCells: Position[] = [];
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++)
        allCells.push({ x, y });

    return fc.nat({ max: allCells.length - 1 }).chain((playerIdx) => {
      const player = allCells[playerIdx];
      const nonPlayer = allCells.filter((c) => !posEq(c, player));

      return fc.subarray(nonPlayer, { minLength: 0, maxLength: Math.min(10, nonPlayer.length) }).chain((walls) => {
        const nonWallNonPlayer = nonPlayer.filter((c) => !hasPos(walls, c));
        const maxBoxes = Math.min(4, nonWallNonPlayer.length);
        return fc.subarray(nonWallNonPlayer, { minLength: 0, maxLength: maxBoxes }).chain((boxes) => {
          // goals can overlap with player or boxes (Sokoban semantics)
          const nonWall = allCells.filter((c) => !hasPos(walls, c));
          const maxGoals = Math.min(4, nonWall.length);
          return fc.subarray(nonWall, { minLength: 0, maxLength: maxGoals }).map((goals) => ({
            width, height, walls, goals, player, boxes,
          } satisfies GridState));
        });
      });
    });
  });

// ── Property 3: 网格不变式 + 箱子守恒（逐回合单次移动层）──────

describe("moveWithPush · Property 3: 网格不变式 + 箱子守恒", () => {
  it("单次移动后满足全部不变式", () => {
    fc.assert(
      fc.property(gridArb, directionArb, (grid, direction) => {
        const next = moveWithPush(grid, direction);

        // (a) player 在界内且不与 walls 重合
        expect(inBounds(next.player, next.width, next.height)).toBe(true);
        expect(hasPos(next.walls, next.player)).toBe(false);

        // (b) 每个 boxes[i] 在界内、不与 walls 重合、boxes 内部两两不重合
        for (const box of next.boxes) {
          expect(inBounds(box, next.width, next.height)).toBe(true);
          expect(hasPos(next.walls, box)).toBe(false);
        }
        for (let i = 0; i < next.boxes.length; i++) {
          for (let j = i + 1; j < next.boxes.length; j++) {
            expect(posEq(next.boxes[i], next.boxes[j])).toBe(false);
          }
        }

        // (c) 静态地形不变
        expect(next.width).toBe(grid.width);
        expect(next.height).toBe(grid.height);
        expect(next.walls).toEqual(grid.walls);
        expect(next.goals).toEqual(grid.goals);

        // (d) 箱子守恒
        expect(next.boxes.length).toBe(grid.boxes.length);

        // (e) player 不与任何箱同格
        expect(hasPos(next.boxes, next.player)).toBe(false);
      }),
      { numRuns: 200 },
    );
  });
});

// ── Property 4: 推可走时前进 ─────────────────────────────────

/**
 * 生成"人-箱-空"三联场景：
 *  - player at some position
 *  - box at player + delta (target)
 *  - behind box (player + 2*delta) in bounds, not wall, not box
 */
const pushSucceedsArb: fc.Arbitrary<{ grid: GridState; direction: Direction }> = fc
  .record({ width: fc.integer({ min: 4, max: 8 }), height: fc.integer({ min: 4, max: 8 }) })
  .chain(({ width, height }) => {
    return directionArb.chain((direction) => {
      const d = DELTA[direction];
      // player range: ensure player+delta and player+2*delta are in bounds
      const pxMin = Math.max(0, -d.x * 2);
      const pxMax = Math.min(width - 1, width - 1 - d.x * 2);
      const pyMin = Math.max(0, -d.y * 2);
      const pyMax = Math.min(height - 1, height - 1 - d.y * 2);

      if (pxMin > pxMax || pyMin > pyMax) {
        // impossible constraint, return a trivial case
        return fc.constant({
          grid: { width: 4, height: 4, walls: [], goals: [], player: { x: 1, y: 1 }, boxes: [{ x: 1 + d.x, y: 1 + d.y }] } as GridState,
          direction,
        });
      }

      return fc.record({
        px: fc.integer({ min: pxMin, max: pxMax }),
        py: fc.integer({ min: pyMin, max: pyMax }),
      }).chain(({ px, py }) => {
        const player: Position = { x: px, y: py };
        const target: Position = { x: px + d.x, y: py + d.y };
        const behind: Position = { x: px + d.x * 2, y: py + d.y * 2 };

        // walls: random subset of cells excluding player, target, behind
        const allCells: Position[] = [];
        for (let y = 0; y < height; y++)
          for (let x = 0; x < width; x++)
            allCells.push({ x, y });
        const wallCandidates = allCells.filter(
          (c) => !posEq(c, player) && !posEq(c, target) && !posEq(c, behind),
        );
        return fc.subarray(wallCandidates, { minLength: 0, maxLength: Math.min(6, wallCandidates.length) }).chain((walls) => {
          // extra boxes: not on player, target, behind, walls
          const boxCandidates = allCells.filter(
            (c) => !posEq(c, player) && !posEq(c, target) && !posEq(c, behind) && !hasPos(walls, c),
          );
          return fc.subarray(boxCandidates, { minLength: 0, maxLength: Math.min(3, boxCandidates.length) }).chain((extraBoxes) => {
            const boxes = [target, ...extraBoxes]; // target is the box to be pushed
            const nonWall = allCells.filter((c) => !hasPos(walls, c));
            return fc.subarray(nonWall, { minLength: 0, maxLength: Math.min(4, nonWall.length) }).map((goals) => ({
              grid: { width, height, walls, goals, player, boxes } as GridState,
              direction,
            }));
          });
        });
      });
    });
  });

describe("moveWithPush · Property 4: 推可走时前进", () => {
  it("人-箱-空三联时：玩家 = 原玩家 + Δ、该箱 = 原箱 + Δ、其余不变", () => {
    fc.assert(
      fc.property(pushSucceedsArb, ({ grid, direction }) => {
        const d = DELTA[direction];
        const target: Position = { x: grid.player.x + d.x, y: grid.player.y + d.y };
        const behind: Position = { x: target.x + d.x, y: target.y + d.y };
        const next = moveWithPush(grid, direction);

        // 玩家前进到 target
        expect(next.player).toEqual(target);

        // 被推箱子移动到 behind
        expect(hasPos(next.boxes, behind)).toBe(true);
        // 原 target 位置不再有箱子
        expect(hasPos(next.boxes, target)).toBe(false);

        // 其余 boxes 不变
        const otherOriginal = grid.boxes.filter((b) => !posEq(b, target));
        for (const ob of otherOriginal) {
          expect(hasPos(next.boxes, ob)).toBe(true);
        }

        // 静态地形不变
        expect(next.width).toBe(grid.width);
        expect(next.height).toBe(grid.height);
        expect(next.walls).toEqual(grid.walls);
        expect(next.goals).toEqual(grid.goals);
      }),
      { numRuns: 200 },
    );
  });
});

// ── Property 5: 推不动时都停 ─────────────────────────────────

/**
 * 生成推不动场景（三子情况）：
 *  (i) 箱后越界 (ii) 箱后在 walls (iii) 箱后在其他 boxes
 */
const pushFailsArb: fc.Arbitrary<{ grid: GridState; direction: Direction; reason: string }> = fc
  .record({ width: fc.integer({ min: 3, max: 8 }), height: fc.integer({ min: 3, max: 8 }) })
  .chain(({ width, height }) => {
    return directionArb.chain((direction) => {
      const d = DELTA[direction];
      return fc.constantFrom<"oob" | "wall" | "box">("oob", "wall", "box").chain((reason) => {
        if (reason === "oob") {
          // player at edge-1 so that target is at edge, behind is out of bounds
          // target = player + d is in bounds, behind = player + 2d is out of bounds
          let px: number, py: number;
          if (d.x === 1) { px = width - 2; py = 0; }       // right: target at width-1, behind at width (oob)
          else if (d.x === -1) { px = 1; py = 0; }          // left: target at 0, behind at -1 (oob)
          else if (d.y === 1) { px = 0; py = height - 2; }  // down: target at height-1, behind at height (oob)
          else { px = 0; py = 1; }                           // up: target at 0, behind at -1 (oob)

          const player: Position = { x: px, y: py };
          const target: Position = { x: px + d.x, y: py + d.y };
          return fc.constant({
            grid: { width, height, walls: [], goals: [], player, boxes: [target] } as GridState,
            direction,
            reason: "oob",
          });
        }

        if (reason === "wall") {
          // player + d = target (has box), player + 2d = behind (is a wall)
          // Ensure all three positions are in bounds
          const pxMin = Math.max(0, -d.x * 2);
          const pxMax = Math.min(width - 1, width - 1 - d.x * 2);
          const pyMin = Math.max(0, -d.y * 2);
          const pyMax = Math.min(height - 1, height - 1 - d.y * 2);
          if (pxMin > pxMax || pyMin > pyMax) {
            // fallback: use fixed size
            const player: Position = { x: 1, y: 1 };
            const target: Position = { x: 1 + d.x, y: 1 + d.y };
            const behind: Position = { x: 1 + d.x * 2, y: 1 + d.y * 2 };
            return fc.constant({
              grid: { width: 5, height: 5, walls: [behind], goals: [], player, boxes: [target] } as GridState,
              direction,
              reason: "wall",
            });
          }
          return fc.record({
            px: fc.integer({ min: pxMin, max: pxMax }),
            py: fc.integer({ min: pyMin, max: pyMax }),
          }).map(({ px, py }) => {
            const player: Position = { x: px, y: py };
            const target: Position = { x: px + d.x, y: py + d.y };
            const behind: Position = { x: px + d.x * 2, y: py + d.y * 2 };
            return {
              grid: { width, height, walls: [behind], goals: [], player, boxes: [target] } as GridState,
              direction,
              reason: "wall",
            };
          });
        }

        // reason === "box": behind has another box
        const pxMin = Math.max(0, -d.x * 2);
        const pxMax = Math.min(width - 1, width - 1 - d.x * 2);
        const pyMin = Math.max(0, -d.y * 2);
        const pyMax = Math.min(height - 1, height - 1 - d.y * 2);
        if (pxMin > pxMax || pyMin > pyMax) {
          const player: Position = { x: 1, y: 1 };
          const target: Position = { x: 1 + d.x, y: 1 + d.y };
          const behind: Position = { x: 1 + d.x * 2, y: 1 + d.y * 2 };
          return fc.constant({
            grid: { width: 5, height: 5, walls: [], goals: [], player, boxes: [target, behind] } as GridState,
            direction,
            reason: "box",
          });
        }
        return fc.record({
          px: fc.integer({ min: pxMin, max: pxMax }),
          py: fc.integer({ min: pyMin, max: pyMax }),
        }).map(({ px, py }) => {
          const player: Position = { x: px, y: py };
          const target: Position = { x: px + d.x, y: py + d.y };
          const behind: Position = { x: px + d.x * 2, y: py + d.y * 2 };
          return {
            grid: { width, height, walls: [], goals: [], player, boxes: [target, behind] } as GridState,
            direction,
            reason: "box",
          };
        });
      });
    });
  });

describe("moveWithPush · Property 5: 推不动时都停", () => {
  it("三子情况下玩家不动、boxes 集合不变、静态地形不变", () => {
    fc.assert(
      fc.property(pushFailsArb, ({ grid, direction }) => {
        const next = moveWithPush(grid, direction);

        // 玩家不动
        expect(next.player).toEqual(grid.player);

        // boxes 集合不变（顺序 + 内容）
        expect(next.boxes).toEqual(grid.boxes);

        // 静态地形不变
        expect(next.width).toBe(grid.width);
        expect(next.height).toBe(grid.height);
        expect(next.walls).toEqual(grid.walls);
        expect(next.goals).toEqual(grid.goals);
      }),
      { numRuns: 200 },
    );
  });
});

// ── Property 6: 走路（前方无箱）规则在扩展 GridState 上仍成立 ──

/**
 * 生成"前方无箱"的走路场景：
 *  Case A: target 不越界、不是墙、不是箱 → 玩家前进
 *  Case B: target 越界 or 是墙 → 玩家不动
 */
const walkOnExtendedArb: fc.Arbitrary<{ grid: GridState; direction: Direction; expectMove: boolean }> = fc
  .record({ width: fc.integer({ min: 3, max: 8 }), height: fc.integer({ min: 3, max: 8 }) })
  .chain(({ width, height }) => {
    return directionArb.chain((direction) => {
      const d = DELTA[direction];
      return fc.boolean().chain((expectMove): fc.Arbitrary<{ grid: GridState; direction: Direction; expectMove: boolean }> => {
        if (expectMove) {
          // Case A: target in bounds, not wall, not box → player moves
          const pxMin = Math.max(0, -d.x);
          const pxMax = Math.min(width - 1, width - 1 - d.x);
          const pyMin = Math.max(0, -d.y);
          const pyMax = Math.min(height - 1, height - 1 - d.y);
          if (pxMin > pxMax || pyMin > pyMax) {
            return fc.constant({
              grid: { width: 4, height: 4, walls: [], goals: [], player: { x: 1, y: 1 }, boxes: [] } as GridState,
              direction,
              expectMove: true,
            });
          }
          return fc.record({
            px: fc.integer({ min: pxMin, max: pxMax }),
            py: fc.integer({ min: pyMin, max: pyMax }),
          }).chain(({ px, py }) => {
            const player: Position = { x: px, y: py };
            const target: Position = { x: px + d.x, y: py + d.y };

            // walls: anywhere except player and target
            const allCells: Position[] = [];
            for (let y = 0; y < height; y++)
              for (let x = 0; x < width; x++)
                allCells.push({ x, y });
            const wallCandidates = allCells.filter(
              (c) => !posEq(c, player) && !posEq(c, target),
            );
            return fc.subarray(wallCandidates, { minLength: 0, maxLength: Math.min(5, wallCandidates.length) }).chain((walls) => {
              // boxes: anywhere except player, target, walls
              const boxCandidates = allCells.filter(
                (c) => !posEq(c, player) && !posEq(c, target) && !hasPos(walls, c),
              );
              return fc.subarray(boxCandidates, { minLength: 0, maxLength: Math.min(3, boxCandidates.length) }).map((boxes) => ({
                grid: { width, height, walls, goals: [], player, boxes } as GridState,
                direction,
                expectMove: true,
              }));
            });
          });
        } else {
          // Case B: target is out of bounds or is a wall → player stays
          return fc.boolean().chain((outOfBounds) => {
            if (outOfBounds) {
              // Place player at the edge so target is out of bounds
              let px: number, py: number;
              if (d.x === 1) { px = width - 1; py = 0; }
              else if (d.x === -1) { px = 0; py = 0; }
              else if (d.y === 1) { px = 0; py = height - 1; }
              else { px = 0; py = 0; }
              const player: Position = { x: px, y: py };

              // Some boxes elsewhere (not at player)
              const allCells: Position[] = [];
              for (let y = 0; y < height; y++)
                for (let x = 0; x < width; x++)
                  allCells.push({ x, y });
              const boxCandidates = allCells.filter((c) => !posEq(c, player));
              return fc.subarray(boxCandidates, { minLength: 0, maxLength: Math.min(2, boxCandidates.length) }).map((boxes) => ({
                grid: { width, height, walls: [], goals: [], player, boxes } as GridState,
                direction,
                expectMove: false,
              }));
            } else {
              // Place a wall at target (target must be in bounds)
              const pxMin = Math.max(0, -d.x);
              const pxMax = Math.min(width - 1, width - 1 - d.x);
              const pyMin = Math.max(0, -d.y);
              const pyMax = Math.min(height - 1, height - 1 - d.y);
              if (pxMin > pxMax || pyMin > pyMax) {
                return fc.constant({
                  grid: { width: 4, height: 4, walls: [{ x: 1, y: 0 }], goals: [], player: { x: 1, y: 1 }, boxes: [] } as GridState,
                  direction: "up" as Direction,
                  expectMove: false,
                });
              }
              return fc.record({
                px: fc.integer({ min: pxMin, max: pxMax }),
                py: fc.integer({ min: pyMin, max: pyMax }),
              }).map(({ px, py }) => {
                const player: Position = { x: px, y: py };
                const target: Position = { x: px + d.x, y: py + d.y };
                return {
                  grid: { width, height, walls: [target], goals: [], player, boxes: [] } as GridState,
                  direction,
                  expectMove: false,
                };
              });
            }
          });
        }
      });
    });
  });

describe("moveWithPush · Property 6: 走路（前方无箱）规则在扩展 GridState 上仍成立", () => {
  it("前方无箱无墙不越界 → 玩家前进一格；前方越界/是墙 → 玩家不动；boxes 不变、静态地形不变", () => {
    fc.assert(
      fc.property(walkOnExtendedArb, ({ grid, direction, expectMove }) => {
        const d = DELTA[direction];
        const next = moveWithPush(grid, direction);

        if (expectMove) {
          // 玩家前进一格
          expect(next.player).toEqual({ x: grid.player.x + d.x, y: grid.player.y + d.y });
        } else {
          // 玩家不动
          expect(next.player).toEqual(grid.player);
        }

        // boxes 不变
        expect(next.boxes).toEqual(grid.boxes);

        // 静态地形不变
        expect(next.width).toBe(grid.width);
        expect(next.height).toBe(grid.height);
        expect(next.walls).toEqual(grid.walls);
        expect(next.goals).toEqual(grid.goals);
      }),
      { numRuns: 200 },
    );
  });
});

// ── EDGE_CASE: 并排两箱 + 边界推 + 四方向覆盖 ────────────────

describe("moveWithPush · EDGE_CASE", () => {
  it("并排两箱（人-箱-箱-空）→ 都停", () => {
    // 4x1 grid: player at 0, box at 1, box at 2, empty at 3
    const grid: GridState = {
      width: 4, height: 1,
      walls: [], goals: [],
      player: { x: 0, y: 0 },
      boxes: [{ x: 1, y: 0 }, { x: 2, y: 0 }],
    };
    const next = moveWithPush(grid, "right");
    expect(next.player).toEqual(grid.player);
    expect(next.boxes).toEqual(grid.boxes);
  });

  it("边界向界外推（四方向）→ 都停", () => {
    const scenarios: { player: Position; box: Position; dir: Direction }[] = [
      { player: { x: 1, y: 1 }, box: { x: 1, y: 0 }, dir: "up" },     // box at top edge, push up → behind oob
      { player: { x: 1, y: 2 }, box: { x: 1, y: 3 }, dir: "down" },   // box at bottom edge (height=4), push down → behind oob
      { player: { x: 1, y: 1 }, box: { x: 0, y: 1 }, dir: "left" },   // box at left edge, push left → behind oob
      { player: { x: 2, y: 1 }, box: { x: 3, y: 1 }, dir: "right" },  // box at right edge (width=4), push right → behind oob
    ];
    for (const { player, box, dir } of scenarios) {
      const grid: GridState = {
        width: 4, height: 4,
        walls: [], goals: [],
        player,
        boxes: [box],
      };
      const next = moveWithPush(grid, dir);
      expect(next.player).toEqual(player);
      expect(next.boxes).toEqual(grid.boxes);
    }
  });

  it("地形（width/height/walls/goals）在所有操作后恒不变", () => {
    const grid: GridState = {
      width: 5, height: 5,
      walls: [{ x: 3, y: 3 }, { x: 4, y: 0 }],
      goals: [{ x: 2, y: 2 }],
      player: { x: 0, y: 0 },
      boxes: [{ x: 1, y: 0 }, { x: 0, y: 1 }],
    };
    const dirs: Direction[] = ["up", "down", "left", "right"];
    for (const dir of dirs) {
      const next = moveWithPush(grid, dir);
      expect(next.width).toBe(grid.width);
      expect(next.height).toBe(grid.height);
      expect(next.walls).toEqual(grid.walls);
      expect(next.goals).toEqual(grid.goals);
    }
  });

  it("四方向均可推箱子成功（覆盖每个方向的推箱路径）", () => {
    // 5x5 grid, player in center, box in each direction
    const center: Position = { x: 2, y: 2 };
    const dirs: Direction[] = ["up", "down", "left", "right"];
    for (const dir of dirs) {
      const d = DELTA[dir];
      const box: Position = { x: center.x + d.x, y: center.y + d.y };
      const behind: Position = { x: box.x + d.x, y: box.y + d.y };
      const grid: GridState = {
        width: 5, height: 5,
        walls: [], goals: [],
        player: center,
        boxes: [box],
      };
      const next = moveWithPush(grid, dir);
      // Push succeeds: player at box, box at behind
      expect(next.player).toEqual(box);
      expect(next.boxes).toEqual([behind]);
    }
  });
});
