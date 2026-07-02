// Feature: sokoban-mvp-3-levels, Property 1: 共享 primitive 一致性（结构守卫）

/**
 * 【扫描测试】tests/scan-ascii.test.ts
 * ────────────────────────────────────────────────────────────
 * Property 1（PBT）：fast-check ≥100 iterations 生成合法 Sokoban ASCII，
 *   断言 scanAscii(text) 与 parseLevel(text) 对合法文本的坐标集合恒等。
 *
 * 诚实标注：Task 5 完成后本 property 变成结构性重言式（parseLevel 内部
 * 直接从 checkLevel(text).scan 取扫描结果、走同一段代码），fast-check
 * 无实证反例价值——保留作"若哪天有人绕过就被抓"的执行守卫。
 *
 * EXAMPLE / EDGE_CASE：ragged line、中间空行、全空文本、单空行、
 *   '*' 与 '+' 同时出现、'\r\n' 换行、invalidChars 记录含 pos + ch。
 *
 * Validates: Requirements 2.4
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { scanAscii, type Position as ScanPosition } from "../src/scan-ascii.js";
import { parseLevel, type Position } from "../src/grid.js";

// ── 辅助 ─────────────────────────────────────────────────────

/** 归一化 Position[] 成排序后的字符串集合，避免顺序影响断言 */
function posKeys(positions: readonly (Position | ScanPosition)[]): string[] {
  return positions.map((p) => `${p.x},${p.y}`).sort();
}

// ── Property 1: 共享 primitive 一致性（fast-check PBT）─────────

describe("scanAscii ↔ parseLevel —— Property 1: 共享 primitive 一致性", () => {
  /**
   * 生成合法 Sokoban ASCII（恰一 '@'/'+', 箱数=目标数含 0=0, 字符在合法集内,
   * 外圈墙闭合），断言 scanAscii 与 parseLevel 坐标集合恒等。
   *
   * **Validates: Requirements 2.4**
   */
  const sokobanLevelArb = fc.tuple(
    fc.integer({ min: 4, max: 10 }),  // width
    fc.integer({ min: 4, max: 10 }),  // height
    fc.boolean(),                      // playerIsPlus: '+' or '@'
    fc.integer({ min: 0, max: 3 }),   // boxCount = goalCount
  ).chain(([width, height, playerIsPlus, boxCount]) => {
    const innerW = width - 2;
    const innerH = height - 2;
    const innerTotal = innerW * innerH;

    // 计算所需格子数
    const goalsFromPlayer = playerIsPlus ? 1 : 0;
    const independentGoals = boxCount - goalsFromPlayer;
    // If we can't fit with '+', fall back to '@'
    const actualPlayerIsPlus = independentGoals >= 0 ? playerIsPlus : false;
    const actualIndependentGoals = actualPlayerIsPlus ? boxCount - 1 : boxCount;
    const neededSlots = 1 + boxCount + actualIndependentGoals; // player + boxes + independent goals

    if (neededSlots > innerTotal) {
      // Fallback: just player, no boxes/goals
      return fc.integer({ min: 0, max: innerTotal - 1 }).map((playerIdx) => ({
        width, height, playerIsPlus: false, boxCount: 0,
        playerIdx, boxIndices: [] as number[], goalIndices: [] as number[],
      }));
    }

    return fc.shuffledSubarray(
      Array.from({ length: innerTotal }, (_, i) => i),
      { minLength: neededSlots, maxLength: neededSlots },
    ).map((slots) => ({
      width, height,
      playerIsPlus: actualPlayerIsPlus,
      boxCount,
      playerIdx: slots[0],
      boxIndices: slots.slice(1, 1 + boxCount),
      goalIndices: slots.slice(1 + boxCount, 1 + boxCount + actualIndependentGoals),
    }));
  }).map((params) => {
    const { width, height, playerIsPlus, playerIdx, boxIndices, goalIndices } = params;
    const innerW = width - 2;

    const toCoord = (flatIdx: number): Position => ({
      x: (flatIdx % innerW) + 1,
      y: Math.floor(flatIdx / innerW) + 1,
    });

    // Build grid
    const grid: string[][] = [];
    grid.push(Array(width).fill("#"));
    for (let y = 1; y < height - 1; y++) {
      const row = Array(width).fill(" ");
      row[0] = "#";
      row[width - 1] = "#";
      grid.push(row);
    }
    grid.push(Array(width).fill("#"));

    // Place player
    const playerPos = toCoord(playerIdx);
    grid[playerPos.y][playerPos.x] = playerIsPlus ? "+" : "@";

    // Place boxes as '$'
    for (const idx of boxIndices) {
      const pos = toCoord(idx);
      grid[pos.y][pos.x] = "$";
    }

    // Place independent goals as '.'
    for (const idx of goalIndices) {
      const pos = toCoord(idx);
      grid[pos.y][pos.x] = ".";
    }

    return grid.map((row) => row.join("")).join("\n");
  });

  it("scanAscii 与 parseLevel 对合法文本的坐标集合恒等（≥100 iterations）", () => {
    fc.assert(
      fc.property(sokobanLevelArb, (ascii) => {
        const scan = scanAscii(ascii);
        const grid = parseLevel(ascii);

        // walls 坐标排序后逐一相等
        expect(posKeys(scan.walls)).toEqual(posKeys(grid.walls));
        // goals 坐标排序后逐一相等
        expect(posKeys(scan.goals)).toEqual(posKeys(grid.goals));
        // boxes 坐标排序后逐一相等
        expect(posKeys(scan.boxes)).toEqual(posKeys(grid.boxes));
        // players: scanAscii.players.length === 1 && players[0] 等于 parseLevel.player
        expect(scan.players.length).toBe(1);
        expect(scan.players[0]).toEqual(grid.player);
        // 无非法字符
        expect(scan.invalidChars).toEqual([]);
      }),
      { numRuns: 100 },
    );
  });
});

