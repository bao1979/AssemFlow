/**
 * assemflow graph：输出配置图的 Mermaid 文本
 *
 * 把配置的步骤序列渲染成 Mermaid flowchart，可直接嵌入 Markdown。
 */

import type { FlowConfig } from "./types.js";

/** 对 Mermaid 标签文本做最小转义，避免特殊字符损坏图表语法。 */
function escapeMermaidLabel(text: string): string {
  return text
    .replace(/"/g, "#quot;")
    .replace(/\[/g, "#91;")
    .replace(/\]/g, "#93;");
}

export function generateGraph(config: FlowConfig): string {
  // 空配置：直接返回 Start → End
  if (config.steps.length === 0) {
    return [
      "```mermaid",
      "flowchart TD",
      `  Start([${escapeMermaidLabel(config.flowName)}]) --> End([完成])`,
      "```",
    ].join("\n");
  }

  const lines: string[] = [];
  lines.push("```mermaid");
  lines.push("flowchart TD");
  lines.push(
    `  Start([${escapeMermaidLabel(config.flowName)}]) --> S0[${escapeMermaidLabel(config.steps[0].block)}]`,
  );

  for (let i = 1; i < config.steps.length; i++) {
    lines.push(
      `  S${i - 1}[${escapeMermaidLabel(config.steps[i - 1].block)}] --> S${i}[${escapeMermaidLabel(config.steps[i].block)}]`,
    );
  }

  const last = config.steps.length - 1;
  lines.push(`  S${last}[${escapeMermaidLabel(config.steps[last].block)}] --> End([完成])`);

  lines.push("```");
  return lines.join("\n");
}
