/**
 * 【生成器 sanity check】tests/generators.test.ts
 * ────────────────────────────────────────────────────────────
 * 对 arbLegalLevel 生成器做 sanity check：生成 20 份 baseline 都应过 checkLevel。
 * 验证生成器的约束（恰一玩家、箱数=目标数、字符合法、边界闭合）通过 checkLevel 校验。
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { arbLegalLevel } from "./generators.js";
import { checkLevel } from "../src/check.js";

describe("arbLegalLevel 生成器 sanity check", () => {
  it("生成 20 份 baseline 都应过 checkLevel（ok: true）", () => {
    fc.assert(
      fc.property(arbLegalLevel(), (level) => {
        const result = checkLevel(level.text);
        if (!result.ok) {
          // 提供调试信息
          throw new Error(
            `生成的关卡未过 checkLevel:\n` +
            `text:\n${level.text}\n` +
            `issues: ${JSON.stringify(result.issues, null, 2)}`,
          );
        }
        expect(result.ok).toBe(true);
      }),
      { numRuns: 20 },
    );
  });

  it("生成的关卡 meta 与实际文本一致（恰一玩家、箱数=目标数）", () => {
    fc.assert(
      fc.property(arbLegalLevel(), (level) => {
        const result = checkLevel(level.text);
        if (!result.ok) {
          throw new Error(`未过 checkLevel: ${JSON.stringify(result.issues)}`);
        }
        const { scan } = result;

        // 恰一玩家
        expect(scan.players.length).toBe(1);
        expect(scan.players[0]).toEqual(level.meta.playerPos);

        // 箱数 = 目标数
        expect(scan.boxes.length).toBe(scan.goals.length);
        expect(scan.boxes.length).toBe(level.meta.boxes.length);
        expect(scan.goals.length).toBe(level.meta.goals.length);

        // 无非法字符
        expect(scan.invalidChars).toEqual([]);

        // 宽高匹配
        expect(scan.width).toBe(level.meta.width);
        expect(scan.height).toBe(level.meta.height);
      }),
      { numRuns: 20 },
    );
  });

  it("生成关卡尺寸在约束范围内（3×3 到 8×8）", () => {
    fc.assert(
      fc.property(arbLegalLevel(), (level) => {
        expect(level.meta.width).toBeGreaterThanOrEqual(3);
        expect(level.meta.width).toBeLessThanOrEqual(8);
        expect(level.meta.height).toBeGreaterThanOrEqual(3);
        expect(level.meta.height).toBeLessThanOrEqual(8);
      }),
      { numRuns: 20 },
    );
  });

  it("生成关卡的外圈全是墙（边界闭合保证）", () => {
    fc.assert(
      fc.property(arbLegalLevel(), (level) => {
        const lines = level.text.split("\n");
        const height = lines.length;
        const width = lines[0].length;

        // 顶行全墙
        for (let x = 0; x < width; x++) {
          expect(lines[0][x]).toBe("#");
        }
        // 底行全墙
        for (let x = 0; x < width; x++) {
          expect(lines[height - 1][x]).toBe("#");
        }
        // 左右列全墙
        for (let y = 0; y < height; y++) {
          expect(lines[y][0]).toBe("#");
          expect(lines[y][lines[y].length - 1]).toBe("#");
        }
      }),
      { numRuns: 20 },
    );
  });
});
