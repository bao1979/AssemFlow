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
 */

import { Type, type Static } from "@sinclair/typebox";

const User = Type.Object({
  email: Type.String(),
  passwordHash: Type.String(),
});

export const UserStoreInput = Type.Object({
  users: Type.Array(User),     // 旧状态（当前已有的用户）
  newUser: User,               // 要追加的新用户
});
export type UserStoreInput = Static<typeof UserStoreInput>;

export const UserStoreOutput = Type.Object({
  users: Type.Array(User),     // 新状态（追加后的完整列表）
});
export type UserStoreOutput = Static<typeof UserStoreOutput>;

export function storeUser(input: UserStoreInput): UserStoreOutput {
  return { users: [...input.users, input.newUser] };
}
