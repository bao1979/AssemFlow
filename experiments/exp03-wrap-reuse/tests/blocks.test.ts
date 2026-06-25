/**
 * 封装块测试：验证封装后的块是否满足 AFP 纪律（确定性）。
 * now-timestamp 是故意的反例——预期确定性测试会失败。
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { capitalize } from "../src/blocks/capitalize.js";
import { deepGet } from "../src/blocks/deep-get.js";
import { nowTimestamp } from "../src/blocks/now-timestamp.js";

describe("capitalize 封装块", () => {
  it("确定性：同输入同输出", () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        expect(capitalize({ text })).toEqual(capitalize({ text }));
      }),
    );
  });

  it("首字母大写、其余小写", () => {
    expect(capitalize({ text: "hELLO" }).result).toBe("Hello");
  });
});

describe("deep-get 封装块", () => {
  it("确定性：同输入同输出", () => {
    fc.assert(
      fc.property(fc.string(), (path) => {
        const input = { object: { a: { b: 1 } }, path, defaultValue: null };
        expect(deepGet(input)).toEqual(deepGet(input));
      }),
    );
  });

  it("能取到嵌套值", () => {
    const result = deepGet({ object: { a: { b: 42 } }, path: "a.b" });
    expect(result.value).toBe(42);
  });

  it("取不到时返回默认值", () => {
    const result = deepGet({ object: {}, path: "x.y", defaultValue: "fallback" });
    expect(result.value).toBe("fallback");
  });
});

describe("now-timestamp 反例", () => {
  it("不满足确定性（预期失败——两次调用结果不同）", () => {
    // 这里我们验证"它确实是不确定的"——两次调用间隔后结果不同
    const a = nowTimestamp({});
    // 制造微小时间差
    let b = nowTimestamp({});
    // 如果毫秒级太快可能相等，循环到不等为止（最多 100 次）
    for (let i = 0; i < 100 && b.timestamp === a.timestamp; i++) {
      for (let j = 0; j < 10000; j++) { /* 消耗时间 */ }
      b = nowTimestamp({});
    }
    // 核心断言：非纯函数，两次结果不同——证明属性测试会抓住它
    expect(b.timestamp).not.toBe(a.timestamp);
  });
});
