// @vitest-environment jsdom
/**
 * 渲染层 render() 的测试（jsdom 环境）。
 *
 * vite.config.ts 全局把 vitest 环境设为 "node"；本文件需要 document / HTMLElement，
 * 故在文件头用 `// @vitest-environment jsdom` 单独声明 DOM 环境（Task 1 约定）。
 *
 * 覆盖设计 design.md 的 Correctness Property 7（渲染反映最新状态）：
 *   - 渲染后 DOM 文本网格中角色格对应 grid.player、墙格对应 grid.walls；
 *   - 移动一回合后重渲染，能体现 player 的位移。
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4
 */

import { describe, it, expect } from "vitest";

import { render } from "../src/render.js";
import { move } from "../src/blocks/move-step.js";
import type { GridState } from "../src/grid.js";

/** 把渲染后的 container 文本网格切成 rows[y][x] 便于按坐标取字符。 */
function readGrid(container: HTMLElement): string[] {
  const pre = container.querySelector("pre");
  expect(pre).not.toBeNull();
  return (pre!.textContent ?? "").split("\n");
}

describe("render · 角色与墙位置正确（Property 7）", () => {
  it("3×3 网格：角色画成 '@'、墙画成 '#'、其余 '.'", () => {
    const grid: GridState = {
      width: 3,
      height: 3,
      walls: [
        { x: 0, y: 0 },
        { x: 2, y: 2 },
      ],
      player: { x: 1, y: 1 },
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
    // 地板示例：(1,0) (0,1) 等为 '.'
    expect(rows[0][1]).toBe(".");
    expect(rows[1][0]).toBe(".");

    // 完整文本断言（够清楚就行的朴素网格）
    expect(rows.join("\n")).toBe(["#..", ".@.", "..#"].join("\n"));
  });

  it("渲染输出到 DOM（非控制台）：container 内含一个 <pre> 文本网格", () => {
    const grid: GridState = { width: 1, height: 1, walls: [], player: { x: 0, y: 0 } };
    const container = document.createElement("div");
    render(grid, container);

    const pre = container.querySelector("pre");
    expect(pre).not.toBeNull();
    expect(pre!.textContent).toBe("@");
  });
});

describe("render · 重渲染体现位移（Property 7：一回合后角色移动可见）", () => {
  it("向右移动一回合后重渲染，'@' 从 (1,1) 移到 (2,1)", () => {
    const grid: GridState = {
      width: 3,
      height: 3,
      walls: [],
      player: { x: 1, y: 1 },
    };

    const container = document.createElement("div");

    // 初始渲染：角色在 (1,1)
    render(grid, container);
    let rows = readGrid(container);
    expect(rows[1][1]).toBe("@");
    expect(rows[1][2]).toBe(".");

    // 走一回合（纯块 move）后用最新 grid 重渲染
    const next = move(grid, "right");
    render(next, container);
    rows = readGrid(container);

    // 旧位置变回地板，新位置出现角色——位移当场可见
    expect(rows[1][1]).toBe(".");
    expect(rows[1][2]).toBe("@");

    // 重渲染是全量替换：container 内仍只有一个 <pre>
    expect(container.querySelectorAll("pre")).toHaveLength(1);
  });
});
