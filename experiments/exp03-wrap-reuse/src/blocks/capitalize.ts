/**
 * 【封装块】首字母大写（capitalize）
 * ────────────────────────────────────────────────────────────
 * 封装自：lodash-es/capitalize
 * 签名特征：单参数纯函数——最简单的情况。
 *
 * 封装成本：薄壳 ≤ 5 行（不算注释），只做"入参拆包 → 调 lodash → 出参装包"。
 * 纯度：lodash capitalize 是纯函数（同输入同输出），封装后仍然是。
 */

import { Type, type Static } from "@sinclair/typebox";
import { capitalize as _capitalize } from "lodash-es";

export const CapitalizeInput = Type.Object({
  text: Type.String(),
});
export type CapitalizeInput = Static<typeof CapitalizeInput>;

export const CapitalizeOutput = Type.Object({
  result: Type.String(),
});
export type CapitalizeOutput = Static<typeof CapitalizeOutput>;

export function capitalize(input: CapitalizeInput): CapitalizeOutput {
  return { result: _capitalize(input.text) };
}
