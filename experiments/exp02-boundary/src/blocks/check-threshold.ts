/**
 * 【装配块】满减判断（check-threshold）
 * 纯机制：判断金额是否达到阈值。阈值作为输入传入（不硬编码）。
 */

import { Type, type Static } from "@sinclair/typebox";

export const CheckThresholdInput = Type.Object({
  amount: Type.Number(),
  threshold: Type.Number(),
});
export type CheckThresholdInput = Static<typeof CheckThresholdInput>;

export const CheckThresholdOutput = Type.Object({
  met: Type.Boolean(),
});
export type CheckThresholdOutput = Static<typeof CheckThresholdOutput>;

export function checkThreshold(input: CheckThresholdInput): CheckThresholdOutput {
  return { met: input.amount >= input.threshold };
}
