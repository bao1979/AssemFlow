/**
 * 【装配块】应用折扣（apply-discount）
 * 纯机制：给金额打折或减固定值。折扣方式和值作为输入传入。
 */

import { Type, type Static } from "@sinclair/typebox";

export const ApplyDiscountInput = Type.Object({
  amount: Type.Number(),
  mode: Type.Union([Type.Literal("percent"), Type.Literal("fixed")]),
  value: Type.Number(), // percent 模式：0-100 的折扣百分比；fixed 模式：直减金额
});
export type ApplyDiscountInput = Static<typeof ApplyDiscountInput>;

export const ApplyDiscountOutput = Type.Object({
  discounted: Type.Number(),
  saved: Type.Number(),
});
export type ApplyDiscountOutput = Static<typeof ApplyDiscountOutput>;

export function applyDiscount(input: ApplyDiscountInput): ApplyDiscountOutput {
  let discounted: number;
  if (input.mode === "percent") {
    discounted = input.amount * (1 - input.value / 100);
  } else {
    discounted = input.amount - input.value;
  }
  discounted = Math.max(0, discounted); // 不能为负
  const saved = input.amount - discounted;
  return { discounted, saved };
}
