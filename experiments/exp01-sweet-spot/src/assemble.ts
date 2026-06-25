/**
 * 【拼装脚本】真正按配置的 steps 驱动执行
 * ────────────────────────────────────────────────────────────
 * 修复前的问题：steps 数组是摆设，执行顺序是硬编码的。
 * 修复后：脚本读配置 → 按 steps 遍历 → 根据块名动态调用对应函数。
 * 如果 steps 是空的或者顺序变了，行为就会跟着变——这才是"配置驱动装配"。
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { emailValidate } from "./blocks/email-validator.js";
import { hashPassword } from "./blocks/password-hasher.js";
import { storeUser } from "./blocks/user-store.js";
import { notify } from "./blocks/notifier.js";
import { appendAuditLog } from "./blocks/audit-logger.js";

// ── 块注册表（块名 → 执行函数）────────────────────────────
const blockRegistry: Record<string, (input: Record<string, unknown>) => unknown> = {
  "email-validator": (ctx) => emailValidate({ email: ctx["email"] as string }),
  "password-hasher": (ctx) => hashPassword({ password: ctx["password"] as string, salt: ctx["salt"] as string }),
  "user-store": (ctx) => storeUser({ users: (ctx["users"] ?? []) as Array<{ email: string; passwordHash: string }>, newUser: { email: ctx["email"] as string, passwordHash: (ctx["hash"] as string) ?? "" } }),
  "notifier": (ctx) => notify({ sent: (ctx["sent"] ?? []) as Array<{ channel: "email" | "sms"; to: string; message: string }>, channel: ctx["notifyChannel"] as "email" | "sms", to: ctx["email"] as string, message: ctx["notifyMessage"] as string }),
  "audit-logger": (ctx) => appendAuditLog({ logs: (ctx["logs"] ?? []) as Array<{ timestamp: string; action: string; detail: string }>, timestamp: ctx["timestamp"] as string, action: "register", detail: ctx["email"] as string }),
};

// ── 读配置 ──────────────────────────────────────────────────
function loadConfig(path: string) {
  const raw = readFileSync(path, "utf-8");
  const stripped = raw.replace(/^\s*\/\/.*$/gm, "");
  return JSON.parse(stripped);
}

// ── 执行装配流 ──────────────────────────────────────────────
export interface RegisterInput {
  email: string;
  password: string;
  salt: string;
  timestamp: string;
}

export interface RegisterResult {
  success: boolean;
  error?: string;
  context: Record<string, unknown>;
}

export function assembleAndRun(configPath: string, input: RegisterInput): RegisterResult {
  const config = loadConfig(configPath);

  // 上下文 = 配置参数 + 调用方输入
  const context: Record<string, unknown> = {
    ...(config.params ?? {}),
    ...input,
  };

  // 关键：按 config.steps 遍历——顺序、数量都由配置决定
  for (const step of config.steps) {
    const blockName: string = step.block;
    const blockFn = blockRegistry[blockName];

    if (!blockFn) {
      return { success: false, error: `块 "${blockName}" 未注册`, context };
    }

    // 执行块，把输出摊平到上下文
    const output = blockFn(context);
    if (typeof output === "object" && output !== null) {
      for (const [k, v] of Object.entries(output as Record<string, unknown>)) {
        context[k] = v;
      }
    }

    // 如果块返回了 valid: false，中断流程（校验失败）
    if ("valid" in (output as Record<string, unknown>) && (output as Record<string, unknown>)["valid"] === false) {
      return { success: false, error: (output as Record<string, unknown>)["errorCode"] as string, context };
    }
  }

  return { success: true, context };
}

// ── 直接运行 ────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const isDirectRun = process.argv[1]?.includes("assemble");
if (isDirectRun) {
  const configPath = resolve(__dirname, "configs/register.jsonc");
  const result = assembleAndRun(configPath, {
    email: "test@example.com",
    password: "P@ss1234",
    salt: "fixed-salt-for-demo",
    timestamp: "2026-06-25T12:00:00Z",
  });
  console.log(JSON.stringify(result, null, 2));
}
