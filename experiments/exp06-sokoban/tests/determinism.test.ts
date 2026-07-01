// Feature: sokoban-mvp-2-push, Property 2: 一回合确定性 + 块无残留状态（方案 A 纯性）
/**
 * 覆盖设计 design.md 的 Correctness Property 2（一回合确定性 + 块无残留状态）：
 *   (a) 同 (grid, direction) 跑两遍 stepPush，两次 (nextGrid, won) 逐项相等
 *   (b) 交叉输入：stepPush(cfg, reg, gridA, d) → 保存 → 中间穿插 stepPush(cfg, reg, gridB, d)
 *       → 再次 stepPush(cfg, reg, gridA, d)，前后两次 gridA 的结果恒等
 *   (c) 无时钟 / 无随机 / 无 AI——上述在任意机器 / 时间点跑均成立
 *
 * Validates: Requirements 2.1
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
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

// ── Arbitraries ──────────────────────────────────────────────

const directionArb = fc.constantFrom<Direction>("up", "down", "left", "right");

/**
 * 合法推箱网格生成器：
 *   - 玩家不在墙上、不在箱子上
 *   - 箱子不在墙上、箱子互不重叠
 *   - goals 数量 = boxes 数量
 *   - goals 不在墙上
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
    // Pick player position first
    return fc.nat({ max: allCells.length - 1 }).chain((playerIdx) => {
      const player = allCells[playerIdx];
      const remaining = allCells.filter((c) => !(c.x === player.x && c.y === player.y));
      // Pick walls from remaining
      return fc.subarray(remaining, { maxLength: Math.min(remaining.length, 10) }).chain((walls) => {
        const nonWall = remaining.filter(
          (c) => !walls.some((w) => w.x === c.x && w.y === c.y),
        );
        // Pick boxes from non-wall cells (also not player)
        const maxBoxes = Math.min(nonWall.length, 3);
        return fc.subarray(nonWall, { maxLength: maxBoxes }).chain((boxes) => {
          // Pick goals from non-wall cells (excluding boxes count restriction)
          const nonWallCells = allCells.filter(
            (c) =>
              !walls.some((w) => w.x === c.x && w.y === c.y) &&
              !(c.x === player.x && c.y === player.y),
          );
          // Goals count must equal boxes count; pick from nonWallCells
          const goalCount = boxes.length;
          return fc
            .subarray(nonWallCells, { minLength: goalCount, maxLength: goalCount })
            .map((goals) => ({ width, height, walls, goals, player, boxes }) satisfies GridState);
        });
      });
    });
  });

// ── Tests ────────────────────────────────────────────────────

describe("stepPush · 一回合确定性（Property 2）", () => {
  it("(a) 同 (grid, direction) 跑两遍 stepPush，两次 (nextGrid, won) 逐项相等", () => {
    fc.assert(
      fc.property(pushGridArb, directionArb, (grid, direction) => {
        const resultA: PushResult = stepPush(pushConfig, registry, grid, direction);
        const resultB: PushResult = stepPush(pushConfig, registry, grid, direction);
        expect(resultA.nextGrid).toEqual(resultB.nextGrid);
        expect(resultA.won).toBe(resultB.won);
      }),
      { numRuns: 200 },
    );
  });

  it("(b) 交叉输入：中间穿插另一网格不影响先前网格的确定性", () => {
    fc.assert(
      fc.property(pushGridArb, pushGridArb, directionArb, (gridA, gridB, direction) => {
        // 第一次对 gridA 执行
        const firstA: PushResult = stepPush(pushConfig, registry, gridA, direction);
        // 中间穿插 gridB 执行
        stepPush(pushConfig, registry, gridB, direction);
        // 第二次对 gridA 执行
        const secondA: PushResult = stepPush(pushConfig, registry, gridA, direction);
        // 前后两次 gridA 结果必须恒等
        expect(firstA.nextGrid).toEqual(secondA.nextGrid);
        expect(firstA.won).toBe(secondA.won);
      }),
      { numRuns: 200 },
    );
  });

  it("(c) 无时钟/无随机/无AI——结果只由 (config, registry, grid, direction) 决定", () => {
    // 跑多次，每次之间穿插时间间隔（逻辑上验证——若块内读了 Date.now() 会偶尔碰撞）
    fc.assert(
      fc.property(pushGridArb, directionArb, (grid, direction) => {
        const results: PushResult[] = [];
        for (let i = 0; i < 5; i++) {
          results.push(stepPush(pushConfig, registry, grid, direction));
        }
        // 所有结果必须一致
        for (let i = 1; i < results.length; i++) {
          expect(results[i].nextGrid).toEqual(results[0].nextGrid);
          expect(results[i].won).toBe(results[0].won);
        }
      }),
      { numRuns: 100 },
    );
  });
});
