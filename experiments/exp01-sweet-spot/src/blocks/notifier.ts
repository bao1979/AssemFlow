/**
 * 【装配块】发通知（notifier）
 * ────────────────────────────────────────────────────────────
 * 这是什么：一个装配块，纯机制——把"发送通知"也写成纯数据变换。
 *
 * 在 AFP 里的角色：纯机制。
 *
 * 为什么存在：演示"可插拔通知"——发到哪个渠道由配置选，不由块写死。
 *
 * 与谁协作：输入【已发记录 + 渠道 + 收件人 + 内容】，输出【追加本次发送后的记录】。
 *
 * AFP 纪律点：
 *   不真发邮件/短信——那是外部副作用、不确定、还要凭证。这里用"把发送动作记进一个列表"
 *   来模拟，保证确定、可断言。真正的发送由运行期环境的实现负责。
 *   channel 是枚举（email | sms）——简单二选一，符合"静态可枚举"，所以渠道可以由配置来路由。
 */

import { Type, type Static } from "@sinclair/typebox";

// 通知渠道：有限枚举，可被配置静态路由
export const Channel = Type.Union([Type.Literal("email"), Type.Literal("sms")]);

const Notification = Type.Object({
  channel: Channel,
  to: Type.String(),
  message: Type.String(),
});

export const NotifierInput = Type.Object({
  sent: Type.Array(Notification), // 已发记录（旧状态）
  channel: Channel,
  to: Type.String(),
  message: Type.String(),
});
export type NotifierInput = Static<typeof NotifierInput>;

export const NotifierOutput = Type.Object({
  sent: Type.Array(Notification),
});
export type NotifierOutput = Static<typeof NotifierOutput>;

export function notify(input: NotifierInput): NotifierOutput {
  const record = { channel: input.channel, to: input.to, message: input.message };
  return { sent: [...input.sent, record] };
}
