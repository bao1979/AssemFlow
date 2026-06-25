/**
 * 【装配块】加密密码（password-hasher）
 * ────────────────────────────────────────────────────────────
 * 这是什么：一个装配块，纯机制——把明文密码变成不可逆的哈希。
 *
 * AFP 纪律点：
 *   真实哈希库（bcrypt 等）内部会随机生成盐，导致同样输入每次输出不同——不确定。
 *   但块必须确定（同输入同输出），否则属性测试过不了、也违反"确定性纯机制"。
 *
 *   解法：盐作为显式输入传进来。调用方（配置/拼装脚本）决定用什么盐——
 *   真实场景传随机盐（由运行环境生成），测试场景传固定盐（保证可复现）。
 *   块本身永远是确定的：同样的 password + salt = 同样的 hash。
 *
 *   这里用一个极简的"伪哈希"（base64(salt + password)）演示原理。
 *   真实项目换成 bcrypt/argon2 的确定性接口即可，契约不用变。
 */

import { Type, type Static } from "@sinclair/typebox";

export const PasswordHasherInput = Type.Object({
  password: Type.String(),
  salt: Type.String(), // 盐作为显式输入，保证块是确定性的
});
export type PasswordHasherInput = Static<typeof PasswordHasherInput>;

export const PasswordHasherOutput = Type.Object({
  hash: Type.String(),
});
export type PasswordHasherOutput = Static<typeof PasswordHasherOutput>;

export function hashPassword(input: PasswordHasherInput): PasswordHasherOutput {
  // 教学用伪哈希：base64(salt + ":" + password)。
  // 重点不在算法强度，而在「同 password + 同 salt → 永远同 hash」。
  const raw = `${input.salt}:${input.password}`;
  const hash = Buffer.from(raw).toString("base64");
  return { hash };
}
