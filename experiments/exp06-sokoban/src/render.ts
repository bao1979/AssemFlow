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
 * 设计取舍（design.md Components #6 + §8）：
 *   - MVP-2 字符优先级（同一格多态取最上层）：
 *     '+' (player on goal) > '@' (player) > '*' (box on goal) > '$' (box) > '.' (goal) > '#' (wall) > ' ' (floor)
 *   - 网格用 <pre class="sokoban-grid"> 全量替换（replaceChildren）。
 *   - won === true 时追加独立 <div class="sokoban-win">🎉 你赢了！按 R 重开</div>。
 */

import type { GridState } from "./grid.js";

/** 渲染选项。 */
export interface RenderOptions {
  readonly won?: boolean;
}

/**
 * 把 GridState 画成 DOM 文本网格，渲染进 container。
 *
 * 字符优先级（同一格多态取最上层）：
 *   '+' player on goal > '@' player > '*' box on goal > '$' box > '.' goal > '#' wall > ' ' floor
 *
 * 每次调用用 replaceChildren 全量替换——重渲染天然体现最新状态（含位移 + won、无残留）。
 * 纯展示：不改 grid、不含业务逻辑。
 */
export function render(grid: GridState, container: HTMLElement, opts?: RenderOptions): void {
  // 查表用 "x,y" 字符串做 O(1) 命中判断（仅渲染期局部使用，不是数据契约）。
  const wallKeys = new Set(grid.walls.map((w) => `${w.x},${w.y}`));
  const boxKeys = new Set(grid.boxes.map((b) => `${b.x},${b.y}`));
  const goalKeys = new Set(grid.goals.map((g) => `${g.x},${g.y}`));

  const rows: string[] = [];
  for (let y = 0; y < grid.height; y++) {
    let row = "";
    for (let x = 0; x < grid.width; x++) {
      const key = `${x},${y}`;
      const isPlayer = grid.player.x === x && grid.player.y === y;
      const isBox = boxKeys.has(key);
      const isGoal = goalKeys.has(key);
      const isWall = wallKeys.has(key);

      if (isPlayer && isGoal) {
        row += "+";
      } else if (isPlayer) {
        row += "@";
      } else if (isBox && isGoal) {
        row += "*";
      } else if (isBox) {
        row += "$";
      } else if (isGoal) {
        row += ".";
      } else if (isWall) {
        row += "#";
      } else {
        row += " ";
      }
    }
    rows.push(row);
  }

  const doc = container.ownerDocument;

  const pre = doc.createElement("pre");
  pre.className = "sokoban-grid";
  pre.setAttribute("aria-live", "polite");
  pre.setAttribute("aria-atomic", "true");
  pre.textContent = rows.join("\n");

  if (opts?.won === true) {
    const winDiv = doc.createElement("div");
    winDiv.className = "sokoban-win";
    winDiv.textContent = "🎉 你赢了！按 R 重开";
    container.replaceChildren(pre, winDiv);
  } else {
    container.replaceChildren(pre);
  }
}