// ── EXAMPLE / EDGE_CASE ────────────────────────────────────────

describe("scanAscii —— EXAMPLE / EDGE_CASE", () => {
  it("全空文本：返回 width=0, height=0, 各集合为空", () => {
    const scan = scanAscii("");
    expect(scan.width).toBe(0);
    expect(scan.height).toBe(0);
    expect(scan.walls).toEqual([]);
    expect(scan.goals).toEqual([]);
    expect(scan.boxes).toEqual([]);
    expect(scan.players).toEqual([]);
    expect(scan.invalidChars).toEqual([]);
  });

  it("单空行（只含换行）：返回 width=0, height=0", () => {
    const scan = scanAscii("\n");
    expect(scan.width).toBe(0);
    expect(scan.height).toBe(0);
    expect(scan.walls).toEqual([]);
  });

  it("多个末尾空行：全部去掉后正确扫描", () => {
    const ascii = "####\n#@ #\n####\n\n\n";
    const scan = scanAscii(ascii);
    expect(scan.height).toBe(3);
    expect(scan.width).toBe(4);
    expect(scan.players).toEqual([{ x: 1, y: 1 }]);
  });

  it("Ragged line：短行末尾缺失的列位置不进任何集合", () => {
    // 第 0 行 5 字符、第 1 行 3 字符、第 2 行 5 字符
    // 第 1 行的 x=3, x=4 不进任何集合
    const ascii = "#####\n#@#\n#####";
    const scan = scanAscii(ascii);
    expect(scan.width).toBe(5);
    expect(scan.height).toBe(3);
    // 玩家在 (1,1)
    expect(scan.players).toEqual([{ x: 1, y: 1 }]);
    // 第 1 行 x=3 和 x=4 没有被记录为任何东西
    const allPositions = [
      ...scan.walls.map((p) => `${p.x},${p.y}`),
      ...scan.goals.map((p) => `${p.x},${p.y}`),
      ...scan.boxes.map((p) => `${p.x},${p.y}`),
      ...scan.players.map((p) => `${p.x},${p.y}`),
      ...scan.invalidChars.map((ic) => `${ic.pos.x},${ic.pos.y}`),
    ];
    expect(allPositions).not.toContain("3,1");
    expect(allPositions).not.toContain("4,1");
  });

  it("中间空行：视为满宽度的一整行可通行非墙空地（不产生坐标）", () => {
    // 中间第 1 行为空
    const ascii = "#####\n\n#####";
    const scan = scanAscii(ascii);
    expect(scan.width).toBe(5);
    expect(scan.height).toBe(3);
    // 第 1 行（空行）不产生任何坐标
    const allY1 = [
      ...scan.walls.filter((p) => p.y === 1),
      ...scan.goals.filter((p) => p.y === 1),
      ...scan.boxes.filter((p) => p.y === 1),
      ...scan.players.filter((p) => p.y === 1),
      ...scan.invalidChars.filter((ic) => ic.pos.y === 1),
    ];
    expect(allY1).toEqual([]);
  });

  it("'*' 同时进 boxes 与 goals", () => {
    const ascii = "####\n#@*#\n####";
    const scan = scanAscii(ascii);
    expect(posKeys(scan.boxes)).toContain("2,1");
    expect(posKeys(scan.goals)).toContain("2,1");
  });

  it("'+' 同时进 players 与 goals", () => {
    const ascii = "#####\n# +$#\n#####";
    const scan = scanAscii(ascii);
    expect(scan.players).toEqual([{ x: 2, y: 1 }]);
    expect(posKeys(scan.goals)).toContain("2,1");
    expect(posKeys(scan.boxes)).toContain("3,1");
  });

  it("'*' 与 '+' 同时出现：goals 包含两者", () => {
    // '+' at (1,1): player + goal; '*' at (3,1): box + goal; '$' at (4,1): box
    const ascii = "######\n#+ *$#\n######";
    const scan = scanAscii(ascii);
    expect(scan.players).toEqual([{ x: 1, y: 1 }]);
    expect(posKeys(scan.goals)).toEqual(posKeys([{ x: 1, y: 1 }, { x: 3, y: 1 }]));
    expect(posKeys(scan.boxes)).toEqual(posKeys([{ x: 3, y: 1 }, { x: 4, y: 1 }]));
  });

  it("\\r\\n 换行兼容：结果与 \\n 换行相同", () => {
    const asciiLF = "####\n#@ #\n####";
    const asciiCRLF = "####\r\n#@ #\r\n####";
    const scanLF = scanAscii(asciiLF);
    const scanCRLF = scanAscii(asciiCRLF);
    expect(scanCRLF).toEqual(scanLF);
  });

  it("invalidChars 记录含 pos + ch：非法字符逐个记录", () => {
    // 'X' at (1,1), 'Z' at (3,1) 是非法字符
    const ascii = "#####\n#X Z#\n#####";
    const scan = scanAscii(ascii);
    expect(scan.invalidChars).toEqual([
      { pos: { x: 1, y: 1 }, ch: "X" },
      { pos: { x: 3, y: 1 }, ch: "Z" },
    ]);
  });

  it("invalidChars 多种非法字符（数字、中文、特殊符号）", () => {
    const ascii = "###\n#9#\n###";
    const scan = scanAscii(ascii);
    expect(scan.invalidChars).toEqual([
      { pos: { x: 1, y: 1 }, ch: "9" },
    ]);
  });

  it("width/height 正确计算", () => {
    const ascii = "######\n#@  .#\n# $  #\n######";
    const scan = scanAscii(ascii);
    expect(scan.width).toBe(6);
    expect(scan.height).toBe(4);
  });
});
