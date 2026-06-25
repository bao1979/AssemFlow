/**
 * 【装配块】记审计（audit-logger）
 * ────────────────────────────────────────────────────────────
 * 这是什么：一个装配块，纯机制——往审计日志列表里追加一条记录。
 *
 * AFP 纪律点：
 *   不写文件、不打网络——那是外部副作用。
 *   把"当前日志列表"作为输入传进来，返回"追加后的新列表"。
 *   时间戳也作为输入传入（不读系统时钟），保证确定性。
 */

import { Type, type Static } from "@sinclair/typebox";

const AuditEntry = Type.Object({
  timestamp: Type.String(),
  action: Type.String(),
  detail: Type.String(),
});

export const AuditLoggerInput = Type.Object({
  logs: Type.Array(AuditEntry),   // 旧状态
  timestamp: Type.String(),        // 显式传入，不读时钟
  action: Type.String(),
  detail: Type.String(),
});
export type AuditLoggerInput = Static<typeof AuditLoggerInput>;

export const AuditLoggerOutput = Type.Object({
  logs: Type.Array(AuditEntry),   // 新状态
});
export type AuditLoggerOutput = Static<typeof AuditLoggerOutput>;

export function appendAuditLog(input: AuditLoggerInput): AuditLoggerOutput {
  const entry = { timestamp: input.timestamp, action: input.action, detail: input.detail };
  return { logs: [...input.logs, entry] };
}
