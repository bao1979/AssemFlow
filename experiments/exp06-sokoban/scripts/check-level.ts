#!/usr/bin/env node
/**
 * 薄壳 CLI：check-level
 * 用法：npx tsx scripts/check-level.ts <path/to/level.txt>
 * 或：  npm run check-level -- <path/to/level.txt>
 *
 * 只做四件事：读文件 → 调 checkLevel → 打印诊断 → 设 exit code。
 * 不重复实现任何校验逻辑（SSOT · 铁律 2）——校验逻辑唯一真相源是 src/check.ts。
 *
 * Exit code 语义：
 *   0 — 合法
 *   1 — 不合法（stderr 印所有 issues，格式 [rule] message）
 *   2 — 缺参数（stderr 印用法）
 */

import { readFileSync } from "node:fs";
import { checkLevel } from "../src/check.js";

const filePath = process.argv[2];
if (!filePath) {
  console.error("用法：check-level <path/to/level.txt>");
  process.exit(2);
}

const text = readFileSync(filePath, "utf-8");
const result = checkLevel(text);

if (result.ok) {
  console.log(`✅ ${filePath} 通过 base 静态 check`);
  process.exit(0);
} else {
  console.error(`❌ ${filePath} 未通过 base 静态 check（${result.issues.length} 条 issue）`);
  for (const issue of result.issues) {
    console.error(`  [${issue.rule}] ${issue.message}`);
  }
  process.exit(1);
}
