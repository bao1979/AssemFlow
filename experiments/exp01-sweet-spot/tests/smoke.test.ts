/**
 * 【冒烟测试】实验①核心证据（修复版）
 *
 * 验证 4 件事：
 *   1. 正常跑通注册流（由 steps 驱动）
 *   2. 只改配置（email→sms），不改任何块代码，行为就变了 ← 核心
 *   3. 邮箱非法时，第一个块返回 valid:false 中断流程
 *   4. 同配置同输入跑两次，结果完全一样（确定性）
 *   5. steps 为空时，什么块都不执行（证明 steps 真的驱动了装配）
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

describe("实验① 冒烟测试", () => {
  it("1. 正常跑通注册流（steps 驱动）", () => {
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
        { block: "email-validator" },
        { block: "password-hasher" },
        { block: "user-store" },
        { block: "notifier" },
        { block: "audit-logger" },
      ],
      params: { notifyChannel: "sms", notifyMessage: "短信欢迎！" },
    });
    writeFileSync(tempConfig, configContent, "utf-8");

    const result = assembleAndRun(tempConfig, INPUT);
    expect(result.success).toBe(true);
    const sent = result.context["sent"] as Array<{ channel: string; message: string }>;
    expect(sent[0].channel).toBe("sms");
    expect(sent[0].message).toBe("短信欢迎！");
  });

  it("3. 邮箱非法时正确中断", () => {
    const result = assembleAndRun(CONFIG_PATH, { ...INPUT, email: "bad" });
    expect(result.success).toBe(false);
    expect(result.error).toBe("email_invalid");
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
      params: { notifyChannel: "email", notifyMessage: "hi" },
    });
    writeFileSync(tempConfig, configContent, "utf-8");

    const result = assembleAndRun(tempConfig, INPUT);
    expect(result.success).toBe(true);
    // 没执行任何块，所以 context 里没有 users/sent/logs
    expect(result.context["users"]).toBeUndefined();
    expect(result.context["sent"]).toBeUndefined();
    expect(result.context["logs"]).toBeUndefined();
  });
});
