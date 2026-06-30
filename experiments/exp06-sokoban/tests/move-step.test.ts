/**
 * 走路纯块 move() 的单元测试 —— 四方向移动 / 撞墙不动 / 出界不动 / 连续移动。
 *
 * 覆盖设计 design.md 的 Correctness Property 2（碰撞规则）：
 *   - 目标格是地板且在界内 → player 等于目标格
 *   - 目标格是墙或越界     → player 等于原格
 * 用值等（toEqual）断言：碰撞/越界输出值确定即可，不强制新对象还是复用输入对象。
 *
 * Validates: Requirements 1.3, 1.4, 1.5
 */

import { describe, it, expect } from "vitest";

import { move } from "../src/blocks/move-step.js";
import type { GridState } from "../src/grid.js";

/** 3×3 空旷网格，角色在正中央 (1,1)，无墙。 */
const openGrid: GridState = {
  width: 3,
  height: 3,
  walls: [],
  player: { x: 1, y: 1 },
};

describe("move · 四方向移动（Property 2：目标格是地板 → 移动）", () => {
  it("up：y 减 1", () => {
    expect(move(openGrid, "up").player).toEqual({ x: 1, y: 0 });
  });

  it("down：y 加 1", () => {
    expect(move(openGrid, "down").player).toEqual({ x: 1, y: 2 });
  });

  it("left：x 减 1", () => {
    expect(move(openGrid, "left").player).toEqual({ x: 0, y: 1 });
  });

  it("right：x 加 1", () => {
    expect(move(openGrid, "right").player).toEqual({ x: 2, y: 1 });
  });

  it("移动后静态地形 width/height/walls 原样带出", () => {
    const next = move(openGrid, "up");
    expect(next.width).toBe(openGrid.width);
    expect(next.height).toBe(openGrid.height);
    expect(next.walls).toEqual(openGrid.walls);
  });
});

describe("move · 撞墙不动（Property 2：目标格是墙 → 停原格）", () => {
  it("目标格是墙：player 停在原格", () => {
    const grid: GridState = {
      width: 3,
      height: 3,
      walls: [{ x: 1, y: 0 }], // 角色正上方是墙
      player: { x: 1, y: 1 },
    };
    expect(move(grid, "up")).toEqual(grid);
  });

  it("无关方向不受墙影响：能正常移动", () => {
    const grid: GridState = {
      width: 3,
      height: 3,
      walls: [{ x: 1, y: 0 }],
      player: { x: 1, y: 1 },
    };
    expect(move(grid, "down").player).toEqual({ x: 1, y: 2 });
  });
});

describe("move · 出界不动（Property 2：目标格越界 → 停原格）", () => {
  it("向上越界（y < 0）：停原格", () => {
    const grid: GridState = { width: 3, height: 3, walls: [], player: { x: 0, y: 0 } };
    expect(move(grid, "up")).toEqual(grid);
  });

  it("向左越界（x < 0）：停原格", () => {
    const grid: GridState = { width: 3, height: 3, walls: [], player: { x: 0, y: 0 } };
    expect(move(grid, "left")).toEqual(grid);
  });

  it("向右越界（x >= width）：停原格", () => {
    const grid: GridState = { width: 3, height: 3, walls: [], player: { x: 2, y: 2 } };
    expect(move(grid, "right")).toEqual(grid);
  });

  it("向下越界（y >= height）：停原格", () => {
    const grid: GridState = { width: 3, height: 3, walls: [], player: { x: 2, y: 2 } };
    expect(move(grid, "down")).toEqual(grid);
  });
});

describe("move · 连续移动（多回合折叠）", () => {
  it("空旷 3×1 行：连续向右走到底再撞边界停住", () => {
    const row: GridState = { width: 3, height: 1, walls: [], player: { x: 0, y: 0 } };

    const step1 = move(row, "right");
    expect(step1.player).toEqual({ x: 1, y: 0 });

    const step2 = move(step1, "right");
    expect(step2.player).toEqual({ x: 2, y: 0 });

    // 再向右越界：停在 (2,0)
    const step3 = move(step2, "right");
    expect(step3.player).toEqual({ x: 2, y: 0 });
  });

  it("绕墙走：撞墙停一回合后换方向可继续", () => {
    const grid: GridState = {
      width: 3,
      height: 3,
      walls: [{ x: 1, y: 0 }],
      player: { x: 0, y: 0 },
    };

    // 向右撞墙 (1,0) → 停原格
    const blocked = move(grid, "right");
    expect(blocked.player).toEqual({ x: 0, y: 0 });

    // 改向下 → 移动到 (0,1)
    const down = move(blocked, "down");
    expect(down.player).toEqual({ x: 0, y: 1 });
  });
});
