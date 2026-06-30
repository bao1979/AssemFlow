/**
 * 【转接件测试】tests/input-adapter.test.ts —— Property 6「输入适配」
 * ────────────────────────────────────────────────────────────
 * 覆盖 Requirement 1.2 / design.md Property 6 / Testing Strategy #6：
 *   keyToDirection 把方向键（方向键 + WASD 两种大小写）映射到正确方向动作；
 *   无关按键映射为 null（不触发回合）。
 *
 * Validates: Requirements 1.2
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { keyToDirection } from "../src/adapters/input-adapter.js";
import type { Direction } from "../src/grid.js";

describe("keyToDirection —— 输入适配（Property 6）", () => {
  // 方向键 + WASD（大小写）→ 期望方向，逐一断言。
  const cases: ReadonlyArray<[string, Direction]> = [
    ["ArrowUp", "up"],
    ["w", "up"],
    ["W", "up"],
    ["ArrowDown", "down"],
    ["s", "down"],
    ["S", "down"],
    ["ArrowLeft", "left"],
    ["a", "left"],
    ["A", "left"],
    ["ArrowRight", "right"],
    ["d", "right"],
    ["D", "right"],
  ];

  for (const [key, dir] of cases) {
    it(`按键 "${key}" → "${dir}"`, () => {
      expect(keyToDirection(key)).toBe(dir);
    });
  }

  it("无关按键映射为 null（不触发回合）", () => {
    const unrelated = ["x", "Enter", " ", "", "Escape", "Shift", "1", "Arrowup", "ww"];
    for (const key of unrelated) {
      expect(keyToDirection(key)).toBeNull();
    }
  });

  // 已知映射键集合：除此之外的任意字符串都应返回 null。
  const known = new Set(cases.map(([key]) => key));

  it("属性：任意不在已知映射集合内的字符串 → null", () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => !known.has(s)),
        (key) => {
          expect(keyToDirection(key)).toBeNull();
        },
      ),
    );
  });

  it("属性：已知映射键恒返回非 null 的合法方向（确定性、无副作用）", () => {
    const valid: ReadonlySet<Direction> = new Set(["up", "down", "left", "right"] as const);
    fc.assert(
      fc.property(fc.constantFrom(...cases), ([key, expected]) => {
        const first = keyToDirection(key);
        const second = keyToDirection(key);
        expect(first).toBe(expected);
        expect(second).toBe(expected); // 多次调用结果恒等
        expect(first !== null && valid.has(first)).toBe(true);
      }),
    );
  });
});
