/**
 * assemflow check：静态校验配置图
 *
 * 不执行任何块，只分析配置 + 注册表，检查：
 *   1. 悬空引用：步骤引用的块是否存在
 *   2. 契约对齐：步骤通过 inputMap 引用的字段，是否能在前面步骤的输出里找到，
 *      且类型兼容（输出字段类型 ⊆ 输入字段期望的类型）
 *   3. 死配置：params 里声明了但没有任何步骤用到的参数
 */

import type { TObject, TProperties, TSchema } from "@sinclair/typebox";
import type { BlockRegistry } from "./registry.js";
import type { FlowConfig, Diagnostic } from "./types.js";

/**
 * 从一个 TObject schema 里提取属性定义（只处理 Type.Object）。
 * 非 Object 类型返回 undefined。
 */
function getProperties(schema: TSchema): TProperties | undefined {
  if (schema && typeof schema === "object" && "properties" in schema) {
    return (schema as TObject).properties;
  }
  return undefined;
}

/**
 * 简单类型兼容检查：输出类型 → 输入期望类型。
 * 规则：
 *   - 输入期望 unknown/any → 任何输出都兼容
 *   - 两者 type 关键字相同 → 兼容
 *   - 否则 → 不兼容
 *
 * 这是一个简化版本，足够捕捉明显的类型不匹配（如 string 喂给 number）。
 * 完整的 JSON Schema 子类型判断留给后续迭代。
 */
function isTypeCompatible(outputField: TSchema, inputExpected: TSchema): boolean {
  // 输入期望的是 unknown → 任何都行
  const inputType = (inputExpected as Record<string, unknown>)["type"];
  if (!inputType) return true; // 没有 type 约束（如 Type.Unknown()）

  const outputType = (outputField as Record<string, unknown>)["type"];
  if (!outputType) return true; // 输出也没声明 type，无法判断，放行

  return outputType === inputType;
}

export function checkConfig(config: FlowConfig, registry: BlockRegistry): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  // ── 1. 悬空引用 ──────────────────────────────────────────
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

  // 如果有悬空引用，后续分析无意义
  if (diagnostics.some((d) => d.level === "error")) return diagnostics;

  // ── 构建"上下文可用字段"：params + 前面步骤的输出 ────────
  // 记录每个字段名 → 来源步骤 + 类型 schema
  const available = new Map<string, { source: string; schema: TSchema }>();

  // params 里的字段（类型未知，标为宽松）
  if (config.params) {
    for (const key of Object.keys(config.params)) {
      available.set(key, { source: "params", schema: {} as TSchema });
    }
  }

  // ── 2. 契约对齐：逐步骤检查 inputMap ───────────────────
  for (let i = 0; i < config.steps.length; i++) {
    const step = config.steps[i];
    const block = registry.get(step.block)!;

    // 如果有 inputMap，检查每个映射
    if (step.inputMap) {
      const inputProps = getProperties(block.inputSchema);

      for (const [blockField, contextKey] of Object.entries(step.inputMap)) {
        // 检查上下文里有没有这个字段
        if (!available.has(contextKey)) {
          diagnostics.push({
            level: "error",
            step: i,
            message: `步骤 ${i}（${step.block}）的 inputMap 引用了上下文字段 "${contextKey}"，但该字段不存在（可用：${[...available.keys()].join(", ")}）`,
          });
          continue;
        }

        // 类型兼容检查
        if (inputProps && inputProps[blockField]) {
          const source = available.get(contextKey)!;
          if (source.source !== "params" && !isTypeCompatible(source.schema, inputProps[blockField])) {
            diagnostics.push({
              level: "warning",
              step: i,
              message: `步骤 ${i}（${step.block}）：字段 "${contextKey}" 的类型可能与 "${blockField}" 期望的类型不兼容`,
            });
          }
        }
      }
    }

    // 把本步骤的输出字段加入可用上下文
    const outputProps = getProperties(block.outputSchema);
    if (outputProps) {
      for (const [fieldName, fieldSchema] of Object.entries(outputProps)) {
        available.set(fieldName, { source: step.block, schema: fieldSchema as TSchema });
      }
    }
  }

  // ── 3. 死配置检测 ────────────────────────────────────────
  if (config.params) {
    // 收集所有 inputMap 里引用的 contextKey
    const usedKeys = new Set<string>();
    for (const step of config.steps) {
      if (step.inputMap) {
        for (const contextKey of Object.values(step.inputMap)) {
          usedKeys.add(contextKey);
        }
      }
    }

    for (const paramKey of Object.keys(config.params)) {
      if (!usedKeys.has(paramKey)) {
        diagnostics.push({
          level: "warning",
          step: -1,
          message: `配置参数 "${paramKey}" 已声明但未被任何步骤的 inputMap 引用（死配置）`,
        });
      }
    }
  }

  return diagnostics;
}
