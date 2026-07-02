// Feature: sokoban-mvp-3-levels, Property 2: 非法字符必现形 + 精确到行列

/**
 * 【checkLevel · invalid-char 规则属性测试】tests/check-level.invalid-char.test.ts
 * ────────────────────────────────────────────────────────────
 * Property 2（PBT）：在合法 baseline 内某 (line, col) 位置替换为一个非法字符 badCh，
 *   断言 checkLevel 返回 ok=false 且 issues 中含 rule="invalid-char" 且
 *   location 精确到扰动坐标（1-indexed）且 message 中包含 badCh。
 *
 * EDGE_CASE：非法字符出现在首字符 / 末字符 / 相邻多处。
 *
 * Validates: Requirements 2.2, 2.3
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { arbLegalLevel } from "./generators.js";
import { checkLevel } from "../src/check.js";

// 合法字符集（不含换行——换行是行分隔符不是格内字符）
const LEGAL_CHARS = new Set(["#", ".", " ", "@", "$", "*", "+"]);

/** 生成一个非法字符（不在合法字符集内、不是换行） */
const arbBadChar = fc.integer({ min: 0x21, max: 0x7e })
  .filter((code) => {
    const ch = String.fromCharCode(code);
    return !LEGAL_CHARS.has(ch) && ch !== "\n";
  })
  .map((code) => String.fromCharCode(code));

describe("checkLevel · Property 2: invalid-char 必现形 + 精确到行列", () => {
  it("在合法 baseline 内部非墙位置替换为非法字符 → 精确报出行列", () => {
    fc.assert(
      fc.property(
        arbLegalLevel(),
        arbBadChar,
        (level, badCh) => {
          const lines = level.text.split("\n");
          const height = lines.length;

          // 选择一个内部非墙位置（避免破坏外圈墙导致 boundary-not-closed 也触发）
          // 内部位置 = 不在外圈的格子
          const innerPositions: { x: number; y: number }[] = [];
          for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < lines[y].length - 1; x++) {
              // 跳过墙（避免破坏边界）
              if (lines[y][x] !== "#") {
                innerPositions.push({ x, y });
              }
            }
          }

          // 如果没有可用的内部非墙位置，跳过这个 sample
          if (innerPositions.length === 0) return;

          // 选第一个内部位置
          const idx = Math.abs(badCh.charCodeAt(0)) % innerPositions.length;
          const { x, y } = innerPositions[idx];

          // 构建扰动文本
          const mutatedLines = lines.map((l) => l.split(""));
          mutatedLines[y][x] = badCh;
          const mutatedText = mutatedLines.map((l) => l.join("")).join("\n");

          // 断言
          const result = checkLevel(mutatedText);
          expect(result.ok).toBe(false);
          if (result.ok) return; // type narrowing

          const invalidIssues = result.issues.filter(
            (i) => i.rule === "invalid-char",
          );
          expect(invalidIssues.length).toBeGreaterThanOrEqual(1);

          // 找到匹配精确坐标的 issue（1-indexed）
          const matching = invalidIssues.find((i) => {
            const loc = i.location as { line: number; column: number } | undefined;
            return loc && loc.line === y + 1 && loc.column === x + 1;
          });
          expect(matching).toBeDefined();

          // message 中包含实际 badCh
          expect(matching!.message).toContain(badCh);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("EDGE_CASE: 非法字符出现在关卡首字符位置（内部）", () => {
    // 手写一个 4×4 关卡，首字符是外圈墙不可替换，
    // 选 (1,1) 作为"最靠近首端的内部位置"
    const level = [
      "####",
      "#@ #",
      "#  #",
      "####",
    ].join("\n");

    // 把 (1,1) 替换为非法字符 'X'
    const lines = level.split("\n").map((l) => l.split(""));
    lines[1][1] = "X";
    const mutated = lines.map((l) => l.join("")).join("\n");

    const result = checkLevel(mutated);
    expect(result.ok).toBe(false);
    if (result.ok) return;

    const issue = result.issues.find(
      (i) => i.rule === "invalid-char",
    );
    expect(issue).toBeDefined();
    const loc = issue!.location as { line: number; column: number };
    expect(loc.line).toBe(2);
    expect(loc.column).toBe(2);
    expect(issue!.message).toContain("X");
  });

  it("EDGE_CASE: 非法字符出现在关卡末字符位置（内部）", () => {
    const level = [
      "#####",
      "# @ #",
      "#   #",
      "#####",
    ].join("\n");

    // 替换 (3,2) — 最后内部行最后内部列
    const lines = level.split("\n").map((l) => l.split(""));
    lines[2][3] = "Z";
    const mutated = lines.map((l) => l.join("")).join("\n");

    const result = checkLevel(mutated);
    expect(result.ok).toBe(false);
    if (result.ok) return;

    const issue = result.issues.find(
      (i) => i.rule === "invalid-char",
    );
    expect(issue).toBeDefined();
    const loc = issue!.location as { line: number; column: number };
    expect(loc.line).toBe(3);
    expect(loc.column).toBe(4);
    expect(issue!.message).toContain("Z");
  });

  it("EDGE_CASE: 相邻多处非法字符——全跑不短路、各产独立 issue", () => {
    const level = [
      "#####",
      "# @ #",
      "#   #",
      "#####",
    ].join("\n");

    // 在 (1,2), (2,2), (3,2) 都替换为非法字符
    const lines = level.split("\n").map((l) => l.split(""));
    lines[2][1] = "A";
    lines[2][2] = "B";
    lines[2][3] = "C";
    const mutated = lines.map((l) => l.join("")).join("\n");

    const result = checkLevel(mutated);
    expect(result.ok).toBe(false);
    if (result.ok) return;

    const invalidIssues = result.issues.filter(
      (i) => i.rule === "invalid-char",
    );
    // 应该有 3 条 invalid-char issue
    expect(invalidIssues.length).toBe(3);

    // 各自精确到位置
    const locations = invalidIssues.map((i) => {
      const loc = i.location as { line: number; column: number };
      return `${loc.line},${loc.column}`;
    });
    expect(locations).toContain("3,2"); // (1,2) → line=3, col=2
    expect(locations).toContain("3,3"); // (2,2) → line=3, col=3
    expect(locations).toContain("3,4"); // (3,2) → line=3, col=4

    // 各 message 包含对应的非法字符
    expect(invalidIssues.find((i) => i.message.includes("A"))).toBeDefined();
    expect(invalidIssues.find((i) => i.message.includes("B"))).toBeDefined();
    expect(invalidIssues.find((i) => i.message.includes("C"))).toBeDefined();
  });
});
