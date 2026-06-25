/**
 * 【流 B】处理商品数据：取嵌套字段 + 首字母大写
 * 场景：从商品对象里取 info.title，首字母大写后返回。
 *
 * 关键点：用的是和流 A 完全相同的两个块（deepGet + capitalize），
 * 零修改块代码——只是换了配置参数（路径不同、输入数据不同）。
 * 这就是实验③要验证的"复用"。
 */

import { deepGet } from "./blocks/deep-get.js";
import { capitalize } from "./blocks/capitalize.js";

export interface FlowBInput {
  productData: unknown;
  titlePath: string;
}

export interface FlowBOutput {
  displayTitle: string;
}

export function runFlowB(input: FlowBInput): FlowBOutput {
  const raw = deepGet({ object: input.productData, path: input.titlePath, defaultValue: "" });
  const capped = capitalize({ text: String(raw.value) });
  return { displayTitle: capped.result };
}
