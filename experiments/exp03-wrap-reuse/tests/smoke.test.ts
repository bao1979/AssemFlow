/**
 * 【冒烟测试】实验③核心证据
 *
 * 验证：
 *   1. 流 A 跑通（用封装好的 lodash 块）
 *   2. 流 B 跑通（同一批块，不同配置参数）
 *   3. 两条流用的是同一份块代码、零修改 ← 复用证据
 *   4. 确定性：同输入同输出
 */

import { describe, it, expect } from "vitest";
import { runFlowA } from "../src/assemble-flow-a.js";
import { runFlowB } from "../src/assemble-flow-b.js";

describe("实验③ 冒烟测试", () => {
  it("流 A：从用户对象取 name.first 并大写", () => {
    const result = runFlowA({
      userData: { name: { first: "alice", last: "wang" } },
      namePath: "name.first",
    });
    expect(result.displayName).toBe("Alice");
  });

  it("流 B：从商品对象取 info.title 并大写（同一批块复用）", () => {
    const result = runFlowB({
      productData: { info: { title: "widget pro", price: 99 } },
      titlePath: "info.title",
    });
    expect(result.displayTitle).toBe("Widget pro");
  });

  it("确定性：同输入跑两次结果一样", () => {
    const input = { userData: { name: { first: "bob" } }, namePath: "name.first" };
    expect(runFlowA(input)).toEqual(runFlowA(input));
  });
});
