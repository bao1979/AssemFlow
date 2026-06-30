/**
 * 【走路纯块】src/blocks/move-step.ts —— AFP 纯机制，算法入块
 * ────────────────────────────────────────────────────────────
 * 在 AFP 里的角色：
 *   - move 是「纯机制」——下一网格 = f(当前网格, 方向)。无时钟 / 随机 / AI。
 *     碰撞判定（目标格越界或撞墙→停、否则→移动）这套算法留在块内，配置只接线。
 *   - moveStepBlock 把 move 包成引擎需要的运行期载体 BlockDef（inputSchema / outputSchema / execute）。
 *
 * AFP 纪律点：
 *   1. 算法入块、配置只接线——碰撞逻辑全在这里，walk.jsonc 只做字段重命名。
 *   2. 块无记忆、确定性——同 (grid, direction) 永远同结果（方案 A：状态在调用方手里，块保持纯）。
 *   3. 静态地形 width/height/walls 原样带出，只有 player 可能变。
 *   4. 撞墙/越界的输出值确定且每次一致；测试用值等（toEqual），不强制返回新对象还是复用——
 *      确定性只要求值可预测、可复现。
 */

import { BlockRegistry, type BlockDef } from "../../../../engine/src/index.js";
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
 *   - 目标格 = player + delta(direction)
 *   - 目标格越界（出 [0,width) × [0,height)）或命中 walls → 角色停在原格
 *   - 否则                                              → 角色移动到目标格
 * 静态地形 width/height/walls 原样带出。
 */
export function move(grid: GridState, direction: Direction): GridState {
  const delta = DELTA[direction];
  const target: Position = { x: grid.player.x + delta.x, y: grid.player.y + delta.y };

  const inBounds = target.x >= 0 && target.x < grid.width && target.y >= 0 && target.y < grid.height;
  const hitsWall = grid.walls.some((w) => w.x === target.x && w.y === target.y);

  // 越界或撞墙：停在原格。返回与输入值等价的 GridState（确定性，值可复现）。
  const nextPlayer = !inBounds || hitsWall ? grid.player : target;

  return {
    width: grid.width,
    height: grid.height,
    walls: grid.walls,
    player: nextPlayer,
  };
}

// ── 装配块定义 ───────────────────────────────────────────────

export const moveStepBlock: BlockDef = {
  name: "move-step",
  inputSchema: Type.Object({ grid: GridStateSchema, direction: DirectionSchema }),
  outputSchema: Type.Object({ nextGrid: GridStateSchema }),
  execute: (input) => {
    const { grid, direction } = input as { grid: GridState; direction: Direction };
    return { nextGrid: move(grid, direction) };
  },
};

/**
 * 构造一个注册了 move-step 的 BlockRegistry。
 * 走路驱动 / 端到端测试都通过这个函数拿到注册表，避免重复登记。
 */
export function createWalkRegistry(): BlockRegistry {
  const reg = new BlockRegistry();
  reg.register(moveStepBlock);
  return reg;
}
