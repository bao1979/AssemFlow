import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { hashPassword } from "../src/blocks/password-hasher";

describe("password-hasher 装配块", () => {
  it("确定性：同 password + 同 salt → 同 hash", () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (password, salt) => {
        const a = hashPassword({ password, salt });
        const b = hashPassword({ password, salt });
        expect(a).toEqual(b);
      }),
    );
  });

  it("不同盐产出不同哈希", () => {
    const a = hashPassword({ password: "123", salt: "saltA" });
    const b = hashPassword({ password: "123", salt: "saltB" });
    expect(a.hash).not.toBe(b.hash);
  });
});
