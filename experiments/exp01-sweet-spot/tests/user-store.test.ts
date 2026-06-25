import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { storeUser } from "../src/blocks/user-store";

describe("user-store 装配块", () => {
  it("确定性：同样输入永远得到同样输出", () => {
    const userArb = fc.record({ email: fc.string(), passwordHash: fc.string() });
    fc.assert(
      fc.property(fc.array(userArb), userArb, (users, newUser) => {
        const a = storeUser({ users, newUser });
        const b = storeUser({ users, newUser });
        expect(a).toEqual(b);
      }),
    );
  });

  it("追加一个用户后列表长度 +1", () => {
    const result = storeUser({ users: [], newUser: { email: "a@b.com", passwordHash: "h" } });
    expect(result.users).toHaveLength(1);
  });
});
