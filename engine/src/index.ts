/**
 * @assemflow/core 公共 API
 */

export { BlockRegistry } from "./registry.js";
export { checkConfig } from "./check.js";
export { assemble, type AssembleResult } from "./assemble.js";
export { generateGraph } from "./graph.js";
export type { BlockDef, StepConfig, FlowConfig, Diagnostic } from "./types.js";
