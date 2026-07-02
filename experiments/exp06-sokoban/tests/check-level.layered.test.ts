// Feature: sokoban-mvp-3-levels, Property 6: 两层校验体系分层判定的等价性

/**
 * 【checkLevel · 分层等价属性测试 + 三关分类正/反例】tests/check-level.layered.test.ts
 * ────────────────────────────────────────────────────────────
 * Property 6（PBT）分两半：
 *   - 普通入口部分（tautology · 保留 fast-check 作执行守卫）
 *   - 发表关入口部分（有实测价值）
 *
 * EXAMPLE：三关分类正/反例 + SMOKE 断言
 *
 * Validates: Requirements 1.2, 1.3
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { arbLegalLevel } from "./generators.js";
import { checkLevel } from "../src/check.js";
import { parseLevel, assertPublishableLevel } from "../src/grid.js";
import { checkWin } from "../src/blocks/win-check.js";

// 关卡资产（?raw 导入）
import levelPush1 from "../src/levels/publishable/level-push-1.txt?raw";
import levelPushBig from "../src/levels/publishable/level-push-big.txt?raw";
import levelWalkOnly from "../src/levels/practice/level-walk-only.txt?raw";
import levelMalformedLeak from "../src/levels/malformed/level-malformed-leak.txt?raw";

// ── Property 6 · 普通入口部分（tautology · 执行守卫）────────────────────

describe("Property 6 普通入口：checkLevel(text).ok ⟺ parseLevel(text) 不抛错", () => {
  it("合法关：checkLevel.ok === true → parseLevel 不抛", () => {
    fc.assert(
      fc.property(arbLegalLevel(), (level) => {
        const result = checkLevel(level.text);
        expect(result.ok).toBe(true);
        // parseLevel 不应抛错
        expect(() => parseLevel(level.text)).not.toThrow();
      }),
      { numRuns: 100 },
    );
  });

  it("非法字符扰动：checkLevel.ok === false → parseLevel 抛错", () => {
    fc.assert(
      fc.property(
        arbLegalLevel(),
        fc.integer({ min: 0, max: 999 }),
        fc.integer({ min: 128, max: 255 }), // 取非 ASCII 合法字符
        (level, posSeed, charCode) => {
          const lines = level.text.split("\n");
          // 选一行的某一列替换为非法字符
          const nonEmptyLines = lines.filter((l) => l.length > 0);
          if (nonEmptyLines.length === 0) return;

          const lineIdx = posSeed % lines.length;
          if (lines[lineIdx].length === 0) return;
          const colIdx = posSeed % lines[lineIdx].length;

          const badCh = String.fromCharCode(charCode);
          const chars = lines[lineIdx].split("");
          chars[colIdx] = badCh;
          lines[lineIdx] = chars.join("");
          const mutated = lines.join("\n");

          const result = checkLevel(mutated);
          expect(result.ok).toBe(false);
          // parseLevel 应抛错
          expect(() => parseLevel(mutated)).toThrow();
        },
      ),
      { numRuns: 50 },
    );
  });

  it("玩家数扰动（0 玩家）：checkLevel.ok === false → parseLevel 抛错", () => {
    fc.assert(
      fc.property(arbLegalLevel(), (level) => {
        // 把所有 @ 和 + 替换为空格 → 0 玩家
        const mutated = level.text.replace(/[@+]/g, " ");
        const result = checkLevel(mutated);
        expect(result.ok).toBe(false);
        expect(() => parseLevel(mutated)).toThrow();
      }),
      { numRuns: 50 },
    );
  });

  it("边界不闭合扰动：checkLevel.ok === false → parseLevel 抛错", () => {
    fc.assert(
      fc.property(
        arbLegalLevel(),
        fc.integer({ min: 0, max: 999 }),
        (level, seed) => {
          const lines = level.text.split("\n").map((l) => l.split(""));
          const { width, height } = level.meta;

          // 收集外圈墙（非角）
          const outerWalls: { x: number; y: number }[] = [];
          for (let x = 1; x < width - 1; x++) {
            if (lines[0]?.[x] === "#") outerWalls.push({ x, y: 0 });
            if (lines[height - 1]?.[x] === "#") outerWalls.push({ x, y: height - 1 });
          }
          for (let y = 1; y < height - 1; y++) {
            if (lines[y]?.[0] === "#") outerWalls.push({ x: 0, y });
            if (lines[y]?.[width - 1] === "#") outerWalls.push({ x: width - 1, y });
          }
          if (outerWalls.length === 0) return;

          const idx = seed % outerWalls.length;
          const { x, y } = outerWalls[idx];
          lines[y][x] = " ";
          const mutated = lines.map((l) => l.join("")).join("\n");

          const result = checkLevel(mutated);
          expect(result.ok).toBe(false);
          expect(() => parseLevel(mutated)).toThrow();
        },
      ),
      { numRuns: 50 },
    );
  });
});

// ── Property 6 · 发表关入口部分（有实测价值）────────────────────────────

describe("Property 6 发表关入口：gate 通过/失败判据与期望等价", () => {
  /** 辅助：尝试执行 assertPublishableLevel，返回是否通过 */
  function gatePass(text: string): boolean {
    try {
      const grid = parseLevel(text);
      assertPublishableLevel(grid);
      return true;
    } catch {
      return false;
    }
  }

  it("合法关（≥2 箱 ≥2 目标、开局未通关）→ 过 base check + 过 gate", () => {
    fc.assert(
      fc.property(
        // 生成至少 2 箱 2 目标的关（maxWidth/maxHeight 放大一点确保内部空间足够）
        arbLegalLevel(10, 10),
        (level) => {
          // 只取 boxes >= 2 且开局未通关的关
          if (level.meta.boxes.length < 2) return; // 跳过不满足条件的
          // 确保开局未通关（箱子不全在目标格上）
          const grid = parseLevel(level.text);
          if (checkWin(grid)) return; // 跳过开局已通关的巧合情况

          const result = checkLevel(level.text);
          expect(result.ok).toBe(true);
          expect(gatePass(level.text)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("0=0 特例（0 箱 0 目标）→ 过 base check、不过 gate（boxes < 2）", () => {
    fc.assert(
      fc.property(
        arbLegalLevel(8, 8),
        (level) => {
          // 只取 0 箱 0 目标的关
          if (level.meta.boxes.length !== 0 || level.meta.goals.length !== 0) return;

          const result = checkLevel(level.text);
          expect(result.ok).toBe(true);
          expect(() => parseLevel(level.text)).not.toThrow();
          expect(gatePass(level.text)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("单箱单目标（1=1）→ 过 base check、不过 gate（boxes < 2）", () => {
    fc.assert(
      fc.property(
        arbLegalLevel(8, 8),
        (level) => {
          // 只取 1 箱 1 目标的关
          if (level.meta.boxes.length !== 1) return;

          const result = checkLevel(level.text);
          expect(result.ok).toBe(true);
          expect(() => parseLevel(level.text)).not.toThrow();
          expect(gatePass(level.text)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("开局已通关（所有 $ 都换成 *）→ 过 base check、不过 gate", () => {
    fc.assert(
      fc.property(
        arbLegalLevel(10, 10),
        (level) => {
          // 只取 ≥2 箱的关
          if (level.meta.boxes.length < 2) return;

          // 把所有 $ 换成 *（箱子在目标格上），把对应 . 去掉（已由 * 承担）
          // 策略：在网格上，把每个 box 位置设为 *，把 goal 位置中原有 . 的保留不变
          // 简化方式：先从 meta 重建网格，把 box 和 goal 重合
          const { width, height, playerPos, boxes, goals } = level.meta;

          // 构建网格：外圈全墙，内部按分配放置
          const grid: string[][] = [];
          grid.push(Array(width).fill("#"));
          for (let y = 1; y < height - 1; y++) {
            const row = Array(width).fill(" ");
            row[0] = "#";
            row[width - 1] = "#";
            grid.push(row);
          }
          grid.push(Array(width).fill("#"));

          // 放置玩家
          grid[playerPos.y][playerPos.x] = "@";

          // 把箱子放在目标位置（* = 箱子在目标格上）
          // 取 goals 的前 boxes.length 个位置作为 * 位置
          const boxCount = boxes.length;
          const goalCount = goals.length;
          // arbLegalLevel 保证 boxCount === goalCount
          if (boxCount !== goalCount) return;

          // 所有 box 放在 goal 位置上（使用 * 字符）
          for (let i = 0; i < boxCount; i++) {
            grid[goals[i].y][goals[i].x] = "*";
          }

          const text = grid.map((row) => row.join("")).join("\n");

          // 验证：过 base check
          const result = checkLevel(text);
          expect(result.ok).toBe(true);

          // 验证：parseLevel 不抛，checkWin === true
          const parsed = parseLevel(text);
          expect(checkWin(parsed)).toBe(true);

          // 验证：不过 gate（开局已通关）
          expect(() => assertPublishableLevel(parsed)).toThrow(/开局已通关/);
        },
      ),
      { numRuns: 50 },
    );
  });
});

// ── EXAMPLE：三关分类正/反例 ────────────────────────────────────────────

describe("EXAMPLE: 三关分类正/反例", () => {
  describe("发表关正例：level-push-1.txt", () => {
    it("checkLevel.ok === true", () => {
      const result = checkLevel(levelPush1);
      expect(result.ok).toBe(true);
    });

    it("parseLevel 不抛", () => {
      expect(() => parseLevel(levelPush1)).not.toThrow();
    });

    it("assertPublishableLevel 不抛", () => {
      const grid = parseLevel(levelPush1);
      expect(() => assertPublishableLevel(grid)).not.toThrow();
    });
  });

  describe("发表关正例：level-push-big.txt", () => {
    it("checkLevel.ok === true", () => {
      const result = checkLevel(levelPushBig);
      expect(result.ok).toBe(true);
    });

    it("parseLevel 不抛", () => {
      expect(() => parseLevel(levelPushBig)).not.toThrow();
    });

    it("assertPublishableLevel 不抛", () => {
      const grid = parseLevel(levelPushBig);
      expect(() => assertPublishableLevel(grid)).not.toThrow();
    });
  });

  describe("普通关正例 / 发表关反例：level-walk-only.txt", () => {
    it("checkLevel.ok === true", () => {
      const result = checkLevel(levelWalkOnly);
      expect(result.ok).toBe(true);
    });

    it("parseLevel 不抛", () => {
      expect(() => parseLevel(levelWalkOnly)).not.toThrow();
    });

    it("assertPublishableLevel 抛错（0=0 特例、boxes < 2）", () => {
      const grid = parseLevel(levelWalkOnly);
      expect(() => assertPublishableLevel(grid)).toThrow();
    });
  });

  describe("畸形关反例：level-malformed-leak.txt", () => {
    it("checkLevel.ok === false 且含 boundary-not-closed issue", () => {
      const result = checkLevel(levelMalformedLeak);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const boundaryIssue = result.issues.find(
          (i) => i.rule === "boundary-not-closed",
        );
        expect(boundaryIssue).toBeDefined();
      }
    });

    it("parseLevel 抛错", () => {
      expect(() => parseLevel(levelMalformedLeak)).toThrow();
    });
  });
});

// ── SMOKE 断言：parseLevel 抛错消息含规则名 ────────────────────────────────

describe("SMOKE: parseLevel 抛错消息含规则标识", () => {
  it("parseLevel 遇非法字符抛错、消息含 'invalid-char'", () => {
    const badLevel = [
      "#####",
      "# @X#",
      "# $.#",
      "#####",
    ].join("\n");

    expect(() => parseLevel(badLevel)).toThrow(/invalid-char/);
  });

  it("parseLevel 遇边界不闭合抛错、消息含 'boundary-not-closed'", () => {
    const leakLevel = [
      "## ##",
      "# @ #",
      "# $.#",
      "#####",
    ].join("\n");

    expect(() => parseLevel(leakLevel)).toThrow(/boundary-not-closed/);
  });
});
