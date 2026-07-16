/**
 * 【JSONC 解析】src/jsonc.ts —— 从 @assemflow/core 重导出统一实现
 * ────────────────────────────────────────────────────────────
 * 历史：本文件曾是仓库中的独立 JSONC 解析实现。
 * 现统一使用 engine/src/jsonc.ts 的 `parseJsonc`，此处保留为兼容重导出。
 *
 * 直接使用 `@assemflow/core` 中的 `parseJsonc` 而非本文件可避免额外重导出层。
 */

export { parseJsonc } from "@assemflow/core";

