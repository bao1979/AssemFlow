/**
 * 【装配块】邮箱格式校验（email-validator）
 * ────────────────────────────────────────────────────────────
 * 这是什么：一个装配块（Block）。装配块是 AFP 五元构件里的"纯机制"——
 *           只做一件与业务无关的、确定的小事。
 *
 * 在 AFP 里的角色：纯机制。它只回答一个问题："这个字符串是不是合法的邮箱格式？"
 *           注册、找回密码、订阅……任何业务都能用它，所以它可以被全球复用（像 lodash）。
 *
 * 为什么存在：把"判断邮箱格式"这件纯机制的事，从具体业务里挤出来，
 *           让它能独立测试、独立复用，不被任何一个业务绑死。
 *
 * 与谁协作：输入一个字符串，输出"合不合法 + 不合法时的错误码"。
 *           至于这个字符串从哪来、不合法了怎么处理，都不归它管——那是配置和别的零件的事。
 *
 * AFP 纪律点：
 *   1. 它是纯函数——同样输入永远同样输出，不读时钟、不依赖全局、无副作用。
 *      这正是装配块"确定性纯机制"的要求，也是它能被属性测试验证的原因。
 *   2. 不合法时返回的是错误码 "email_invalid"，不是中文文案。
 *      错误码是契约（给程序看的），文案是业务内容（归配置/数据），两者必须分开。
 */

import { Type, type Static } from "@sinclair/typebox";

/**
 * 输入契约：这个块需要喂给它什么。
 * 用 TypeBox 写，既能在 TS 里拿到类型，又能产出标准 JSON Schema 供引擎做校验。
 */
export const EmailValidatorInput = Type.Object({
  email: Type.String(), // 待校验的邮箱字符串
});
export type EmailValidatorInput = Static<typeof EmailValidatorInput>;

/**
 * 输出契约：这个块会还给你什么。
 * valid 为 false 时，errorCode 说明为什么不合法。
 */
export const EmailValidatorOutput = Type.Object({
  valid: Type.Boolean(),
  errorCode: Type.Optional(Type.String()),
});
export type EmailValidatorOutput = Static<typeof EmailValidatorOutput>;

// 一个"够用"的邮箱格式正则：必须形如 a@b.c，中间不含空格。
// 教学用，不追求 RFC 完整——真要更严，就升级这个块的内部实现，契约不用变。
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * 纯机制：判断邮箱格式是否合法。
 * 注意它只依赖入参 input，不碰任何外部状态——这就是"确定性"。
 */
export function emailValidate(input: EmailValidatorInput): EmailValidatorOutput {
  if (EMAIL_PATTERN.test(input.email)) {
    return { valid: true };
  }
  // 返回错误码而非文案：文案是业务内容，归配置/数据，不进装配块。
  return { valid: false, errorCode: "email_invalid" };
}
