/**
 * 引擎核心类型定义
 */

import type { TSchema } from "@sinclair/typebox";

/**
 * 一个装配块的注册信息：名字 + 输入/输出契约 + 执行函数
 */
export interface BlockDef {
  name: string;
  inputSchema: TSchema;
  outputSchema: TSchema;
  execute: (input: unknown) => unknown;
}

/**
 * 配置中的一个步骤
 */
export interface StepConfig {
  block: string;                    // 引用的块名
  inputMap?: Record<string, string>; // 可选：从上下文取值映射到块输入字段
}

/**
 * 一份完整的装配流配置
 */
export interface FlowConfig {
  flowName: string;
  steps: StepConfig[];
  params?: Record<string, unknown>; // 配置参数（注入到上下文）
}

/**
 * check 命令的诊断结果
 */
export interface Diagnostic {
  level: "error" | "warning" | "info";
  step: number;
  message: string;
}
