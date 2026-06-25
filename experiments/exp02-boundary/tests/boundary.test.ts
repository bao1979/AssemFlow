/**
 * 实验② 测试：验证折扣流能跑通，同时暴露 AFP 的边界。
 */

import { describe, it, expect } from "vitest";
import { calculateDiscount, type DiscountRule, type Order } from "../src/discount-flow.js";

const rules: DiscountRule[] = [
  {
    name: "满200减30",
    condition: (o) => o.amount >= 200,
    mode: "fixed",
    value: 30,
  },
  {
    name: "VIP 九折",
    condition: (o) => o.userType === "vip",
    mode: "percent",
    value: 10,
  },
  {
    name: "新人立减50",
    condition: (o) => o.isNewUser,
    mode: "fixed",
    value: 50,
  },
];

// 满减和新人券互斥，满减优先
const exclusions = [{ a: "满200减30", b: "新人立减50", winner: "a" as const }];

describe("折扣计算流（边界探测）", () => {
  it("普通用户 250 元：满减生效（-30）", () => {
    const order: Order = { amount: 250, userType: "normal", isNewUser: false, currentTime: "2026-01-01" };
    const result = calculateDiscount(order, rules, exclusions);
    expect(result.finalAmount).toBe(220);
    expect(result.appliedRules).toContain("满200减30");
  });

  it("VIP 用户 250 元：满减 + VIP 折叠加", () => {
    const order: Order = { amount: 250, userType: "vip", isNewUser: false, currentTime: "2026-01-01" };
    const result = calculateDiscount(order, rules, exclusions);
    // 先满减 250-30=220，再 VIP 九折 220*0.9=198
    expect(result.finalAmount).toBe(198);
    expect(result.appliedRules).toEqual(["满200减30", "VIP 九折"]);
  });

  it("新人 VIP 250 元：新人券被互斥禁用", () => {
    const order: Order = { amount: 250, userType: "vip", isNewUser: true, currentTime: "2026-01-01" };
    const result = calculateDiscount(order, rules, exclusions);
    expect(result.disabledRules).toContain("新人立减50");
    expect(result.appliedRules).not.toContain("新人立减50");
  });

  it("100 元普通用户：无规则命中", () => {
    const order: Order = { amount: 100, userType: "normal", isNewUser: false, currentTime: "2026-01-01" };
    const result = calculateDiscount(order, rules, exclusions);
    expect(result.finalAmount).toBe(100);
    expect(result.appliedRules).toHaveLength(0);
  });

  it("确定性：同输入同输出", () => {
    const order: Order = { amount: 300, userType: "vip", isNewUser: true, currentTime: "2026-06-01" };
    const a = calculateDiscount(order, rules, exclusions);
    const b = calculateDiscount(order, rules, exclusions);
    expect(a).toEqual(b);
  });
});
