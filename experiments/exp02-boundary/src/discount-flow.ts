/**
 * 【拼装】折扣计算流 —— 纯 AFP 方式尝试
 * ────────────────────────────────────────────────────────────
 * 场景：一个订单（含金额、用户类型、是否新人、当前时间）要经过多条折扣规则。
 *
 * 设计记录（按步骤记录"到这里还行/别扭/崩了"）：
 *
 * ✅ 还行：check-threshold（满减判断）和 apply-discount（打折）作为纯机制块没问题。
 *
 * ⚠️ 开始别扭："哪些规则生效"取决于运行时数据（金额、用户类型、是否新人、时间）。
 *    纪律说"依赖运行时数据的谓词不能留配置"，必须封进块。
 *    但业务想"随时改规则"——如果规则判断在块里，改规则就要改代码。
 *    → 张力出现：配置不准放算法 vs 业务想在配置里改规则。
 *
 * ❌ 崩了：互斥规则。
 *    - "满减和新人券不能同时用"是业务策略，频繁变。
 *    - 但互斥判断本身是算法（遍历 + 决定谁赢）。
 *    - 算法必须在块里 → 互斥对定义作为"数据"传入块 → 可以！
 *    - 但问题是：多规则叠加后的最终效果，依赖规则执行顺序 + 互斥结果 + 各规则的折扣效果。
 *      这是一个"动态管道"——管道本身的结构取决于运行时数据，不能静态枚举。
 *
 * 下面的实现展示了"纯 AFP 方式"的极限：能走多远、在哪被迫妥协。
 */

import { checkThreshold } from "./blocks/check-threshold.js";
import { applyDiscount } from "./blocks/apply-discount.js";
import { checkExclusion } from "./blocks/check-exclusion.js";

export interface Order {
  amount: number;
  userType: "normal" | "vip";
  isNewUser: boolean;
  currentTime: string; // ISO 时间戳，显式传入
}

export interface DiscountRule {
  name: string;
  condition: (order: Order) => boolean; // ← 崩点：条件是函数（算法），不能放配置
  mode: "percent" | "fixed";
  value: number;
}

export interface DiscountResult {
  originalAmount: number;
  finalAmount: number;
  appliedRules: string[];
  disabledRules: string[];
}

/**
 * 核心矛盾在 rules 参数：
 *   - condition 是函数 → 不能放 JSON 配置（物理上塞不进算法）
 *   - 但业务想频繁改 condition → 不想每次都改代码
 *   - AFP 的甜区假设（只改配置就能改行为）在这里失效。
 */
export function calculateDiscount(order: Order, rules: DiscountRule[], exclusions: { a: string; b: string; winner: "a" | "b" }[]): DiscountResult {
  // 步骤 1：判断哪些规则的条件满足
  const activeRules = rules.filter((r) => r.condition(order)).map((r) => r.name);

  // 步骤 2：互斥检查（这步本身 OK——算法在块里，互斥对作为数据传入）
  const exclusionResult = checkExclusion({ activeRules, exclusions });

  // 步骤 3：按允许的规则逐个打折（顺序叠加）
  let currentAmount = order.amount;
  const applied: string[] = [];

  for (const ruleName of exclusionResult.allowed) {
    const rule = rules.find((r) => r.name === ruleName)!;

    // 满减还需要对当前金额再判一次阈值（可选）
    if (rule.mode === "fixed") {
      const thresholdCheck = checkThreshold({ amount: currentAmount, threshold: rule.value });
      if (!thresholdCheck.met) continue; // 当前金额已经低于直减值，跳过
    }

    const result = applyDiscount({ amount: currentAmount, mode: rule.mode, value: rule.value });
    currentAmount = result.discounted;
    applied.push(ruleName);
  }

  return {
    originalAmount: order.amount,
    finalAmount: currentAmount,
    appliedRules: applied,
    disabledRules: exclusionResult.disabled,
  };
}
