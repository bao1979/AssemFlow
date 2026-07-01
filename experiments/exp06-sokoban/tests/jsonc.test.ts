/**
 * 【JSONC 解析测试】tests/jsonc.test.ts
 * ────────────────────────────────────────────────────────────
 * 守住 src/jsonc.ts 的唯一实现——这是"main.ts 与测试各用一套解析逻辑
 * 导致浏览器白屏"这个真实 bug（见 REPORT.md 第四节）的根治验证：
 *   1. CRLF 行尾的行注释必须被正确剥掉（回归测试：当年的真实故障场景）。
 *   2. 真实 walk.jsonc（CRLF + 行注释）能被正确解析出预期结构。
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { parseJsonc } from "../src/jsonc.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("parseJsonc · CRLF 回归（曾致浏览器白屏的真实故障场景）", () => {
  it("CRLF 行尾 + 行注释：注释被正确剥掉，JSON 解析成功", () => {
    const raw = '{\r\n  // 这是一条注释\r\n  "a": 1,\r\n  "b": 2\r\n}\r\n';
    expect(parseJsonc<{ a: number; b: number }>(raw)).toEqual({ a: 1, b: 2 });
  });

  it("LF 行尾也兼容（非 CRLF 场景不退化）", () => {
    const raw = '{\n  // comment\n  "x": "y"\n}\n';
    expect(parseJsonc<{ x: string }>(raw)).toEqual({ x: "y" });
  });

  it("真实 walk.jsonc（CRLF + 行注释）能被正确解析", () => {
    const configPath = resolve(__dirname, "../src/configs/walk.jsonc");
    const raw = readFileSync(configPath, "utf-8");

    const config = parseJsonc<{ flowName: string; steps: unknown[] }>(raw);

    expect(config.flowName).toBe("sokoban-walk");
    expect(config.steps).toHaveLength(1);
  });
});
