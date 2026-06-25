/**
 * assemflow CLI
 *
 * 用法：
 *   assemflow check <config.json> [--blocks <blocks-manifest.json>]
 *   assemflow graph <config.json>
 *
 * check：接入 checkConfig，做悬空引用 + 契约对齐 + 死配置检测。
 *        需要块清单文件来知道有哪些块可用（及其 schema）。
 *
 * assemble：需要注册块（含 execute 函数），纯 CLI 无法提供——
 *           请通过库 API 编程调用。这不是能力缺失，是设计决定：
 *           assemble 必须有块的实现代码，不可能只靠 JSON 描述。
 *
 * graph：纯配置 → Mermaid 文本，不需要块注册。
 */

import { parseArgs } from "node:util";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Type } from "@sinclair/typebox";
import { BlockRegistry } from "./registry.js";
import { checkConfig } from "./check.js";
import { generateGraph } from "./graph.js";
import type { FlowConfig, BlockDef } from "./types.js";

function loadJsonc(path: string): unknown {
  const raw = readFileSync(resolve(path), "utf-8");
  const stripped = raw.replace(/^\s*\/\/.*$/gm, "");
  return JSON.parse(stripped);
}

/**
 * 从块清单文件加载注册表。
 * 清单格式：{ blocks: [{ name, inputSchema, outputSchema }] }
 * 没有 execute 函数——check 不需要执行，只需要 schema。
 */
function loadRegistry(manifestPath: string): BlockRegistry {
  const manifest = loadJsonc(manifestPath) as {
    blocks: Array<{ name: string; inputSchema?: object; outputSchema?: object }>;
  };
  const reg = new BlockRegistry();
  for (const b of manifest.blocks) {
    const def: BlockDef = {
      name: b.name,
      inputSchema: (b.inputSchema ?? Type.Object({})) as BlockDef["inputSchema"],
      outputSchema: (b.outputSchema ?? Type.Object({})) as BlockDef["outputSchema"],
      execute: () => ({}), // check 不执行块
    };
    reg.register(def);
  }
  return reg;
}

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    blocks: { type: "string", short: "b" },
  },
});
const [command, configPath] = positionals;

if (!command || !configPath) {
  console.log("用法:");
  console.log("  assemflow check <config.json> --blocks <manifest.json>");
  console.log("  assemflow graph <config.json>");
  console.log("");
  console.log("assemble 请通过库 API 编程调用（需注册块实现）。");
  process.exit(1);
}

const config = loadJsonc(configPath) as FlowConfig;

switch (command) {
  case "check": {
    if (!values.blocks) {
      console.error("❌ check 需要 --blocks 参数指定块清单文件");
      process.exit(1);
    }
    const registry = loadRegistry(values.blocks);
    const diagnostics = checkConfig(config, registry);
    if (diagnostics.length === 0) {
      console.log(`✅ 配置 "${config.flowName}" 校验通过（${config.steps.length} 步，零诊断）`);
    } else {
      for (const d of diagnostics) {
        const prefix = d.level === "error" ? "❌" : "⚠️";
        console.log(`${prefix} [步骤 ${d.step}] ${d.message}`);
      }
      const errors = diagnostics.filter((d) => d.level === "error");
      if (errors.length > 0) process.exit(1);
    }
    break;
  }
  case "graph":
    console.log(generateGraph(config));
    break;
  default:
    console.error(`未知命令: ${command}`);
    console.error('可用命令: check, graph（assemble 请通过库 API）');
    process.exit(1);
}
