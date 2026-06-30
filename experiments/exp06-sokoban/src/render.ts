/**
 * 【渲染】src/render.ts —— 非 AFP 承诺范围（不打 @paradigm）
 * ────────────────────────────────────────────────────────────
 * 在 AFP 里的角色：纯展示层。把 GridState 渲染成 DOM 文本网格（够清楚就行、无美术）。
 *
 * 为什么不打 @paradigm：
 *   render 是引擎派生的「可视化视图」，不在「配置即图」的数据流承诺范围内——
 *   它不承载业务/装配逻辑，读者不会因为没标记而误以为这段是纯 AFP 数据流。
 *   按 afp-core.md「标记适用范围」判据，渲染层 / 前端脚手架无需 @paradigm（R4.3）。
 *
 * 设计取舍（design.md Components #6 + 未决问题）：
 *   - MVP-1 只画墙 / 地板 / 角色三种字符：'#' 墙、'.' 地板、'@' 角色。
 *   - 箱子 / 目标点的渲染留 MVP-2——这里预留「按坐标定字符」的结构，但不提前抽象
 *     成可配置符号表（治理关节、放开零件）。
 */

import type { GridState } from "./grid.js";

/** 渲染用字符（MVP-1 三种；MVP-2 再按需扩展箱子/目标点）。 */
const CHAR = {
  player: "@",
  wall: "#",
  floor: ".",
} as const;

/**
 * 把 GridState 画成 DOM 文本网格，渲染进 container。
 *   - 每个 (x, y) 格按优先级取字符：角色 > 墙 > 地板。
 *   - 用一个 <pre> 承载整张网格（等宽、换行即行），够清楚就行、无美术。
 *   - 每次调用先清空 container，再重建——重渲染天然体现最新状态（含角色位移）。
 *
 * 纯展示：不改 grid、不含业务逻辑。
 */
export function render(grid: GridState, container: HTMLElement): void {
  // 墙坐标查表：用 "x,y" 字符串做 O(1) 命中判断（仅渲染期局部使用，不是数据契约）。
  const wallKeys = new Set(grid.walls.map((w) => `${w.x},${w.y}`));

  const rows: string[] = [];
  for (let y = 0; y < grid.height; y++) {
    let row = "";
    for (let x = 0; x < grid.width; x++) {
      if (grid.player.x === x && grid.player.y === y) {
        row += CHAR.player;
      } else if (wallKeys.has(`${x},${y}`)) {
        row += CHAR.wall;
      } else {
        row += CHAR.floor;
      }
    }
    rows.push(row);
  }

  const pre = container.ownerDocument.createElement("pre");
  pre.className = "sokoban-grid";
  pre.textContent = rows.join("\n");

  // 清空后挂上：重渲染 = 全量替换，保证 DOM 始终反映最新 GridState。
  container.replaceChildren(pre);
}
