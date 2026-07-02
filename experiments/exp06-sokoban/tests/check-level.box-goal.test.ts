// Feature: sokoban-mvp-3-levels, Property 4: 箱目标不平衡必现形 + 全局计数

/**
 * 【checkLevel · box-goal-imbalance 规则属性测试】tests/check-level.box-goal.test.ts
 * ────────────────────────────────────────────────────────────
 * Property 4（PBT）：在合法 baseline 的内部地板格随机加一个 $ 或 .，
 *   只违反箱目标数守恒（玩家数仍恰 1、字符集合法、边界闭合）。
 *   断言 checkLevel 返回 ok=false 且 issues 中含 rule="box-goal-imbalance"
 *   且 message 同时包含实际箱数与实际目标数；无 location。
 *
 * EXAMPLE：3 箱 2 目标、1 箱 2 目标、0=0 合法、* 同时增箱增目标不破坏守恒。
 *
 * Validates: Requirements 2.2, 2.3
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { arbLegalLevel } from "./generators.js";
import { checkLevel } from "../src/check.js";

describe("checkLevel · Property 4: box-goal-imbalance 必现形 + 全局计数", () => {
  it("在内部地板格加一个 $ 而不加对应 . → 报 box-goal-imbalance", () => {
    fc.assert(
      fc.property(arbLegalLevel(), (level) => {
        const lines = level.text.split("\n").map((l) => l.split(""));
        const { height } = level.meta;

        // 寻找内部空格位置（不是玩家、不是箱子、不是目标、不是墙）
        let placed = false;
        for (let y = 1; y < height - 1 && !placed; y++) {
          for (let x = 1; x < lines[y].length - 1 && !placed; x++) {
            if (lines[y][x] === " ") {
              lines[y][x] = "$"; // 加一个箱子，不加目标
              placed = true;
            }
          }
        }

        if (!placed) return; // 跳过无空格的 sample

        const mutatedText = lines.map((l) => l.join("")).join("\n");

        const result = checkLevel(mutatedText);
        expect(result.ok).toBe(false);
        if (result.ok) return;

        const boxGoalIssues = result.issues.filter(
          (i) => i.rule === "box-goal-imbalance",
        );
        expect(boxGoalIssues.length).toBeGreaterThanOrEqual(1);

        // message 同时包含实际箱数与目标数
        const msg = boxGoalIssues[0].message;
        // 原始关卡箱数 + 1 = 新箱数
        const expectedBoxes = level.meta.boxes.length + 1;
        const expectedGoals = level.meta.goals.length;
        expect(msg).toContain(String(expectedBoxes));
        expect(msg).toContain(String(expectedGoals));

        // 无 location
        expect(boxGoalIssues[0].location).toBeUndefined();
      }),
      { numRuns: 100 },
    );
  });

  it("在内部地板格加一个 . 而不加对应 $ → 报 box-goal-imbalance", () => {
    fc.assert(
      fc.property(arbLegalLevel(), (level) => {
        const lines = level.text.split("\n").map((l) => l.split(""));
        const { height } = level.meta;

        // 寻找内部空格位置
        let placed = false;
        for (let y = 1; y < height - 1 && !placed; y++) {
          for (let x = 1; x < lines[y].length - 1 && !placed; x++) {
            if (lines[y][x] === " ") {
              lines[y][x] = "."; // 加一个目标，不加箱子
              placed = true;
            }
          }
        }

        if (!placed) return;

        const mutatedText = lines.map((l) => l.join("")).join("\n");

        const result = checkLevel(mutatedText);
        expect(result.ok).toBe(false);
        if (result.ok) return;

        const boxGoalIssues = result.issues.filter(
          (i) => i.rule === "box-goal-imbalance",
        );
        expect(boxGoalIssues.length).toBeGreaterThanOrEqual(1);

        // message 同时包含实际箱数与目标数
        const msg = boxGoalIssues[0].message;
        const expectedBoxes = level.meta.boxes.length;
        const expectedGoals = level.meta.goals.length + 1;
        expect(msg).toContain(String(expectedBoxes));
        expect(msg).toContain(String(expectedGoals));

        // 无 location
        expect(boxGoalIssues[0].location).toBeUndefined();
      }),
      { numRuns: 100 },
    );
  });

  it("EXAMPLE: 3 箱 2 目标", () => {
    // 3 个 $，2 个 .  → 箱数(3) ≠ 目标数(2)
    const level = [
      "#######",
      "#@$   #",
      "# $ . #",
      "# $ . #",
      "#######",
    ].join("\n");

    const result = checkLevel(level);
    expect(result.ok).toBe(false);
    if (result.ok) return;

    const issue = result.issues.find((i) => i.rule === "box-goal-imbalance");
    expect(issue).toBeDefined();
    expect(issue!.message).toContain("3"); // 箱数
    expect(issue!.message).toContain("2"); // 目标数
    expect(issue!.location).toBeUndefined();
  });

  it("EXAMPLE: 1 箱 2 目标", () => {
    const level = [
      "#####",
      "#@$.#",
      "# . #",
      "#####",
    ].join("\n");

    const result = checkLevel(level);
    expect(result.ok).toBe(false);
    if (result.ok) return;

    const issue = result.issues.find((i) => i.rule === "box-goal-imbalance");
    expect(issue).toBeDefined();
    expect(issue!.message).toContain("1"); // 箱数
    expect(issue!.message).toContain("2"); // 目标数
    expect(issue!.location).toBeUndefined();
  });

  it("EXAMPLE: 0=0 合法特例 — 不该报 box-goal-imbalance", () => {
    const level = [
      "####",
      "#@ #",
      "#  #",
      "####",
    ].join("\n");

    const result = checkLevel(level);
    // 0=0 时关卡合法（base check 通过）
    expect(result.ok).toBe(true);
  });

  it("EXAMPLE: * 同时增箱增目标 — 守恒不被破坏", () => {
    // 1 个 $，1 个 .，加上 1 个 * → 2 箱 2 目标（平衡）
    const level = [
      "#####",
      "#@$.#",
      "# * #",
      "#####",
    ].join("\n");

    const result = checkLevel(level);
    // * 同时计入 boxes 和 goals，所以 boxes=2, goals=2，平衡
    expect(result.ok).toBe(true);
  });
});
