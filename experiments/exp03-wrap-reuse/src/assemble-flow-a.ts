/**
 * 【流 A】处理用户 profile：取嵌套字段 + 首字母大写
 * 场景：从用户对象里取 name.first，首字母大写后返回。
 */

import { deepGet } from "./blocks/deep-get.js";
import { capitalize } from "./blocks/capitalize.js";

export interface FlowAInput {
  userData: unknown;   // 任意 JSON 对象
  namePath: string;    // 取名字的路径（配置参数）
}

export interface FlowAOutput {
  displayName: string;
}

export function runFlowA(input: FlowAInput): FlowAOutput {
  const raw = deepGet({ object: input.userData, path: input.namePath, defaultValue: "" });
  const capped = capitalize({ text: String(raw.value) });
  return { displayName: capped.result };
}
