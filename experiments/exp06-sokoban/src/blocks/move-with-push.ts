/**
 * 【走+推纯块】src/blocks/move-with-push.ts —— AFP 纯机制，算法入块
 * ────────────────────────────────────────────────────────────
 * 在 AFP 里的角色：
 *   - move-with-push 是「纯机制」——下一网格 = f(当前网格, 方向)。无时钟 / 随机 / AI。
 *     碰撞判定 + 推箱判定（目标格越界/撞墙→停、目标格有箱且箱后可推→推、否则→停或走）
 *     这套算法留在块内，配置只接线。
 *   - moveWithPushBlock 把 moveWithPush 包成引擎需要的运行期载体 BlockDef。
 *
 * AFP 纪律点：
 *   1. 算法入块、配置只接线——碰撞 + 推箱逻辑全在这里，push.jsonc 只做字段重命名。
 *   2. 块无记忆、确定性——同 (grid, direction) 永远同结果（方案 A：状态在调用方手里，块保持纯）。
 *   3. 静态地形 width/height/walls/goals 原样带出，只有 player/boxes 可能变。
 *   4. 撞墙/越界/推不动的输出值确定且每次一致。
 *   5. 推链只允许一层（R1.5）——一次只推一个箱子，不推并排箱，不拉。
 */

import type { BlockDef } from "../../../../engine/src/index.js";
import { Type } from "@sinclair/typebox";

import {
  type Direction,
  type GridState,
  type Position,
  GridStateSchema,
  DirectionSchema,
} from "../grid.js";

// ── 方向增量 ─────────────────────────────────────────────────

/** 方向 → 坐标增量（x 向右、y 向下，原点左上角）。 */
const DELTA: Record<Direction, Position> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

// ── 纯算法 ───────────────────────────────────────────────────

/**
 * 下一网格 = f(当前网格, 方向)。纯函数，无副作用。
 *
 * 判断顺序（推链只允许一层）：
 *   1. target = player + delta[direction]
 *   2. target 越界 OR target ∈ walls → 停在原格
 *   3. target 无箱 → 玩家前进一格（走路语义）
 *   4. target 有箱：
 *      a. behindBox = target + delta[direction]
 *      b. behindBox 越界 OR ∈ walls OR ∈ boxes → 停在原格（推不动）
 *      c. 否则 → 玩家移动到 target，该箱移动到 behindBox
 *
 * 静态地形 width/height/walls/goals 原样带出。
 */
export function moveWithPush(grid: GridState, direction: Direction): GridState {
  const delta = DELTA[direction];
  const target: Position = {
    x: grid.player.x + delta.x,
    y: grid.player.y + delta.y,
  };

  // ── 越界判定 ──
  const targetInBounds =
    target.x >= 0 && target.x < grid.width &&
    target.y >= 0 && target.y < grid.height;

  if (!targetInBounds) {
    // 目标格越界 → 停在原格
    return {
      width: grid.width,
      height: grid.height,
      walls: grid.walls,
      goals: grid.goals,
      player: grid.player,
      boxes: grid.boxes,
    };
  }

  // ── 撞墙判定 ──
  const hitsWall = grid.walls.some((w) => w.x === target.x && w.y === target.y);

  if (hitsWall) {
    // 目标格是墙 → 停在原格
    return {
      width: grid.width,
      height: grid.height,
      walls: grid.walls,
      goals: grid.goals,
      player: grid.player,
      boxes: grid.boxes,
    };
  }

  // ── 目标格有箱子？ ──
  const hasBox = grid.boxes.some((b) => b.x === target.x && b.y === target.y);

  if (!hasBox) {
    // 目标格无箱、无墙、不越界 → 玩家前进一格（走路语义）
    return {
      width: grid.width,
      height: grid.height,
      walls: grid.walls,
      goals: grid.goals,
      player: target,
      boxes: grid.boxes,
    };
  }

  // ── 目标格有箱子 → 判断箱后一格 ──
  const behindBox: Position = {
    x: target.x + delta.x,
    y: target.y + delta.y,
  };

  // 箱后越界
  const behindInBounds =
    behindBox.x >= 0 && behindBox.x < grid.width &&
    behindBox.y >= 0 && behindBox.y < grid.height;

  if (!behindInBounds) {
    // 箱后越界 → 玩家和该箱都停在原格
    return {
      width: grid.width,
      height: grid.height,
      walls: grid.walls,
      goals: grid.goals,
      player: grid.player,
      boxes: grid.boxes,
    };
  }

  // 箱后是墙
  const behindHitsWall = grid.walls.some((w) => w.x === behindBox.x && w.y === behindBox.y);

  if (behindHitsWall) {
    // 箱后是墙 → 停在原格
    return {
      width: grid.width,
      height: grid.height,
      walls: grid.walls,
      goals: grid.goals,
      player: grid.player,
      boxes: grid.boxes,
    };
  }

  // 箱后是另一个箱子
  const behindHasBox = grid.boxes.some((b) => b.x === behindBox.x && b.y === behindBox.y);

  if (behindHasBox) {
    // 箱后有另一个箱子 → 停在原格（一次只推一个）
    return {
      width: grid.width,
      height: grid.height,
      walls: grid.walls,
      goals: grid.goals,
      player: grid.player,
      boxes: grid.boxes,
    };
  }

  // ── 推箱成功：玩家移动到 target，该箱移动到 behindBox ──
  const nextBoxes = grid.boxes.map((b) =>
    b.x === target.x && b.y === target.y ? behindBox : b,
  );

  return {
    width: grid.width,
    height: grid.height,
    walls: grid.walls,
    goals: grid.goals,
    player: target,
    boxes: nextBoxes,
  };
}

// ── 装配块定义 ───────────────────────────────────────────────

export const moveWithPushBlock: BlockDef = {
  name: "move-with-push",
  inputSchema: Type.Object({ grid: GridStateSchema, direction: DirectionSchema }),
  outputSchema: Type.Object({ nextGrid: GridStateSchema }),
  execute: (input) => {
    const { grid, direction } = input as { grid: GridState; direction: Direction };
    return { nextGrid: moveWithPush(grid, direction) };
  },
};
