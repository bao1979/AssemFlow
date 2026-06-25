/**
 * 引擎核心测试：用简化版注册流验证 check/assemble/graph 三个能力。
 */

import { describe, it, expect } from "vitest";
import { Type } from "@sinclair/typebox";
import { BlockRegistry, checkConfig, assemble, generateGraph } from "../src/index.js";
import type { FlowConfig, BlockDef } from "../src/index.js";

// ── 模拟两个简单块 ─────────────────────────────────────────

const greetBlock: BlockDef = {
  name: "greet",
  inputSchema: Type.Object({ name: Type.String() }),
  outputSchema: Type.Object({ greeting: Type.String() }),
  execute: (input: unknown) => {
    const { name } = input as { name: string };
    return { greeting: `Hello, ${name}!` };
  },
};

const upperBlock: BlockDef = {
  name: "upper",
  inputSchema: Type.Object({ text: Type.String() }),
  outputSchema: Type.Object({ result: Type.String() }),
  execute: (input: unknown) => {
    const { text } = input as { text: string };
    return { result: text.toUpperCase() };
  },
};

// ── 配置 ────────────────────────────────────────────────────

const validConfig: FlowConfig = {
  flowName: "test-flow",
  steps: [
    { block: "greet", inputMap: { name: "userName" } },
    { block: "upper", inputMap: { text: "greeting" } },
  ],
  params: { userName: "alice" },
};

const badRefConfig: FlowConfig = {
  flowName: "bad-flow",
  steps: [{ block: "nonexistent" }],
};

// ── 测试 ────────────────────────────────────────────────────

describe("check（静态校验）", () => {
  it("合法配置返回零诊断", () => {
    const reg = new BlockRegistry();
    reg.register(greetBlock);
    reg.register(upperBlock);
    expect(checkConfig(validConfig, reg)).toEqual([]);
  });

  it("引用不存在的块返回错误诊断", () => {
    const reg = new BlockRegistry();
    const diag = checkConfig(badRefConfig, reg);
    expect(diag).toHaveLength(1);
    expect(diag[0].level).toBe("error");
    expect(diag[0].message).toContain("nonexistent");
  });
});

describe("assemble（确定性装配）", () => {
  it("正常流跑通并返回上下文", () => {
    const reg = new BlockRegistry();
    reg.register(greetBlock);
    reg.register(upperBlock);

    const result = assemble(validConfig, reg);
    expect(result.success).toBe(true);
    // greet 块输出存在上下文里
    expect((result.context["greet"] as { greeting: string }).greeting).toBe("Hello, alice!");
  });

  it("引用不存在的块时装配前报错", () => {
    const reg = new BlockRegistry();
    const result = assemble(badRefConfig, reg);
    expect(result.success).toBe(false);
    expect(result.error).toContain("nonexistent");
  });

  it("输入不符合契约时报错", () => {
    const reg = new BlockRegistry();
    reg.register(greetBlock);

    const config: FlowConfig = {
      flowName: "bad-input",
      steps: [{ block: "greet", inputMap: { name: "missing" } }],
      params: {},
    };

    const result = assemble(config, reg);
    expect(result.success).toBe(false);
    expect(result.error).toContain("输入校验失败");
  });

  it("确定性：同配置同输入跑两次结果一样", () => {
    const reg = new BlockRegistry();
    reg.register(greetBlock);
    reg.register(upperBlock);

    const a = assemble(validConfig, reg);
    const b = assemble(validConfig, reg);
    expect(a).toEqual(b);
  });
});

describe("graph（Mermaid 输出）", () => {
  it("输出包含步骤名和 mermaid 标记", () => {
    const output = generateGraph(validConfig);
    expect(output).toContain("```mermaid");
    expect(output).toContain("greet");
    expect(output).toContain("upper");
    expect(output).toContain("test-flow");
  });
});
