// @vitest-environment jsdom
// Feature: sokoban-mvp-2-push, Property 8: 渲染字符优先级正确
/**
 * 渲染层 render() 的测试（jsdom 环境）。
 *
 * Property 8（PBT）：fast-check 生成合法 GridState，断言 <pre class="sokoban-grid"> 文本
 * 第 y 行第 x 列字符符合优先级表：
 *   '+' (player on goal) > '@' (player) > '*' (box on goal) > '$' (box) > '.' (goal) > '#' (wall) > ' ' (floor)
 *
 * EXAMPLE：won === true → .sokoban-win DOM 出现；won === false / undefined → 不出现；
 *          就位态 $ → * 前后对比 EDGE_CASE。
 *
 * Validates: Requirements 2.2, 3.1, 3.3, 4.1, 4.2, 4.3, 4.4
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

import { render } from "../src/render.js";
import { move } from "../src/blocks/move-step.js";
import type { GridState } from "../src/grid.js";

// ── Helpers ─────────────────────────────────────────────────

/** 把渲染后的 container 文本网格切成 rows[y][x] 便于按坐标取字符。 */
function readGrid(container: HTMLElement): string[] {
  const pre = container.querySelector("pre.sokoban-grid");
  expect(pre).not.toBeNull();
  return (pre!.textContent ?? "").split("\n");
}

/** 根据优先级表计算期望字符。 */
function expectedChar(
  x: number,
  y: number,
  grid: GridState,
): string {
  const isPlayer = grid.player.x === x && grid.player.y === y;
  const isBox = grid.boxes.some((b) => b.x === x && b.y === y);
  const isGoal = grid.goals.some((g) => g.x === x && g.y === y);
  const isWall = grid.walls.some((w) => w.x === x && w.y === y);

  if (isPlayer && isGoal) return "+";
  if (isPlayer) return "@";
  if (isBox && isGoal) return "*";
  if (isBox) return "$";
  if (isGoal) return ".";
  if (isWall) return "#";
  return " ";
}

// ── fast-check arbitrary for valid GridState ────────────────

/**
 * 生成合法 GridState：
 * - width/height 在 [2, 8] 范围
 * - player 在界内
 * - walls / goals / boxes 各自在界内且互不冲突（同一格可能有 box+goal 或 player+goal，但不会有 wall+player 等非法叠加）
 */
function arbGridState(): fc.Arbitrary<GridState> {
  return fc
    .record({
      width: fc.integer({ min: 2, max: 8 }),
      height: fc.integer({ min: 2, max: 8 }),
    })
    .chain(({ width, height }) => {
      const arbPos = fc.record({
        x: fc.integer({ min: 0, max: width - 1 }),
        y: fc.integer({ min: 0, max: height - 1 }),
      });

      return fc
        .record({
          player: arbPos,
          walls: fc.array(arbPos, { minLength: 0, maxLength: 6 }),
          goals: fc.array(arbPos, { minLength: 0, maxLength: 4 }),
          boxes: fc.array(arbPos, { minLength: 0, maxLength: 4 }),
        })
        .map(({ player, walls, goals, boxes }) => {
          // 去掉 walls 中与 player 或 boxes 重合的位置（player/box 不该在墙上）
          const playerKey = `${player.x},${player.y}`;
          const boxKeys = new Set(boxes.map((b) => `${b.x},${b.y}`));
          const filteredWalls = walls.filter((w) => {
            const k = `${w.x},${w.y}`;
            return k !== playerKey && !boxKeys.has(k);
          });

          // 去掉 boxes 中与 player 重合的位置
          const filteredBoxes = boxes.filter(
            (b) => !(b.x === player.x && b.y === player.y),
          );

          return {
            width,
            height,
            player,
            walls: filteredWalls,
            goals, // goals 可以与 player / boxes 重合（表示 player on goal / box on goal）
            boxes: filteredBoxes,
          } satisfies GridState;
        });
    });
}

// ── Property 8 PBT ──────────────────────────────────────────

describe("render · Property 8 渲染字符优先级正确（PBT）", () => {
  it("fast-check: 每格字符符合优先级表", () => {
    fc.assert(
      fc.property(arbGridState(), (grid) => {
        const container = document.createElement("div");
        render(grid, container);
        const rows = readGrid(container);

        expect(rows).toHaveLength(grid.height);

        for (let y = 0; y < grid.height; y++) {
          for (let x = 0; x < grid.width; x++) {
            const actual = rows[y][x];
            const expected = expectedChar(x, y, grid);
            expect(actual).toBe(expected);
          }
        }
      }),
      { numRuns: 200 },
    );
  });
});

// ── EXAMPLE: won 状态对 DOM 的影响 ──────────────────────────

