/**
 * 【胜利判定纯块】src/blocks/win-check.ts —— AFP 纯机制
 * ────────────────────────────────────────────────────────────
 * 在 AFP 里的角色：
 *   - checkWin 是「纯机制」——给定任意 GridState，判定是否所有箱子都位于目标格上。
 *   - winCheckBlock 把 checkWin 包成引擎需要的运行期载体 BlockDef。
 *
 * AFP 纪律点：
 *   1. 纯函数：同输入同输出，不读时钟 / 不用随机 / 不调 AI。
 *   2. 返回布尔而非 GridState：win 是纯粹的派生态，不改地图。
 *   3. 与 move-with-push 解耦（独立纯机制）：配置只接线，块自身不关心"是不是刚走完的"。
 *   4. 在 parseLevel 已保证"箱数=目标数"前提下，
 *      ∀ b ∈ boxes: b ∈ goals（⊆）与 boxes ≡ goals（集合相等）等价，无需再算基数。
 */

import type { BlockDef } from "@assemflow/core";
import { Type } from "@sinclair/typebox";

import { type GridState, GridStateSchema } from "../grid.js";

// ── 纯算法 ───────────────────────────────────────────────────

/**
 * 胜利判定 = 所有箱子都位于目标格上。
 * 纯函数，无副作用。
 */
export function checkWin(grid: GridState): boolean {
  return grid.boxes.every((b) => grid.goals.some((g) => g.x === b.x && g.y === b.y));
}

// ── 装配块定义 ───────────────────────────────────────────────

export const winCheckBlock: BlockDef = {
  name: "win-check",
  inputSchema: Type.Object({ grid: GridStateSchema }),
  outputSchema: Type.Object({ won: Type.Boolean() }),
  execute: (input) => {
    const { grid } = input as { grid: GridState };
    return { won: checkWin(grid) };
  },
};
