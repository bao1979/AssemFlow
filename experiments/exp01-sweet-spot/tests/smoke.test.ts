/**
 * 【冒烟测试】实验①核心证据
 * ────────────────────────────────────────────────────────────
 * 验证 4 件事（对应 README 里的冒烟断言）：
 *   1. 正常跑通注册流
 *   2. 只改配置（email→sms），不改任何块代码，行为就变了 ← 核心
 *   3. 邮箱非法时，拼装正确拦截并报错
 *   4. 同配置同输入跑两次，结果完全一样（确定性）
 */

import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { writeFileSync } from "node:fs";
import { assembleAndRun, type RegisterInput } from "../src/assemble.js";

const CONFIG_PATH = resolve(import.meta.dirname!, "../src/configs/register.jsonc");

// 一份固定输入，保证每次测试结果一样
const INPUT: RegisterInput = {
  email: "alice@example.com",
  password: "Str0ng!Pass",
  salt: "test-salt-fixed",
  timestamp: "2026-06-25T00:00:00Z",
};

describe("实验① 冒烟测试", () => {
  it("1. 正常跑通注册流", () => {
    const result = assembleAndRun(CONFIG_PATH, INPUT);
    expect(result.success).toBe(true);
    expect(result.users).toHaveLength(1);
    expect(result.users![0].email).toBe("alice@example.com");
    expect(result.logs).toHaveLength(1);
    expect(result.sent).toHaveLength(1);
  });

  it("2. 只改配置（email→sms），不改块代码，通知渠道就变了 ← 核心证据", () => {
    // 写一份临时配置，只把 notifyChannel 改成 sms
    const tempConfig = resolve(import.meta.dirname!, "../src/configs/_temp_sms.jsonc");
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
    // 核心断言：通知走了 sms，而我们没改任何块的代码
    expect(result.notifyChannel).toBe("sms");
    expect(result.sent![0].channel).toBe("sms");
    expect(result.sent![0].message).toBe("短信欢迎！");
  });

  it("3. 邮箱非法时正确拦截", () => {
    const result = assembleAndRun(CONFIG_PATH, { ...INPUT, email: "bad" });
    expect(result.success).toBe(false);
    expect(result.error).toBe("email_invalid");
  });

  it("4. 确定性：同配置同输入，跑两次结果完全一样", () => {
    const a = assembleAndRun(CONFIG_PATH, INPUT);
    const b = assembleAndRun(CONFIG_PATH, INPUT);
    expect(a).toEqual(b);
  });
});
