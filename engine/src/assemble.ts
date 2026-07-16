/**
 * assemflow assemble：确定性装配 + 运行
 *
 * 读配置 → 按步骤顺序执行块 → 每步的输出存入上下文 → 返回最终上下文。
 *
 * 上下文机制：
 *   - 配置的 params 作为初始上下文
 *   - 每个块执行后，输出合并回上下文（键为块名）
 *   - 步骤可通过 inputMap 从上下文取值映射到块的输入字段
 *   - 如果没有 inputMap，则把整个上下文作为块的输入（简化模式）
 *
 * 确定性保证：引擎不调任何 AI、不读时钟、不引入随机——
 * 同配置 + 同输入 + 同注册块 → 永远同结果。
 */

import Ajv from "ajv";
import type { ValidateFunction } from "ajv";
import type { TSchema } from "@sinclair/typebox";
import type { BlockRegistry } from "./registry.js";
import type { FlowConfig } from "./types.js";
import { checkConfig } from "./check.js";

const ajv = new Ajv({ allErrors: true });

/** ajv.compile() 缓存：以 schema 引用为键，避免热路径中重复 JSON.stringify 序列化。 */
const validatorCache = new Map<TSchema, ValidateFunction>();

function getValidator(schema: TSchema): ValidateFunction {
  let v = validatorCache.get(schema);
  if (!v) {
    v = ajv.compile(schema);
    validatorCache.set(schema, v);
  }
  return v;
}

export interface AssembleResult {
  success: boolean;
  context: Record<string, unknown>;
  error?: string;
}

export function assemble(
  config: FlowConfig,
  registry: BlockRegistry,
  initialInput?: Record<string, unknown>,
): AssembleResult {
  // 先做静态校验（把 initialInput 也喂进去，否则运行时字段会被误判为悬空）
  const diagnostics = checkConfig(config, registry, initialInput);
  const errors = diagnostics.filter((d) => d.level === "error");
  if (errors.length > 0) {
    return { success: false, context: {}, error: errors.map((e) => e.message).join("; ") };
  }

  // 初始化上下文：配置参数 + 调用方传入的输入
  const context: Record<string, unknown> = {
    ...(config.params ?? {}),
    ...(initialInput ?? {}),
  };

  // 按步骤顺序执行
  for (const step of config.steps) {
    const block = registry.get(step.block)!;

    // 构造块的输入
    let blockInput: unknown;
    if (step.inputMap) {
      // 显式映射：从上下文取值
      const mapped: Record<string, unknown> = {};
      for (const [blockField, contextKey] of Object.entries(step.inputMap)) {
        mapped[blockField] = context[contextKey];
      }
      blockInput = mapped;
    } else {
      // 简化模式：把整个上下文当输入
      blockInput = { ...context };
    }

    // 用 Ajv 校验输入是否符合块的契约（使用缓存避免重复 compile）
    const validate = getValidator(block.inputSchema);
    if (!validate(blockInput)) {
      return {
        success: false,
        context,
        error: `块 "${block.name}" 输入校验失败: ${ajv.errorsText(validate.errors)}`,
      };
    }

    // 执行块（用 try-catch 兜底：块可以用 throw 表达"业务短路"或异常情况，
    // 引擎不区分错误来源，统一转成 AssembleResult.error。这是 MVP 必备的鲁棒性——
    // 否则一个块抛会让整个引擎崩，调用方拿不到诊断信息。）
    let output: Record<string, unknown>;
    try {
      output = block.execute(blockInput) as Record<string, unknown>;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        success: false,
        context,
        error: `块 "${block.name}" 执行抛出异常: ${msg}`,
      };
    }

    // 用 Ajv 校验输出是否符合块声明的 outputSchema（强契约的运行时保障，使用缓存）
    const validateOutput = getValidator(block.outputSchema);
    if (!validateOutput(output)) {
      return {
        success: false,
        context,
        error: `块 "${block.name}" 输出校验失败: ${ajv.errorsText(validateOutput.errors)}`,
      };
    }

    // 输出存入上下文：块名存完整输出，同时把输出字段摊平到顶层方便下一步取值
    context[step.block] = output;
    if (typeof output === "object" && output !== null) {
      for (const [k, v] of Object.entries(output)) {
        context[k] = v;
      }
    }
  }

  return { success: true, context };
}
