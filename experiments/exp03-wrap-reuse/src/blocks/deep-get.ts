/**
 * 【封装块】深层取值（deep-get）
 * ────────────────────────────────────────────────────────────
 * 封装自：lodash-es/get
 * 签名特征：多参数（对象 + 路径 + 默认值）。
 *
 * 封装成本：薄壳 ≤ 10 行。把 lodash 的宽泛签名收窄为 JSON Schema 可描述的形态。
 * 纯度：lodash get 是纯函数，封装后仍然是。
 *
 * 注意：lodash get 的 object 参数是 any，但 JSON Schema 不能表达 any 的结构。
 * 解法：用 Type.Unknown() 表示"任意 JSON 值"——引擎不校验 object 内部结构，
 * 只保证 path 和 defaultValue 有类型。这是封装宽泛签名时的通用模式。
 */

import { Type, type Static } from "@sinclair/typebox";
import { get as _get } from "lodash-es";

export const DeepGetInput = Type.Object({
  object: Type.Unknown(),            // 任意 JSON 对象
  path: Type.String(),               // 取值路径，如 "a.b[0].c"
  defaultValue: Type.Optional(Type.Unknown()), // 取不到时的默认值
});
export type DeepGetInput = Static<typeof DeepGetInput>;

export const DeepGetOutput = Type.Object({
  value: Type.Unknown(),
});
export type DeepGetOutput = Static<typeof DeepGetOutput>;

export function deepGet(input: DeepGetInput): DeepGetOutput {
  const value = _get(input.object, input.path, input.defaultValue);
  return { value };
}
