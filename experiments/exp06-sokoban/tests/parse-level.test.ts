/**
 * 【解析测试】tests/parse-level.test.ts —— Property 4「装载正确」
 * ────────────────────────────────────────────────────────────
 * 覆盖 Requirement 1.1 / design.md Property 4 / Testing Strategy #4：
 *   parseLevel 把 ASCII 正确映射为 GridState——
 *     '#' 进 walls、'@' 定位 player、'.'/空格为地板；宽高与文本一致。
 *   畸形输入（无 '@' / 多 '@'）按 Error Handling 抛 Error。
 *
 * Validates: Requirements 1.1
 */

import { describe, it, expect } from "vitest";
import { parseLevel, type Position } from "../src/grid.js";

// 把 Position[] 归一化成可排序、可比较的字符串集合，避免顺序影响断言。
function wallKeys(walls: readonly Position[]): string[] {
  return walls.map((w) => `${w.x},${w.y}`).sort();
}

describe("parseLevel —— 装载正确（Property 4）", () => {
  it("把 # 映射为墙、@ 定位角色、./空格为地板，宽高与文本一致", () => {
    // 4 宽 × 3 高的房间：四周墙、中间地板、角色在 (1,1)。
    const ascii = ["####", "#@.#", "####"].join("\n");
    const grid = parseLevel(ascii);

    expect(grid.width).toBe(4);
    expect(grid.height).toBe(3);
    expect(grid.player).toEqual({ x: 1, y: 1 });

    // 墙集合：第 0 行、第 2 行整行 + 第 1 行两端。
    expect(wallKeys(grid.walls)).toEqual(
      wallKeys([
        { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 },
        { x: 0, y: 1 }, { x: 3, y: 1 },
        { x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 },
      ]),
    );
    // (1,1) 是角色（地板），(2,1) 是 '.' 地板——都不在 walls 里。
    expect(wallKeys(grid.walls)).not.toContain("1,1");
    expect(wallKeys(grid.walls)).not.toContain("2,1");
  });

  it("空格与 '.' 都视为地板（不进 walls）", () => {
    // 第二行用空格作地板，验证空格也被当作可走格。
    const ascii = ["###", "# @", "###"].join("\n");
    const grid = parseLevel(ascii);

    expect(grid.player).toEqual({ x: 2, y: 1 });
    // (1,1) 是空格地板，不在墙里。
    expect(wallKeys(grid.walls)).not.toContain("1,1");
  });

  it("宽度取最长一行的长度（行长不齐时）", () => {
    // 第二行更短：width 仍应等于最长行（5）。
    const ascii = ["#####", "#@#", "#####"].join("\n");
    const grid = parseLevel(ascii);

    expect(grid.width).toBe(5);
    expect(grid.height).toBe(3);
    expect(grid.player).toEqual({ x: 1, y: 1 });
  });

  it("兼容 CRLF 换行（\\r 被去掉，不影响宽高/坐标）", () => {
    const ascii = "####\r\n#@.#\r\n####";
    const grid = parseLevel(ascii);

    expect(grid.width).toBe(4);
    expect(grid.height).toBe(3);
    expect(grid.player).toEqual({ x: 1, y: 1 });
  });

  it("畸形输入：无 '@' 角色 → 抛 Error", () => {
    const ascii = ["####", "#..#", "####"].join("\n");
    expect(() => parseLevel(ascii)).toThrowError(/@/);
  });

  it("畸形输入：多个 '@' 角色 → 抛 Error", () => {
    const ascii = ["####", "#@@#", "####"].join("\n");
    expect(() => parseLevel(ascii)).toThrowError(/@/);
  });
});
