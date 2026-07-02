// Feature: sokoban-mvp-3-levels, Property 7: URL 关卡分派器的普适行为
// @vitest-environment jsdom

/**
 * 【resolveLevelFromUrl · Property 7 属性测试】tests/resolve-level.test.ts
 * ────────────────────────────────────────────────────────────
 * Property 7（PBT）：fast-check ≥100 iterations 生成 nameCandidate，断言：
 *   - 若 nameCandidate 非空 且 LEVELS[nameCandidate] 有值 → name === nameCandidate
 *   - 否则 → name === DEFAULT_LEVEL
 *   - 恒等：rawText === LEVELS[name]（分派结果自洽）
 *
 * EDGE_CASE：空 search、?level=（空值）、多参数、URL 编码
 *
 * 测试内自造 mock levels map（不 import 真实 LEVELS）。
 *
 * Validates: Requirements 1.5
 */

import { describe, it, expect, beforeAll } from "vitest";
import * as fc from "fast-check";
import type { resolveLevelFromUrl as ResolveFn } from "../src/main.js";

let resolveLevelFromUrl: typeof ResolveFn;

beforeAll(async () => {
  // main.ts 有顶层 DOM 副作用（document.getElementById）需要 #grid 元素存在
  document.body.innerHTML = '<div id="grid"></div>';
  const mod = await import("../src/main.js");
  resolveLevelFromUrl = mod.resolveLevelFromUrl;
});

// ── Mock levels map（不依赖真实 LEVELS import） ──

const MOCK_LEVELS: Readonly<Record<string, string>> = {
  "level-push-1": "######\n# @$.#\n######",
  "level-push-big": "##########\n#        #\n# @  $.  #\n##########",
  "level-walk-only": "###\n#@#\n###",
  "special-chars": "####\n#@ #\n####",
};

const MOCK_DEFAULT = "level-push-1";

describe("resolveLevelFromUrl · Property 7: URL 关卡分派器的普适行为", () => {
  it("PBT: 对任意 nameCandidate，分派结果自洽且符合分派规则", () => {
    const mockKeys = Object.keys(MOCK_LEVELS);

    // 生成器：覆盖 LEVELS 键集合、随机字符串、空字符串、含特殊字符的字符串
    const arbNameCandidate = fc.oneof(
      // LEVELS 中的有效 key
      fc.constantFrom(...mockKeys),
      // LEVELS 外的随机字符串
      fc.string({ minLength: 1, maxLength: 30 }),
      // 空字符串
      fc.constant(""),
      // 含特殊字符的字符串
      fc.stringOf(
        fc.oneof(
          fc.char(),
          fc.constantFrom("&", "=", "?", "#", "%", "/", " ", "中", "文"),
        ),
        { minLength: 1, maxLength: 20 },
      ),
    );

    fc.assert(
      fc.property(arbNameCandidate, (nameCandidate) => {
        // 构造 search 字符串
        const search =
          nameCandidate === ""
            ? ""
            : "?level=" + encodeURIComponent(nameCandidate);

        const { name, rawText } = resolveLevelFromUrl(
          search,
          MOCK_LEVELS,
          MOCK_DEFAULT,
        );

        // 恒等：rawText === LEVELS[name]（分派结果自洽）
        expect(rawText).toBe(MOCK_LEVELS[name]);

        // 分派规则
        if (nameCandidate !== "" && MOCK_LEVELS[nameCandidate] !== undefined) {
          // 有效 key → 返回对应关卡
          expect(name).toBe(nameCandidate);
          expect(rawText).toBe(MOCK_LEVELS[nameCandidate]);
        } else {
          // 无效 / 空 → 回退到默认关
          expect(name).toBe(MOCK_DEFAULT);
          expect(rawText).toBe(MOCK_LEVELS[MOCK_DEFAULT]);
        }
      }),
      { numRuns: 200 },
    );
  });

  // ── EDGE_CASE ──

  it("EDGE_CASE: 空 search → 回退到默认关", () => {
    const { name, rawText } = resolveLevelFromUrl("", MOCK_LEVELS, MOCK_DEFAULT);
    expect(name).toBe(MOCK_DEFAULT);
    expect(rawText).toBe(MOCK_LEVELS[MOCK_DEFAULT]);
  });

  it("EDGE_CASE: ?level=（空值）→ 回退到默认关", () => {
    const { name, rawText } = resolveLevelFromUrl(
      "?level=",
      MOCK_LEVELS,
      MOCK_DEFAULT,
    );
    expect(name).toBe(MOCK_DEFAULT);
    expect(rawText).toBe(MOCK_LEVELS[MOCK_DEFAULT]);
  });

  it("EDGE_CASE: ?level=xxx&other=y（多参数、level 不存在）→ 回退到默认关", () => {
    const { name, rawText } = resolveLevelFromUrl(
      "?level=xxx&other=y",
      MOCK_LEVELS,
      MOCK_DEFAULT,
    );
    expect(name).toBe(MOCK_DEFAULT);
    expect(rawText).toBe(MOCK_LEVELS[MOCK_DEFAULT]);
  });

  it("EDGE_CASE: ?level=level-push-big&other=y（多参数、level 存在）→ 返回对应关卡", () => {
    const { name, rawText } = resolveLevelFromUrl(
      "?level=level-push-big&other=y",
      MOCK_LEVELS,
      MOCK_DEFAULT,
    );
    expect(name).toBe("level-push-big");
    expect(rawText).toBe(MOCK_LEVELS["level-push-big"]);
  });

  it("EDGE_CASE: URL 编码（?level=level%2Dpush%2D1）→ 正确解码并匹配", () => {
    const { name, rawText } = resolveLevelFromUrl(
      "?level=level%2Dpush%2D1",
      MOCK_LEVELS,
      MOCK_DEFAULT,
    );
    // encodeURIComponent("level-push-1") 中 '-' 不会被编码，但 %2D 是 '-' 的编码
    // URLSearchParams 会自动解码
    expect(name).toBe("level-push-1");
    expect(rawText).toBe(MOCK_LEVELS["level-push-1"]);
  });

  it("EDGE_CASE: URL 编码含中文（?level=%E4%B8%AD%E6%96%87）→ 不存在、回退默认", () => {
    const { name, rawText } = resolveLevelFromUrl(
      "?level=%E4%B8%AD%E6%96%87",
      MOCK_LEVELS,
      MOCK_DEFAULT,
    );
    expect(name).toBe(MOCK_DEFAULT);
    expect(rawText).toBe(MOCK_LEVELS[MOCK_DEFAULT]);
  });

  it("EDGE_CASE: 无 level 参数但有其它参数（?other=abc）→ 回退到默认关", () => {
    const { name, rawText } = resolveLevelFromUrl(
      "?other=abc",
      MOCK_LEVELS,
      MOCK_DEFAULT,
    );
    expect(name).toBe(MOCK_DEFAULT);
    expect(rawText).toBe(MOCK_LEVELS[MOCK_DEFAULT]);
  });
});
