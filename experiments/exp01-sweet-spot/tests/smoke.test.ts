/**
 * 【冒烟测试】实验①核心证据（跑在 engine.assemble() 上的版本）
 *
 * 这版测试调用的 assembleAndRun 内部直接走 @assemflow/core 的 assemble()——
 * 不再是手写 mini-registry，而是真正经过引擎的契约校验、上下文摊平、异常短路。
 *
 * 验证 5 件事：
 *   1. 正常跑通注册流（由 engine 按 steps 驱动）
 *   2. 只改配置（email→sms），不改任何块代码，行为就变了 ← 核心
 *   3. 邮箱非法时，email-validator 抛异常，引擎短路返回 failure
 *   4. 同配置同输入跑两次，结果完全一样（确定性）
 *   5. steps 为空时，什么块都不执行（证明 steps 驱动了装配）
 */

import { describe, it, expect } from "vitest";
import { resolve, dirname } from "node:path";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { assembleAndRun, type RegisterInput } from "../src/assemble.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = resolve(__dirname, "../src/configs/register.jsonc");

const INPUT: RegisterInput = {
  email: "alice@example.com",
  password: "Str0ng!Pass",
  salt: "test-salt-fixed",
  timestamp: "2026-06-25T00:00:00Z",
};

describe("实验① 冒烟测试（engine.assemble 驱动）", () => {
  it("1. 正常跑通注册流（engine 按 steps 驱动）", () => {
    const result = assembleAndRun(CONFIG_PATH, INPUT);
    expect(result.success).toBe(true);
    expect(result.context["users"]).toBeDefined();
    expect((result.context["users"] as unknown[]).length).toBe(1);
    expect(result.context["sent"]).toBeDefined();
    expect(result.context["logs"]).toBeDefined();
  });

  it("2. 只改配置（email→sms），不改块代码，通知渠道就变了 ← 核心证据", () => {
    const tempConfig = resolve(__dirname, "../src/configs/_temp_sms.jsonc");
    const configContent = JSON.stringify({
      flowName: "user-register",
      steps: [
        { block: "email-validator", inputMap: { email: "email" } },
        { block: "password-hasher", inputMap: { password: "password", salt: "salt" } },
        { block: "user-store", inputMap: { users: "users", email: "email", passwordHash: "hash" } },
        {
          block: "notifier",
          inputMap: { sent: "sent", channel: "notifyChannel", to: "email", message: "notifyMessage" },
        },
        {
          block: "audit-logger",
          inputMap: { logs: "logs", timestamp: "timestamp", action: "auditAction", detail: "email" },
        },
      ],
      params: { notifyChannel: "sms", notifyMessage: "短信欢迎！", auditAction: "register" },
    });
    writeFileSync(tempConfig, configContent, "utf-8");

    const result = assembleAndRun(tempConfig, INPUT);
    expect(result.success).toBe(true);
    const sent = result.context["sent"] as Array<{ channel: string; message: string }>;
    expect(sent[0].channel).toBe("sms");
    expect(sent[0].message).toBe("短信欢迎！");
  });

  it("3. 邮箱非法时引擎短路（email-validator 抛异常 → failure）", () => {
    const result = assembleAndRun(CONFIG_PATH, { ...INPUT, email: "bad" });
    expect(result.success).toBe(false);
    // 引擎把异常信息包成「块 "x" 执行抛出异常: <errorCode>」
    expect(result.error).toContain("email-validator");
    expect(result.error).toContain("email_invalid");
    // 短路：后面的块都没跑，users 还是空
    expect((result.context["users"] as unknown[]).length).toBe(0);
  });

  it("4. 确定性：同配置同输入，跑两次结果完全一样", () => {
    const a = assembleAndRun(CONFIG_PATH, INPUT);
    const b = assembleAndRun(CONFIG_PATH, INPUT);
    expect(a).toEqual(b);
  });

  it("5. steps 为空 → 什么块都不执行（证明 steps 驱动装配）", () => {
    const tempConfig = resolve(__dirname, "../src/configs/_temp_empty.jsonc");
    const configContent = JSON.stringify({
      flowName: "empty-flow",
      steps: [],
      params: { notifyChannel: "email", notifyMessage: "hi", auditAction: "register" },
    });
    writeFileSync(tempConfig, configContent, "utf-8");

    const result = assembleAndRun(tempConfig, INPUT);
    expect(result.success).toBe(true);
    // 空 steps：context 里 users/sent/logs 仍是 initialInput 注入的空数组
    expect((result.context["users"] as unknown[]).length).toBe(0);
    expect((result.context["sent"] as unknown[]).length).toBe(0);
    expect((result.context["logs"] as unknown[]).length).toBe(0);
  });
});
