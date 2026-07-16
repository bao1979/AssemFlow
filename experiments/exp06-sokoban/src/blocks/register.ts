/**
 * 【块注册表工厂】src/blocks/register.ts
 * ────────────────────────────────────────────────────────────
 * 为不同装配流提供对应的 BlockRegistry 实例：
 *   - createWalkRegistry()  → 走路装配流（MVP-1，move-step）
 *   - createPushRegistry()  → 推箱装配流（MVP-2，move-with-push + win-check）
 *
 * MVP-1 的 createWalkRegistry 原定义在 move-step.ts 中，此处从该模块 re-export
 * 以便集中管理；原导出保留不删，已有引用不受影响。
 */

import { BlockRegistry } from "@assemflow/core";
import { moveWithPushBlock } from "./move-with-push.js";
import { winCheckBlock } from "./win-check.js";

// Re-export MVP-1 的走路注册表工厂（向后兼容）
export { createWalkRegistry } from "./move-step.js";

/**
 * 构造一个注册了 move-with-push + win-check 的 BlockRegistry。
 * 推箱驱动 / 端到端测试通过这个函数拿到注册表。
 */
export function createPushRegistry(): BlockRegistry {
  const reg = new BlockRegistry();
  reg.register(moveWithPushBlock);
  reg.register(winCheckBlock);
  return reg;
}
