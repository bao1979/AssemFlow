/**
 * 【拼装脚本】模拟"引擎照配置把块串起来执行"
 * ────────────────────────────────────────────────────────────
 * 这是什么：一段手写脚本，模拟将来引擎的 assemble 命令会做的事。
 *           它读配置 → 按配置里的步骤顺序调块 → 把上一步的输出喂给下一步。
 *
 * 为什么不造引擎：实验①的目标只是验证"只改配置就能改行为"这个假设。
 *                用手写脚本就够了，避免过早投入引擎开发。
 *
 * 确定性保证：这个脚本里没有随机、没有时钟（时间戳和盐都是外部传入的参数），
 *            同样的配置 + 同样的输入数据 → 每次运行结果完全一样。
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { emailValidate } from "./blocks/email-validator.js";
import { hashPassword } from "./blocks/password-hasher.js";
import { storeUser } from "./blocks/user-store.js";
import { notify } from "./blocks/notifier.js";
import { appendAuditLog } from "./blocks/audit-logger.js";

// ── 读配置 ──────────────────────────────────────────────────
// 用 JSON.parse 去掉 JSONC 里的注释（简单处理：去掉 // 开头的行）
function loadConfig(path: string) {
  const raw = readFileSync(path, "utf-8");
  const stripped = raw.replace(/^\s*\/\/.*$/gm, "");
  return JSON.parse(stripped);
}

// ── 执行注册流 ──────────────────────────────────────────────
export interface RegisterInput {
  email: string;
  password: string;
  salt: string;       // 显式传入，保证确定性
  timestamp: string;  // 显式传入，不读系统时钟
}

export interface RegisterResult {
  success: boolean;
  error?: string;
  notifyChannel?: string;
  users?: Array<{ email: string; passwordHash: string }>;
  logs?: Array<{ timestamp: string; action: string; detail: string }>;
  sent?: Array<{ channel: string; to: string; message: string }>;
}

export function assembleAndRun(configPath: string, input: RegisterInput): RegisterResult {
  const config = loadConfig(configPath);
  const { notifyChannel, notifyMessage } = config.params;

  // 步骤 1：查邮箱
  const emailResult = emailValidate({ email: input.email });
  if (!emailResult.valid) {
    return { success: false, error: emailResult.errorCode };
  }

  // 步骤 2：加密密码
  const hashResult = hashPassword({ password: input.password, salt: input.salt });

  // 步骤 3：存用户
  const storeResult = storeUser({
    users: [],
    newUser: { email: input.email, passwordHash: hashResult.hash },
  });

  // 步骤 4：发通知（渠道由配置决定）
  const notifyResult = notify({
    sent: [],
    channel: notifyChannel,
    to: input.email,
    message: notifyMessage,
  });

  // 步骤 5：记审计
  const auditResult = appendAuditLog({
    logs: [],
    timestamp: input.timestamp,
    action: "register",
    detail: input.email,
  });

  return {
    success: true,
    notifyChannel,
    users: storeResult.users,
    logs: auditResult.logs,
    sent: notifyResult.sent,
  };
}

// ── 如果直接运行这个脚本（npm run assemble），打印结果 ──────
const isDirectRun = process.argv[1]?.includes("assemble");
if (isDirectRun) {
  const configPath = resolve(import.meta.dirname!, "configs/register.jsonc");
  const result = assembleAndRun(configPath, {
    email: "test@example.com",
    password: "P@ss1234",
    salt: "fixed-salt-for-demo",
    timestamp: "2026-06-25T12:00:00Z",
  });
  console.log(JSON.stringify(result, null, 2));
}
