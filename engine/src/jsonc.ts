/**
 * JSONC 解析工具：统一全仓库的 JSONC（含 `//` 行注释）解析。
 *
 * 这是仓库中唯一的 JSONC 解析实现，engine CLI 与所有实验均从此处导入。
 *
 * 特性：
 *   - 按 `/\r?\n/` 切分：正确处理 CRLF 行尾（`\r` 不会残留导致注释正则失配）
 *   - 每行剥除 `//` 及之后内容（支持行内注释，如 `"key": "val" // 说明`）
 *   - 注意：不处理 JSON 字符串字面量内的 `//`（如 URL `"https://..."`），
 *     该场景极少出现在配置文件中；若出现，请将值中的 `//` 替换或使用成熟 JSONC 库
 *
 * 浏览器与 Node.js 均可使用（纯字符串处理，无 node:fs 依赖）。
 */

/**
 * 解析含行注释的 JSONC 文本为指定类型。
 *
 * @param raw - 原始 JSONC 文本（含 `//` 行注释）
 * @returns 解析后的对象
 * @throws 当 JSON 语法无效时抛出 SyntaxError
 */
export function parseJsonc<T>(raw: string): T {
  const stripped = raw
    .split(/\r?\n/)
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");
  return JSON.parse(stripped) as T;
}
