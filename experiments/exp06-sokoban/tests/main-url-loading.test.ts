// @vitest-environment jsdom
// Feature: sokoban-mvp-3-levels, EXAMPLE: bootstrap URL 装载 + base check + gate 分层
/**
 * bootstrap() 装载期一次性函数的 jsdom 集成测试。
 *
 * 覆盖场景：
 *   1. 正常 URL 参数装载 → container 内含 <pre class="sokoban-grid">
 *   2. 不存在的 level 参数 → 回退默认关
 *   3. 非法字符关卡文本 → bootstrap 抛错 + container.textContent 含诊断
 *   4. base check 通过但不过 gate 的关卡 + 该关在 publishableLevels 中 → bootstrap 抛错
 */

import { describe, it, expect } from "vitest";
import { bootstrap } from "../src/main.js";

// ── 测试用关卡文本 ──────────────────────────────────────────

/** 合法小关卡：2 箱 2 目标，可通过 base check + publishability gate */
const VALID_PUBLISHABLE = [
  "######",
  "#    #",
  "# .$ #",
  "# $. #",
  "# @  #",
  "######",
].join("\n");

/** 合法关卡：0 箱 0 目标（走路关），通过 base check 但不通过 publishability gate */
const VALID_WALK_ONLY = [
  "####",
  "# @#",
  "#  #",
  "####",
].join("\n");

/** 非法字符关卡文本：含 'X' */
const INVALID_CHAR_LEVEL = [
  "####",
  "#X@#",
  "#  #",
  "####",
].join("\n");

/** mock pushConfigRaw：与真实 push.jsonc 结构相同 */
const MOCK_PUSH_CONFIG = JSON.stringify({
  flowName: "sokoban-push",
  steps: [
    { block: "move-with-push", inputMap: { grid: "grid", direction: "direction" } },
    { block: "win-check", inputMap: { grid: "nextGrid" } },
  ],
});

// ── 辅助 ──────────────────────────────────────────────────────

function makeLevels(entries: Record<string, string>): Readonly<Record<string, string>> {
  return entries;
}

// ── 测试用例 ──────────────────────────────────────────────────

describe("bootstrap · URL 装载 + base check + gate 分层", () => {
  it("正常 ?level=<name> → container 内含 <pre class=\"sokoban-grid\">", () => {
    const container = document.createElement("div");
    const levels = makeLevels({ "my-level": VALID_PUBLISHABLE, "default": VALID_PUBLISHABLE });

    const result = bootstrap(
      container,
      "?level=my-level",
      levels,
      "default",
      new Set(["my-level", "default"]),
      MOCK_PUSH_CONFIG,
    );

    // container 内含渲染输出
    const pre = container.querySelector("pre.sokoban-grid");
    expect(pre).not.toBeNull();
    expect(pre!.textContent).toBeTruthy();

    // 返回值正确
    expect(result.levelName).toBe("my-level");
    expect(result.levelText).toBe(VALID_PUBLISHABLE);
  });

  it("?level=<不存在> → 回退默认关", () => {
    const container = document.createElement("div");
    const levels = makeLevels({ "default-level": VALID_PUBLISHABLE });

    const result = bootstrap(
      container,
      "?level=nonexistent",
      levels,
      "default-level",
      new Set(["default-level"]),
      MOCK_PUSH_CONFIG,
    );

    expect(result.levelName).toBe("default-level");
    // 仍正常渲染
    const pre = container.querySelector("pre.sokoban-grid");
    expect(pre).not.toBeNull();
  });

  it("非法字符关卡文本 → bootstrap 抛错 + container.textContent 含诊断", () => {
    const container = document.createElement("div");
    const levels = makeLevels({ "bad-level": INVALID_CHAR_LEVEL });

    expect(() =>
      bootstrap(
        container,
        "?level=bad-level",
        levels,
        "bad-level",
        new Set<string>(),
        MOCK_PUSH_CONFIG,
      ),
    ).toThrow("base check failed");

    // container 显示可读诊断
    expect(container.textContent).toContain("invalid-char");
    expect(container.textContent).toContain("bad-level");
  });

  it("base check 通过但不过 gate 的关卡 + 该关在 publishableLevels 中 → bootstrap 抛错", () => {
    const container = document.createElement("div");
    // walk-only 关卡：0 箱 0 目标，过 base check 但不过 gate（箱子数 < 2）
    const levels = makeLevels({ "walk": VALID_WALK_ONLY, "default": VALID_PUBLISHABLE });

    expect(() =>
      bootstrap(
        container,
        "?level=walk",
        levels,
        "default",
        new Set(["walk"]),  // walk 在 publishableLevels 中
        MOCK_PUSH_CONFIG,
      ),
    ).toThrow("assertPublishableLevel");
  });
});
