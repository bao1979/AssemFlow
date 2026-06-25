/**
 * email-validator 装配块的测试。
 *
 * 分两类：
 *   1. 属性测试（用 fast-check）——验证 AFP 纪律"确定性纯机制"，这是装配块的硬要求。
 *   2. 普通单元测试——验证具体行为（合法/非法各一例）。
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { emailValidate } from "../src/blocks/email-validator";

describe("email-validator 装配块", () => {
  // 属性测试：对任意字符串，连续调用两次结果必须完全一样。
  // 如果块里偷偷读了时钟/随机/全局状态，这条会失败——这正是我们要守的纪律。
  it("确定性：同样输入永远得到同样输出", () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const a = emailValidate({ email: s });
        const b = emailValidate({ email: s });
        expect(a).toEqual(b);
      }),
    );
  });

  it("明显合法的邮箱判为合法", () => {
    expect(emailValidate({ email: "alice@example.com" }).valid).toBe(true);
  });

  it("明显非法的字符串判为非法，并给出错误码", () => {
    const result = emailValidate({ email: "not-an-email" });
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe("email_invalid");
  });
});
