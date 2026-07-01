/**
 * 【JSONC 解析】src/jsonc.ts —— 唯一实现，浏览器入口与测试共用
 * ────────────────────────────────────────────────────────────
 * 背景（如实记录于 REPORT.md 第四节）：浏览器 demo 曾因 main.ts 与
 * tests/assemble-walk.test.ts 各自维护一套独立的"剥 // 注释"正则而白屏——
 * main.ts 按 `\n` 切分，walk.jsonc 是 CRLF，行尾残留的 `\r` 让注释正则失配，
 * `JSON.parse` 在首个注释行炸掉；测试用了另一套正则，从未走到这个坑，故
 * "测试全绿"没能守住"浏览器真的能跑"。
 *
 * 修复不是"把 main.ts 的正则改对"，而是**消灭第二套实现**——把 JSONC 解析
 * 收敛成唯一函数，浏览器入口与测试都从这里 import，物理上不可能再分叉。
 *
 * 只支持行注释（`// ...`），够 walk.jsonc 用；不支持块注释 `/* *\/`、不支持
 * 配置字符串字面量里含 `//`（如 URL）——保持最简，够用即可。
 */

/**
 * 把 JSONC（含 `//` 行注释）解析为对象。
 *   - 按 `/\r?\n/` 切分：一并吃掉 CRLF 的 `\r`，否则残留的 `\r` 会让行注释
 *     正则 `/\/\/.*$/` 失配（`.` 不匹配 `\r`、`$` 不在 `\r` 前锚定）。
 *   - 每行剥掉 `//` 之后的内容，再整体 `JSON.parse`。
 */
export function parseJsonc<T>(raw: string): T {
  const stripped = raw
    .split(/\r?\n/)
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");
  return JSON.parse(stripped) as T;
}
