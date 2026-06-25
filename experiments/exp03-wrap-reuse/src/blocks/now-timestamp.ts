/**
 * 【反例】当前时间戳（now-timestamp）
 * ────────────────────────────────────────────────────────────
 * 封装自：lodash-es 的 now（等价于 Date.now()）
 * 签名特征：零参数，读系统时钟——**不是纯函数**。
 *
 * 这个块故意做出来，验证"非纯函数封装会怎样"：
 *   - 属性测试（同输入同输出）**预期会失败**——因为两次调用时钟不同。
 *   - 这证明了 AFP 纪律的工程价值：属性测试自动挡住了不确定的块。
 *
 * 正确做法：如果需要时间戳，应该由调用方传入（像实验①的 audit-logger 那样），
 * 而不是块自己偷读时钟。这个反例就是为了展示"偷读时钟会怎样"。
 */

import { Type, type Static } from "@sinclair/typebox";

export const NowTimestampInput = Type.Object({});
export type NowTimestampInput = Static<typeof NowTimestampInput>;

export const NowTimestampOutput = Type.Object({
  timestamp: Type.Number(),
});
export type NowTimestampOutput = Static<typeof NowTimestampOutput>;

// 故意读系统时钟——不确定，属性测试会抓到
export function nowTimestamp(_input: NowTimestampInput): NowTimestampOutput {
  return { timestamp: Date.now() };
}
