import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { appendAuditLog } from "../src/blocks/audit-logger";

describe("audit-logger 装配块", () => {
  it("确定性：同样输入永远得到同样输出", () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), fc.string(), (ts, action, detail) => {
        const input = { logs: [], timestamp: ts, action, detail };
        expect(appendAuditLog(input)).toEqual(appendAuditLog(input));
      }),
    );
  });

  it("追加一条记录后列表长度 +1", () => {
    const result = appendAuditLog({ logs: [], timestamp: "t", action: "register", detail: "a@b" });
    expect(result.logs).toHaveLength(1);
    expect(result.logs[0].action).toBe("register");
  });
});
