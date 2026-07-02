// Feature: sokoban-mvp-3-levels, Property 3: 玩家计数错误必现形 + 全局计数

/**
 * 【checkLevel · player-count 规则属性测试】tests/check-level.player-count.test.ts
 * ────────────────────────────────────────────────────────────
 * Property 3（PBT）：在合法 baseline 上扰动玩家标记数（删除得 0 / 复制得 2），
 *   断言 checkLevel 返回 ok=false 且 issues 中含 rule="player-count"
 *   且 message 中包含实际找到的玩家数；无 location。
 *
 * EXAMPLE：0 玩家、2 玩家、3 玩家各手写一份具体关卡验证。
 *
 * Validates: Requirements 2.2, 2.3
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { arbLegalLevel } from "./generators.js";
import { checkLevel } from "../src/check.js";

describe("checkLevel · Property 3: player-count 必现形 + 全局计数", () => {
  it("删除唯一玩家得 0 玩家 → 报 player-count + message 含 '0'", () => {
    fc.assert(
      fc.property(arbLegalLevel(), (level) => {
        const lines = level.text.split("\n").map((l) => l.split(""));
        const { playerPos } = level.meta;

        // 把玩家位置替换为空格（删除玩家），确保不破坏边界
        lines[playerPos.y][playerPos.x] = " ";
        const mutatedText = lines.map((l) => l.join("")).join("\n");

        const result = checkLevel(mutatedText);
        expect(result.ok).toBe(false);
        if (result.ok) return;

        const playerIssues = result.issues.filter(
          (i) => i.rule === "player-count",
        );
        expect(playerIssues.length).toBeGreaterThanOrEqual(1);

        // message 中包含 "0"（实际玩家数）
        expect(playerIssues[0].message).toMatch(/0/);

        // 无 location（全局计数规则）
        expect(playerIssues[0].location).toBeUndefined();
      }),
      { numRuns: 100 },
    );
  });

  it("复制玩家到另一位置得 2 玩家 → 报 player-count + message 含 '2'", () => {
    fc.assert(
      fc.property(arbLegalLevel(), (level) => {
        const lines = level.text.split("\n").map((l) => l.split(""));
        const { height } = level.meta;

        // 寻找一个内部空格位置来放第二个玩家
        let placed = false;
        for (let y = 1; y < height - 1 && !placed; y++) {
          for (let x = 1; x < lines[y].length - 1 && !placed; x++) {
            if (lines[y][x] === " ") {
              lines[y][x] = "@";
              placed = true;
            }
          }
        }

        if (!placed) return; // 跳过无空格的 sample

        const mutatedText = lines.map((l) => l.join("")).join("\n");

        const result = checkLevel(mutatedText);
        expect(result.ok).toBe(false);
        if (result.ok) return;

        const playerIssues = result.issues.filter(
          (i) => i.rule === "player-count",
        );
        expect(playerIssues.length).toBeGreaterThanOrEqual(1);

        // message 中包含 "2"（实际玩家数）
        expect(playerIssues[0].message).toMatch(/2/);

        // 无 location
        expect(playerIssues[0].location).toBeUndefined();
      }),
      { numRuns: 100 },
    );
  });

  it("EXAMPLE: 0 玩家关卡", () => {
    const level = [
      "####",
      "#  #",
      "#$.#",
      "####",
    ].join("\n");

    const result = checkLevel(level);
    expect(result.ok).toBe(false);
    if (result.ok) return;

    const issue = result.issues.find((i) => i.rule === "player-count");
    expect(issue).toBeDefined();
    expect(issue!.message).toMatch(/0/);
    expect(issue!.location).toBeUndefined();
  });

  it("EXAMPLE: 2 玩家关卡", () => {
    const level = [
      "#####",
      "#@ @#",
      "# $.#",
      "#####",
    ].join("\n");

    const result = checkLevel(level);
    expect(result.ok).toBe(false);
    if (result.ok) return;

    const issue = result.issues.find((i) => i.rule === "player-count");
    expect(issue).toBeDefined();
    expect(issue!.message).toMatch(/2/);
    expect(issue!.location).toBeUndefined();
  });

  it("EXAMPLE: 3 玩家关卡", () => {
    const level = [
      "######",
      "#@@@.#",
      "# $  #",
      "######",
    ].join("\n");

    const result = checkLevel(level);
    expect(result.ok).toBe(false);
    if (result.ok) return;

    const issue = result.issues.find((i) => i.rule === "player-count");
    expect(issue).toBeDefined();
    expect(issue!.message).toMatch(/3/);
    expect(issue!.location).toBeUndefined();
  });
});
