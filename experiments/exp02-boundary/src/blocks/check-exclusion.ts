/**
 * 【装配块】互斥规则检查（check-exclusion）
 * 纯机制：给定一组"已激活的规则标签"和一组"互斥对"，
 * 返回哪些规则因为互斥而被禁用。
 *
 * 这是实验②的关键块——它把"互斥判断"封进了块里（算法入块、不入配置）。
 * 但问题是：互斥对本身是业务策略，频繁变——放哪？
 */

import { Type, type Static } from "@sinclair/typebox";

const ExclusionPair = Type.Object({
  a: Type.String(),
  b: Type.String(),
  winner: Type.Union([Type.Literal("a"), Type.Literal("b")]), // 冲突时谁赢
});

export const CheckExclusionInput = Type.Object({
  activeRules: Type.Array(Type.String()),         // 当前已激活的规则标签
  exclusions: Type.Array(ExclusionPair),          // 互斥对定义
});
export type CheckExclusionInput = Static<typeof CheckExclusionInput>;

export const CheckExclusionOutput = Type.Object({
  allowed: Type.Array(Type.String()),             // 最终允许的规则
  disabled: Type.Array(Type.String()),            // 被互斥禁用的规则
});
export type CheckExclusionOutput = Static<typeof CheckExclusionOutput>;

export function checkExclusion(input: CheckExclusionInput): CheckExclusionOutput {
  const disabled = new Set<string>();
  const active = new Set(input.activeRules);

  for (const ex of input.exclusions) {
    if (active.has(ex.a) && active.has(ex.b)) {
      // 两个都激活了，互斥，禁用输家
      const loser = ex.winner === "a" ? ex.b : ex.a;
      disabled.add(loser);
    }
  }

  const allowed = input.activeRules.filter((r) => !disabled.has(r));
  return { allowed, disabled: [...disabled] };
}
