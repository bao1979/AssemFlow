/**
 * assemflow check：静态校验配置图
 *
 * 不执行任何块，只检查：
 *   1. 每个步骤引用的块是否存在（悬空引用）
 *   2. 配置里有没有引用了但不存在的块（死引用）
 *
 * 后续可扩展：契约对齐（上一步输出 schema 是否匹配下一步输入 schema）、
 * 死配置检测、静态可枚举红线校验等。
 */

import type { BlockRegistry } from "./registry.js";
import type { FlowConfig, Diagnostic } from "./types.js";

export function checkConfig(config: FlowConfig, registry: BlockRegistry): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (let i = 0; i < config.steps.length; i++) {
    const step = config.steps[i];
    if (!registry.has(step.block)) {
      diagnostics.push({
        level: "error",
        step: i,
        message: `块 "${step.block}" 不存在于注册表（已注册：${registry.listNames().join(", ")})`,
      });
    }
  }

  return diagnostics;
}
