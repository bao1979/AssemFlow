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
    // check 阶段就拦住了（上下文字段不存在），比 Ajv 运行时校验更早
    expect(result.error).toContain("missing");
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

// ── 契约对齐 + 死配置检测测试 ────────────────────────────────

describe("check · 契约对齐", () => {
  it("inputMap 引用不存在的上下文字段 → 报错", () => {
    const reg = new BlockRegistry();
    reg.register(greetBlock);

    const config: FlowConfig = {
      flowName: "missing-ctx",
      steps: [{ block: "greet", inputMap: { name: "noSuchField" } }],
      params: {},
    };

    const diag = checkConfig(config, reg);
    expect(diag.some((d) => d.level === "error" && d.message.includes("noSuchField"))).toBe(true);
  });

  it("上步输出类型与下步输入类型不兼容 → 警告", () => {
    const reg = new BlockRegistry();

    // 第一个块输出 number
    const numBlock: BlockDef = {
      name: "num",
      inputSchema: Type.Object({}),
      outputSchema: Type.Object({ value: Type.Number() }),
      execute: () => ({ value: 42 }),
    };

    // 第二个块输入期望 string
    const strBlock: BlockDef = {
      name: "str",
      inputSchema: Type.Object({ text: Type.String() }),
      outputSchema: Type.Object({ out: Type.String() }),
      execute: (i: unknown) => ({ out: String((i as { text: string }).text) }),
    };

    reg.register(numBlock);
    reg.register(strBlock);

    const config: FlowConfig = {
      flowName: "type-mismatch",
      steps: [
        { block: "num" },
        { block: "str", inputMap: { text: "value" } }, // value 是 number，text 期望 string
      ],
    };

    const diag = checkConfig(config, reg);
    expect(diag.some((d) => d.level === "warning" && d.message.includes("不兼容"))).toBe(true);
  });

  it("正常流（greet→upper）契约对齐通过，零诊断", () => {
    const reg = new BlockRegistry();
    reg.register(greetBlock);
    reg.register(upperBlock);
    expect(checkConfig(validConfig, reg)).toEqual([]);
  });
});

describe("check · 死配置检测", () => {
  it("params 里有未被任何 inputMap 引用的参数 → 警告", () => {
    const reg = new BlockRegistry();
    reg.register(greetBlock);

    const config: FlowConfig = {
      flowName: "dead-param",
      steps: [{ block: "greet", inputMap: { name: "userName" } }],
      params: { userName: "alice", unusedParam: "dead" },
    };

    const diag = checkConfig(config, reg);
    expect(diag.some((d) => d.level === "warning" && d.message.includes("unusedParam"))).toBe(true);
  });

  it("所有 params 都被引用 → 无死配置警告", () => {
    const reg = new BlockRegistry();
    reg.register(greetBlock);
    reg.register(upperBlock);

    // validConfig 的 userName 被 greet 的 inputMap 引用
    const diag = checkConfig(validConfig, reg);
    expect(diag.filter((d) => d.message.includes("死配置"))).toHaveLength(0);
  });
});

describe("assemble · 输出校验", () => {
  it("块输出不符合 outputSchema 时报错", () => {
    const reg = new BlockRegistry();

    // 块声明输出 string，但实际返回 number
    const badBlock: BlockDef = {
      name: "bad-output",
      inputSchema: Type.Object({}),
      outputSchema: Type.Object({ value: Type.String() }),
      execute: () => ({ value: 42 }), // 故意返回 number
    };
    reg.register(badBlock);

    const config: FlowConfig = {
      flowName: "output-check",
      steps: [{ block: "bad-output" }],
    };

    const result = assemble(config, reg);
    expect(result.success).toBe(false);
    expect(result.error).toContain("输出校验失败");
  });
});
