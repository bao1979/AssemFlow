/**
 * 【共享测试生成器】tests/generators.ts —— 测试内部工具、非产品代码
 * ────────────────────────────────────────────────────────────
 * 导出 arbLegalLevel(): fc.Arbitrary<...>
 * 生成"完全合法且边界闭合"的 Sokoban ASCII 关卡文本，作为 Property 2–5 的 baseline。
 *
 * SSOT · 铁律 2 在测试层的落实：所有 Property 2-5 都从 arbLegalLevel map 派生扰动，
 * "合法关的定义"只有一处真相。
 *
 * 生成约束：
 *   - 恰一玩家
 *   - 箱数 = 目标数（允许 0=0）
 *   - 字符仅在合法集内
 *   - 外圈墙形成 flood-fill 意义上的闭合区域
 *   - 每份关卡至少 3×3、上限可配置（默认 8×8，避免生成过慢）
 */

import * as fc from "fast-check";
import type { Position } from "../src/scan-ascii.js";

// ── 类型 ──────────────────────────────────────────────────────

export interface LegalLevelMeta {
  readonly width: number;
  readonly height: number;
  readonly playerPos: Position;
  readonly boxes: Position[];
  readonly goals: Position[];
  readonly walls: Position[];
}

export interface LegalLevel {
  readonly text: string;
  readonly meta: LegalLevelMeta;
}

// ── 生成器 ──────────────────────────────────────────────────────

/**
 * 生成完全合法且边界闭合的 Sokoban ASCII 关卡。
 *
 * 策略：
 *   - 外圈全墙保证 flood-fill 不泄漏
 *   - 内部随机放置玩家、箱子、目标（互不重叠）
 *   - 箱数 = 目标数（含 0=0）
 *   - 恰一玩家（'@'，放在非目标格；不使用 '+' 简化生成逻辑）
 *
 * @param maxWidth 最大宽度（含外圈），默认 8
 * @param maxHeight 最大高度（含外圈），默认 8
 */
export function arbLegalLevel(maxWidth = 8, maxHeight = 8): fc.Arbitrary<LegalLevel> {
  return fc.tuple(
    fc.integer({ min: 3, max: maxWidth }),   // width（含外圈）
    fc.integer({ min: 3, max: maxHeight }),  // height（含外圈）
    fc.integer({ min: 0, max: 4 }),          // boxCount = goalCount
  ).chain(([width, height, boxCount]) => {
    const innerW = width - 2;
    const innerH = height - 2;
    const innerTotal = innerW * innerH;

    // 需要的格子数：1 个玩家 + boxCount 个箱子 + boxCount 个目标（都不重叠）
    const neededSlots = 1 + boxCount + boxCount;

    // 如果内部格子不够，降级到 0 箱 0 目标（仅玩家）
    const actualBoxCount = neededSlots <= innerTotal ? boxCount : 0;
    const actualNeeded = 1 + actualBoxCount * 2;

    return fc.shuffledSubarray(
      Array.from({ length: innerTotal }, (_, i) => i),
      { minLength: actualNeeded, maxLength: actualNeeded },
    ).map((slots) => {
      // 把 flat index 转成内部坐标（+1 偏移因为外圈墙）
      const toPos = (flatIdx: number): Position => ({
        x: (flatIdx % innerW) + 1,
        y: Math.floor(flatIdx / innerW) + 1,
      });

      const playerPos = toPos(slots[0]);
      const boxPositions = slots.slice(1, 1 + actualBoxCount).map(toPos);
      const goalPositions = slots.slice(1 + actualBoxCount, 1 + actualBoxCount * 2).map(toPos);

      // 构建网格：外圈全墙，内部按分配放置
      const grid: string[][] = [];

      // 顶行全墙
      grid.push(Array(width).fill("#"));

      // 中间行
      for (let y = 1; y < height - 1; y++) {
        const row = Array(width).fill(" ");
        row[0] = "#";
        row[width - 1] = "#";
        grid.push(row);
      }

      // 底行全墙
      grid.push(Array(width).fill("#"));

      // 放置玩家
      grid[playerPos.y][playerPos.x] = "@";

      // 放置箱子
      for (const pos of boxPositions) {
        grid[pos.y][pos.x] = "$";
      }

      // 放置目标
      for (const pos of goalPositions) {
        grid[pos.y][pos.x] = ".";
      }

      // 收集墙坐标
      const walls: Position[] = [];
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (grid[y][x] === "#") {
            walls.push({ x, y });
          }
        }
      }

      const text = grid.map((row) => row.join("")).join("\n");

      return {
        text,
        meta: {
          width,
          height,
          playerPos,
          boxes: boxPositions,
          goals: goalPositions,
          walls,
        },
      };
    });
  });
}
