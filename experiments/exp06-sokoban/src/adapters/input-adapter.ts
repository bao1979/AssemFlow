/**
 * 【输入转接件】src/adapters/input-adapter.ts —— Adapter / 防腐层
 * ────────────────────────────────────────────────────────────
 * 在 AFP 里的角色：转接件（Adapter）。
 *   把「浏览器物理按键名」这种善变的外部输入，隔离在业务逻辑之外——
 *   业务层（move-step 块、walk 配置）只认归一化后的方向动作名 Direction，
 *   永远不直接接触 "ArrowUp" / "w" 这类 DOM KeyboardEvent.key 字面量。
 *
 * AFP 纪律点：
 *   - 这是防腐层：外部输入的善变锁在这里，块与配置保持稳定纯净。
 *   - 纯函数：同输入同输出，不读时钟 / 不用随机 / 不调 AI。
 *   - 无法识别的按键返回 null —— 调用方据此「不触发回合」（状态不前进）。
 *   - 业务逻辑层是纯 AFP，本文件无需 @paradigm 标记。
 *
 * 映射（design.md Components and Interfaces #3）：
 *   ArrowUp    | "w" | "W"  → "up"
 *   ArrowDown  | "s" | "S"  → "down"
 *   ArrowLeft  | "a" | "A"  → "left"
 *   ArrowRight | "d" | "D"  → "right"
 *   其它                     → null
 */

import type { Direction } from "../grid.js";

/**
 * 物理按键名 → 方向动作名。无法识别的键返回 null（不触发回合）。
 * key 取自浏览器 KeyboardEvent.key。
 */
export function keyToDirection(key: string): Direction | null {
  switch (key) {
    case "ArrowUp":
    case "w":
    case "W":
      return "up";
    case "ArrowDown":
    case "s":
    case "S":
      return "down";
    case "ArrowLeft":
    case "a":
    case "A":
      return "left";
    case "ArrowRight":
    case "d":
    case "D":
      return "right";
    default:
      return null;
  }
}
