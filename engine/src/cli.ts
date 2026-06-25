/**
 * assemflow CLI 薄入口
 *
 * 用法：
 *   assemflow check <config.json>
 *   assemflow graph <config.json>
 *
 * assemble 需要注册块，不适合纯 CLI 调用（需编程使用库）。
 * CLI 只做不需要块注册的静态操作。
 */

import { parseArgs } from "node:util";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { generateGraph } from "./graph.js";
import type { FlowConfig } from "./types.js";

function loadConfig(path: string): FlowConfig {
  const raw = readFileSync(resolve(path), "utf-8");
  const stripped = raw.replace(/^\s*\/\/.*$/gm, "");
  return JSON.parse(stripped);
}

const { positionals } = parseArgs({ allowPositionals: true });
const [command, configPath] = positionals;

if (!command || !configPath) {
  console.log("用法: assemflow <check|graph> <config.json>");
  process.exit(1);
}

const config = loadConfig(configPath);

switch (command) {
  case "graph":
    console.log(generateGraph(config));
    break;
  case "check":
    // check 需要注册表，纯 CLI 只能做格式校验
    console.log(`✅ 配置 "${config.flowName}" 格式合法，共 ${config.steps.length} 步`);
    break;
  default:
    console.error(`未知命令: ${command}`);
    process.exit(1);
}
