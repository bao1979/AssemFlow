/**
 * 【装配块】存用户（user-store）
 * ────────────────────────────────────────────────────────────
 * 这是什么：一个装配块，纯机制——把一个用户追加到用户列表里。
 *
 * AFP 纪律点：
 *   不连真实数据库（那是外部副作用、不确定）。
 *   把"当前用户列表"作为输入传进来，返回"追加后的新列表"。
 *   这样它就是纯函数——同样的旧列表 + 新用户 → 永远同样的新列表。
 *   真实场景里，"读旧列表"和"写回去"由拼装脚本/运行环境负责，块不管。
 *
 * 契约形状说明：
 *   输入采用"扁平字段"而非"嵌套 newUser 对象"，原因——
 *   引擎当前的 inputMap 只支持"字段重命名"，不支持"从上下文构造嵌套对象"。
 *   扁平化后，每个字段都能直接从上下文映射；构造 user 对象由块内部完成。
 *   未来引擎 inputMap 增强（支持嵌套构造）后，可考虑回退到 `{users, newUser}`。
 */

import { Type, type Static } from "@sinclair/typebox";

const User = Type.Object({
  email: Type.String(),
  passwordHash: Type.String(),
});

export const UserStoreInput = Type.Object({
  users: Type.Array(User),     // 旧状态（当前已有的用户）
  email: Type.String(),         // 新用户的邮箱
  passwordHash: Type.String(),  // 新用户的密码哈希
});
export type UserStoreInput = Static<typeof UserStoreInput>;

export const UserStoreOutput = Type.Object({
  users: Type.Array(User),     // 新状态（追加后的完整列表）
});
export type UserStoreOutput = Static<typeof UserStoreOutput>;

export function storeUser(input: UserStoreInput): UserStoreOutput {
  return {
    users: [...input.users, { email: input.email, passwordHash: input.passwordHash }],
  };
}
