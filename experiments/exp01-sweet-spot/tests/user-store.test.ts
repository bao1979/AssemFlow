import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { storeUser } from "../src/blocks/user-store";

describe("user-store 装配块", () => {
  it("确定性：同样输入永远得到同样输出", () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ email: fc.string(), passwordHash: fc.string() })),
        fc.string(),
        fc.string(),
        (users, email, passwordHash) => {
          const a = storeUser({ users, email, passwordHash });
          const b = storeUser({ users, email, passwordHash });
          expect(a).toEqual(b);
        },
      ),
    );
  });

  it("追加一个用户后列表长度 +1", () => {
    const result = storeUser({ users: [], email: "a@b.com", passwordHash: "h" });
    expect(result.users).toHaveLength(1);
    expect(result.users[0]).toEqual({ email: "a@b.com", passwordHash: "h" });
  });
});
