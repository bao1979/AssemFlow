/**
 * 【块注册】把 5 个纯函数装配块包装成引擎的 BlockDef 注册到 BlockRegistry。
 * ────────────────────────────────────────────────────────────
 * 设计要点：
 *   1. 纯函数（emailValidate / hashPassword / storeUser / notify / appendAuditLog）保持不变。
 *      它们的属性测试也不变——确定性纪律由纯函数自己负责。
 *   2. BlockDef 是引擎需要的"运行期载体"——把 inputSchema / outputSchema / execute 三件套打包。
 *   3. email-validator 在 valid:false 时抛 Error——引擎据此短路。
 *      纯函数 emailValidate 仍返回 {valid, errorCode}，包装层做转换。
 *      outputSchema 用 Literal(true) 精确表达"成功路径只有 valid:true"。
 */

import { BlockRegistry, type BlockDef } from "../../../../engine/src/index.js";
import { Type } from "@sinclair/typebox";

import { emailValidate, EmailValidatorInput } from "./email-validator.js";
import { hashPassword, PasswordHasherInput, PasswordHasherOutput } from "./password-hasher.js";
import { storeUser, UserStoreInput, UserStoreOutput } from "./user-store.js";
import { notify, NotifierInput, NotifierOutput } from "./notifier.js";
import { appendAuditLog, AuditLoggerInput, AuditLoggerOutput } from "./audit-logger.js";

// ── 装配块定义 ────────────────────────────────────────────

const emailValidatorBlock: BlockDef = {
  name: "email-validator",
  inputSchema: EmailValidatorInput,
  // 成功路径只能 valid:true；失败由 execute 抛异常承载（引擎短路）。
  outputSchema: Type.Object({ valid: Type.Literal(true) }),
  execute: (input) => {
    const result = emailValidate(input as { email: string });
    if (!result.valid) {
      // 业务校验失败 → 抛异常 → 引擎转 AssembleResult.error
      throw new Error(result.errorCode ?? "email_invalid");
    }
    return { valid: true as const };
  },
};

const passwordHasherBlock: BlockDef = {
  name: "password-hasher",
  inputSchema: PasswordHasherInput,
  outputSchema: PasswordHasherOutput,
  execute: (input) => hashPassword(input as { password: string; salt: string }),
};

const userStoreBlock: BlockDef = {
  name: "user-store",
  inputSchema: UserStoreInput,
  outputSchema: UserStoreOutput,
  execute: (input) =>
    storeUser(input as { users: Array<{ email: string; passwordHash: string }>; email: string; passwordHash: string }),
};

const notifierBlock: BlockDef = {
  name: "notifier",
  inputSchema: NotifierInput,
  outputSchema: NotifierOutput,
  execute: (input) =>
    notify(input as { sent: Array<{ channel: "email" | "sms"; to: string; message: string }>; channel: "email" | "sms"; to: string; message: string }),
};

const auditLoggerBlock: BlockDef = {
  name: "audit-logger",
  inputSchema: AuditLoggerInput,
  outputSchema: AuditLoggerOutput,
  execute: (input) =>
    appendAuditLog(input as { logs: Array<{ timestamp: string; action: string; detail: string }>; timestamp: string; action: string; detail: string }),
};

/**
 * 构造一个填好 5 个块的 BlockRegistry。
 * 拼装脚本/测试都通过这个函数拿到注册表，避免重复登记。
 */
export function createRegistry(): BlockRegistry {
  const reg = new BlockRegistry();
  reg.register(emailValidatorBlock);
  reg.register(passwordHasherBlock);
  reg.register(userStoreBlock);
  reg.register(notifierBlock);
  reg.register(auditLoggerBlock);
  return reg;
}
