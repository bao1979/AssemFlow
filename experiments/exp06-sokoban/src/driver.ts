/**
 * 【走路驱动】src/driver.ts —— 纯 AFP，调用方持 grid
 * ────────────────────────────────────────────────────────────
 * 在 AFP 里的角色：装配流的「一回合驱动」薄封装。
 *   把"当前网格 + 方向"喂给引擎 assemble() 跑一趟装配流，取出"下一网格"。
 *   循环、事件、渲染都在引擎外（浏览器侧）——这里只负责"一次按键 = 一趟确定性装配"。
 *
 * 方案 A（状态承载：调用方持久化）的物理体现：
 *   - grid 作为 initialInput 流入、nextGrid 流出，由调用方（main.ts）在回合间保管。
 *   - move-step 块保持纯、无跨回合记忆——同一块可复用于任意回合，行为只依赖当回合输入。
 *
 * AFP 纪律点：
 *   - 纯 AFP，业务逻辑层无非 AFP 范式，无需 @paradigm 标记。
 *   - 不读时钟 / 不用随机 / 不调 AI；同 (config, registry, grid, direction) 永远同结果。
 *   - 不碰 node:fs，浏览器侧可直接用（配置由调用方传入，载体随阶段走）。
 *
 * 错误语义（见 design.md「Error Handling」）：
 *   - 非法方向（枚举外的值）被引擎 Ajv 在 execute 前拦下 → assemble 失败 → stepWalk 抛错。
 *   - 抛错时调用方保留旧 grid、状态不前进（方案 A 的天然性质）。
 *   - 越界 / 撞墙不是错误：是合法游戏规则，由块返回"停在原格"的 GridState，assemble 成功。
 */

import {
  assemble,
  type AssembleResult,
  type BlockRegistry,
  type FlowConfig,
} from "@assemflow/core";

import type { Direction, GridState } from "./grid.js";

/** 运行时类型守卫：验证 unknown 值是否为合法的 GridState。 */
function isGridState(value: unknown): value is GridState {
  if (value === null || typeof value !== "object") return false;
  const g = value as Record<string, unknown>;
  return (
    typeof g.width === "number" &&
    typeof g.height === "number" &&
    typeof g.player === "object" &&
    g.player !== null &&
    Array.isArray(g.walls) &&
    Array.isArray(g.boxes) &&
    Array.isArray(g.goals)
  );
}

/**
 * 跑一回合走路：喂入当前网格 + 方向，返回下一网格。
 *
 * 构造 initialInput { grid, direction } → assemble(config, registry, initialInput)
 *   → 取 context.nextGrid（move-step 的输出被引擎摊平进上下文顶层）。
 *
 * assemble 失败（如非法方向被 Ajv 拦下）时抛 Error；调用方据此保留旧 grid、状态不前进。
 */
export function stepWalk(
  config: FlowConfig,
  registry: BlockRegistry,
  grid: GridState,
  direction: Direction,
): GridState {
  const initialInput: Record<string, unknown> = { grid, direction };

  const result: AssembleResult = assemble(config, registry, initialInput);
  if (!result.success) {
    throw new Error(result.error ?? "stepWalk: assemble 失败（未知原因）");
  }

  const nextGrid = result.context["nextGrid"];
  if (!isGridState(nextGrid)) {
    throw new Error(
      `stepWalk: 块输出 "nextGrid" 类型无效（期望 GridState，实际为 ${typeof nextGrid}）`,
    );
  }
  return nextGrid;
}

// ── MVP-2: 推箱驱动 ─────────────────────────────────────────

/**
 * 推箱装配流的一回合结果。
 */
export interface PushResult {
  readonly nextGrid: GridState;
  readonly won: boolean;
}

/**
 * 跑一回合推箱：喂入当前网格 + 方向，返回下一网格与胜利判定。
 *
 * 内部：assemble(config, registry, { grid, direction })
 *   → { nextGrid: context.nextGrid, won: context.won }
 *
 * assemble 失败（Ajv 拦下非法方向等）抛 Error；调用方保留旧状态由外围 try-catch 处理。
 */
export function stepPush(
  config: FlowConfig,
  registry: BlockRegistry,
  grid: GridState,
  direction: Direction,
): PushResult {
  const initialInput: Record<string, unknown> = { grid, direction };

  const result: AssembleResult = assemble(config, registry, initialInput);
  if (!result.success) {
    throw new Error(result.error ?? "stepPush: assemble 失败（未知原因）");
  }

  const nextGrid = result.context["nextGrid"];
  if (!isGridState(nextGrid)) {
    throw new Error(
      `stepPush: 块输出 "nextGrid" 类型无效（期望 GridState，实际为 ${typeof nextGrid}）`,
    );
  }
  return {
    nextGrid,
    won: Boolean(result.context["won"]),
  };
}