describe("render · won 状态 DOM 表现", () => {
  const simpleGrid: GridState = {
    width: 3,
    height: 3,
    walls: [{ x: 0, y: 0 }],
    goals: [{ x: 2, y: 2 }],
    player: { x: 1, y: 1 },
    boxes: [{ x: 2, y: 0 }],
  };

  it("won === true → .sokoban-win DOM 出现", () => {
    const container = document.createElement("div");
    render(simpleGrid, container, { won: true });

    const winEl = container.querySelector(".sokoban-win");
    expect(winEl).not.toBeNull();
    expect(winEl!.textContent).toBe("🎉 你赢了！按 R 重开");
  });

  it("won === false → .sokoban-win DOM 不出现", () => {
    const container = document.createElement("div");
    render(simpleGrid, container, { won: false });

    const winEl = container.querySelector(".sokoban-win");
    expect(winEl).toBeNull();
  });

  it("won === undefined → .sokoban-win DOM 不出现", () => {
    const container = document.createElement("div");
    render(simpleGrid, container);

    const winEl = container.querySelector(".sokoban-win");
    expect(winEl).toBeNull();
  });

  it("重渲染无残留：won=true 后再 won=false 应清除 .sokoban-win", () => {
    const container = document.createElement("div");
    render(simpleGrid, container, { won: true });
    expect(container.querySelector(".sokoban-win")).not.toBeNull();

    render(simpleGrid, container, { won: false });
    expect(container.querySelector(".sokoban-win")).toBeNull();
    // container 内仍只有一个 <pre>
    expect(container.querySelectorAll("pre")).toHaveLength(1);
  });
});

// ── EDGE_CASE: 就位态 $ → * 前后对比 ──────────────────────

describe("render · EDGE_CASE 就位态字符对比", () => {
  it("box 不在 goal → 渲染为 '$'；box 在 goal → 渲染为 '*'", () => {
    // 箱子不在目标格
    const gridBefore: GridState = {
      width: 3,
      height: 1,
      walls: [],
      goals: [{ x: 2, y: 0 }],
      player: { x: 0, y: 0 },
      boxes: [{ x: 1, y: 0 }],
    };

    const container = document.createElement("div");
    render(gridBefore, container);
    let rows = readGrid(container);
    expect(rows[0][1]).toBe("$"); // box 不在 goal
    expect(rows[0][2]).toBe("."); // goal 空

    // 箱子推到目标格（player 从 (0,0) 推到 (1,0)，box 从 (1,0) 推到 (2,0)）
    const gridAfter: GridState = {
      ...gridBefore,
      player: { x: 1, y: 0 },
      boxes: [{ x: 2, y: 0 }],
    };

    render(gridAfter, container);
    rows = readGrid(container);
    expect(rows[0][2]).toBe("*"); // box on goal → '*'
    expect(rows[0][1]).toBe("@"); // player 现在在 (1,0)
    expect(rows[0][0]).toBe(" "); // 原 player 位置变成地板（空格）
  });

  it("player on goal → 渲染为 '+'", () => {
    const grid: GridState = {
      width: 2,
      height: 1,
      walls: [],
      goals: [{ x: 0, y: 0 }],
      player: { x: 0, y: 0 },
      boxes: [],
    };

    const container = document.createElement("div");
    render(grid, container);
    const rows = readGrid(container);
    expect(rows[0][0]).toBe("+");
  });
});

// ── 兼容旧测试：角色与墙位置正确 + 重渲染体现位移 ─────────

describe("render · 角色与墙位置正确（回归）", () => {
  it("3×3 网格：角色画成 '@'、墙画成 '#'、其余 ' '（空格地板）", () => {
    const grid: GridState = {
      width: 3,
      height: 3,
      walls: [
        { x: 0, y: 0 },
        { x: 2, y: 2 },
      ],
      goals: [],
      player: { x: 1, y: 1 },
      boxes: [],
    };

    const container = document.createElement("div");
    render(grid, container);

    const rows = readGrid(container);
    expect(rows).toHaveLength(3);

    // 角色在 (1,1)
    expect(rows[1][1]).toBe("@");
    // 墙在 (0,0) 与 (2,2)
    expect(rows[0][0]).toBe("#");
    expect(rows[2][2]).toBe("#");
    // 地板示例：(1,0) (0,1) 为空格（MVP-2 地板=空格）
    expect(rows[0][1]).toBe(" ");
    expect(rows[1][0]).toBe(" ");
  });

  it("渲染输出到 DOM：container 内含一个 <pre class=\"sokoban-grid\"> 文本网格", () => {
    const grid: GridState = { width: 1, height: 1, walls: [], goals: [], player: { x: 0, y: 0 }, boxes: [] };
    const container = document.createElement("div");
    render(grid, container);

    const pre = container.querySelector("pre.sokoban-grid");
    expect(pre).not.toBeNull();
    expect(pre!.textContent).toBe("@");
  });
});

describe("render · 重渲染体现位移（回归）", () => {
  it("向右移动一回合后重渲染，'@' 从 (1,1) 移到 (2,1)", () => {
    const grid: GridState = {
      width: 3,
      height: 3,
      walls: [],
      goals: [],
      player: { x: 1, y: 1 },
      boxes: [],
    };

    const container = document.createElement("div");

    // 初始渲染：角色在 (1,1)
    render(grid, container);
    let rows = readGrid(container);
    expect(rows[1][1]).toBe("@");
    expect(rows[1][2]).toBe(" ");

    // 走一回合后重渲染
    const next = move(grid, "right");
    render(next, container);
    rows = readGrid(container);

    // 旧位置变回地板（空格），新位置出现角色
    expect(rows[1][1]).toBe(" ");
    expect(rows[1][2]).toBe("@");

    // 重渲染是全量替换：container 内仍只有一个 <pre>
    expect(container.querySelectorAll("pre")).toHaveLength(1);
  });
});
