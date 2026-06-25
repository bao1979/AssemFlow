/**
 * assemflow graph：输出配置图的 Mermaid 文本
 *
 * 把配置的步骤序列渲染成 Mermaid flowchart，可直接嵌入 Markdown。
 */

import type { FlowConfig } from "./types.js";

export function generateGraph(config: FlowConfig): string {
  const lines: string[] = [];
  lines.push("```mermaid");
  lines.push("flowchart TD");
  lines.push(`  Start([${config.flowName}]) --> S0[${config.steps[0]?.block ?? "空"}]`);

  for (let i = 1; i < config.steps.length; i++) {
    lines.push(`  S${i - 1}[${config.steps[i - 1].block}] --> S${i}[${config.steps[i].block}]`);
  }

  const last = config.steps.length - 1;
  if (last >= 0) {
    lines.push(`  S${last}[${config.steps[last].block}] --> End([完成])`);
  }

  lines.push("```");
  return lines.join("\n");
}
