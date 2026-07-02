// Feature: sokoban-mvp-3-levels, Property 5: 边界不闭合必现形 + hint 是合法泄漏点

/**
 * 【checkLevel · boundary-not-closed 规则属性测试】tests/check-level.boundary.test.ts
 * ────────────────────────────────────────────────────────────
 * Property 5（PBT）：在合法 baseline 的外圈墙上随机戳一个洞
 *   （把外圈某个 # 替换为空格），断言 checkLevel 返回 ok=false
 *   且 issues 中含 rule="boundary-not-closed" 且 hint 满足：
 *     - 是网格内合法坐标
 *     - 不在 walls 中
 *     - 位于网格外边界
 *
 * EXAMPLE：四个方向各测一次；malformed/level-malformed-leak.txt 读入验证。
 *
 * Validates: Requirements 2.2, 2.3
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { arbLegalLevel } from "./generators.js";
import { checkLevel } from "../src/check.js";
import { scanAscii, type Position } from "../src/scan-ascii.js";
import malformedLeakText from "../src/levels/malformed/level-malformed-leak.txt?raw";

describe("checkLevel · Property 5: boundary-not-closed 必现形 + hint 是合法泄漏点", () => {
  it("在外圈墙上戳洞 → 报 boundary-not-closed + hint 是合法边缘非墙坐标", () => {
    fc.assert(
      fc.property(
        arbLegalLevel(),
        fc.integer({ min: 0, max: 999 }),
        (level, seed) => {
          const lines = level.text.split("\n").map((l) => l.split(""));
          const { width, height } = level.meta;

          // 收集外圈墙位置（排除四个角——它们周围邻居可能都是墙，戳掉不一定泄漏）
          // 选择边缘上非角的墙位置
          const outerWalls: { x: number; y: number }[] = [];

          // 顶行（非角）
          for (let x = 1; x < width - 1; x++) {
            if (lines[0][x] === "#") outerWalls.push({ x, y: 0 });
          }
          // 底行（非角）
          for (let x = 1; x < width - 1; x++) {
            if (lines[height - 1][x] === "#") outerWalls.push({ x, y: height - 1 });
          }
          // 左列（非角）
          for (let y = 1; y < height - 1; y++) {
            if (lines[y][0] === "#") outerWalls.push({ x: 0, y });
          }
          // 右列（非角）
          for (let y = 1; y < height - 1; y++) {
            if (lines[y][width - 1] === "#") outerWalls.push({ x: width - 1, y });
          }

          if (outerWalls.length === 0) return; // 不应发生（外圈全墙）

          // 用 seed 选一个位置
          const idx = seed % outerWalls.length;
          const { x, y } = outerWalls[idx];

          // 戳洞：把该墙替换为空格
          lines[y][x] = " ";
          const mutatedText = lines.map((l) => l.join("")).join("\n");

          const result = checkLevel(mutatedText);
          expect(result.ok).toBe(false);
          if (result.ok) return;

          const boundaryIssues = result.issues.filter(
            (i) => i.rule === "boundary-not-closed",
          );
          expect(boundaryIssues.length).toBeGreaterThanOrEqual(1);

          // 验证 hint 属性
          const issue = boundaryIssues[0];
          const loc = issue.location as { hint: Position } | undefined;
          expect(loc).toBeDefined();
          expect(loc!.hint).toBeDefined();

          const { hint } = loc!;

          // hint 是网格内合法坐标
          expect(hint.x).toBeGreaterThanOrEqual(0);
          expect(hint.x).toBeLessThan(width);
          expect(hint.y).toBeGreaterThanOrEqual(0);
          expect(hint.y).toBeLessThan(height);

          // hint 不在 walls 中（用扰动后的 scan 来确认）
          const mutatedScan = scanAscii(mutatedText);
          const wallSet = new Set(
            mutatedScan.walls.map((w) => `${w.x},${w.y}`),
          );
          expect(wallSet.has(`${hint.x},${hint.y}`)).toBe(false);

          // hint 位于网格外边界
          const isOnBorder =
            hint.x === 0 ||
            hint.x === width - 1 ||
            hint.y === 0 ||
            hint.y === height - 1;
          expect(isOnBorder).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("EXAMPLE: 外圈缺口在上方", () => {
    const level = [
      "## ##",
      "# @ #",
      "# $.#",
      "#####",
    ].join("\n");

    const result = checkLevel(level);
    expect(result.ok).toBe(false);
    if (result.ok) return;

    const issue = result.issues.find((i) => i.rule === "boundary-not-closed");
    expect(issue).toBeDefined();
    const loc = issue!.location as { hint: Position };
    expect(loc.hint.y).toBe(0); // 上边界
  });

  it("EXAMPLE: 外圈缺口在下方", () => {
    const level = [
      "#####",
      "# @ #",
      "# $.#",
      "## ##",
    ].join("\n");

    const result = checkLevel(level);
    expect(result.ok).toBe(false);
    if (result.ok) return;

    const issue = result.issues.find((i) => i.rule === "boundary-not-closed");
    expect(issue).toBeDefined();
    const loc = issue!.location as { hint: Position };
    expect(loc.hint.y).toBe(3); // 下边界
  });

  it("EXAMPLE: 外圈缺口在左侧", () => {
    const level = [
      "#####",
      " @ .#",
      "# $ #",
      "#####",
    ].join("\n");

    const result = checkLevel(level);
    expect(result.ok).toBe(false);
    if (result.ok) return;

    const issue = result.issues.find((i) => i.rule === "boundary-not-closed");
    expect(issue).toBeDefined();
    const loc = issue!.location as { hint: Position };
    expect(loc.hint.x).toBe(0); // 左边界
  });

  it("EXAMPLE: 外圈缺口在右侧", () => {
    const level = [
      "#####",
      "#@.  ",
      "# $ #",
      "#####",
    ].join("\n");

    const result = checkLevel(level);
    expect(result.ok).toBe(false);
    if (result.ok) return;

    const issue = result.issues.find((i) => i.rule === "boundary-not-closed");
    expect(issue).toBeDefined();
    const loc = issue!.location as { hint: Position };
    // hint.x 应为宽度-1 处或 hint 在右边界
    const scan = scanAscii(level);
    expect(
      loc.hint.x === scan.width - 1 ||
      loc.hint.y === 0 ||
      loc.hint.y === scan.height - 1,
    ).toBe(true);
  });

  it("EXAMPLE: malformed/level-malformed-leak.txt 返回 boundary-not-closed", () => {
    const result = checkLevel(malformedLeakText);
    expect(result.ok).toBe(false);
    if (result.ok) return;

    const issue = result.issues.find((i) => i.rule === "boundary-not-closed");
    expect(issue).toBeDefined();

    const loc = issue!.location as { hint: Position };
    expect(loc.hint).toBeDefined();

    // hint 应在网格边缘且非墙
    const scan = scanAscii(malformedLeakText);
    const isOnBorder =
      loc.hint.x === 0 ||
      loc.hint.x === scan.width - 1 ||
      loc.hint.y === 0 ||
      loc.hint.y === scan.height - 1;
    expect(isOnBorder).toBe(true);

    const wallSet = new Set(scan.walls.map((w) => `${w.x},${w.y}`));
    expect(wallSet.has(`${loc.hint.x},${loc.hint.y}`)).toBe(false);
  });
});
