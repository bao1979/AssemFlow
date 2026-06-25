import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { notify } from "../src/blocks/notifier";

describe("notifier 装配块", () => {
  it("确定性：同样输入永远得到同样输出", () => {
    const channel = fc.constantFrom("email" as const, "sms" as const);
    fc.assert(
      fc.property(channel, fc.string(), fc.string(), (ch, to, msg) => {
        const input = { sent: [], channel: ch, to, message: msg };
        expect(notify(input)).toEqual(notify(input));
      }),
    );
  });

  it("追加一条通知到已发列表", () => {
    const result = notify({ sent: [], channel: "email", to: "a@b.com", message: "hi" });
    expect(result.sent).toHaveLength(1);
    expect(result.sent[0]).toEqual({ channel: "email", to: "a@b.com", message: "hi" });
  });
});
