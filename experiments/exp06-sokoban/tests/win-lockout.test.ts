// Feature: sokoban-mvp-2-push, EXAMPLE: win-lockout（AC 2.3 通关后门控 + R 重开）
// @vitest-environment jsdom
/**
 * 模拟 main.ts 的行为逻辑（不实际 import main.ts——它用 Vite ?raw 无法在 vitest 直接解析）：
 *   - 加载关卡 → parseLevel
 *   - 驱动 stepPush 到通关
 *   - 通关后方向键不再改变状态（门控）
 *   - 按 R 重开：网格回到初始、方向键恢复工作
 *
 * Validates: Requirements 2.3
 */

import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { parseJsonc } from "../src/jsonc.js";
import { stepPush, type PushResult } from "../src/driver.js";
import { createPushRegistry } from "../src/blocks/register.js";
import { keyToDirection } from "../src/adapters/input-adapter.js";
import type { Direction, GridState, Position } from "../src/grid.js";
import type { FlowConfig, BlockRegistry } from "@assemflow/core";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pushConfig: FlowConfig = parseJsonc<FlowConfig>(
  readFileSync(resolve(__dirname, "../src/configs/push.jsonc"), "utf-8"),
);
const registry: BlockRegistry = createPushRegistry();

// ── Replicate main.ts essential logic ────────────────────────

/** 7×3 直线通道，2 箱 2 目标（与 assemble-push 测试相同关卡） */
function makeTestLevel(): GridState {
  const width = 7;
  const height = 3;
  const walls: Position[] = [];
  for (let x = 0; x < width; x++) {
    walls.push({ x, y: 0 });
    walls.push({ x, y: 2 });
  }
  walls.push({ x: 0, y: 1 });
  walls.push({ x: 6, y: 1 });

  return {
    width,
    height,
    walls,
    goals: [{ x: 1, y: 1 }, { x: 5, y: 1 }],
    player: { x: 3, y: 1 },
    boxes: [{ x: 2, y: 1 }, { x: 4, y: 1 }],
  };
}

/**
 * Simulates main.ts behavior:
 * - Holds currentGrid and won state
 * - Processes keydown events with win gate and R reset
 */
class GameSimulator {
  private initialLevel: GridState;
  currentGrid: GridState;
  won: boolean;

  constructor() {
    this.initialLevel = makeTestLevel();
    this.currentGrid = this.initialLevel;
    this.won = false;
  }

  /** Process a key press, replicating main.ts keydown handler logic */
  handleKey(key: string): void {
    // R/r 重开
    if (key === "r" || key === "R") {
      this.currentGrid = this.initialLevel;
      this.won = false;
      return;
    }

    // 胜利门控
    if (this.won) return;

    const direction: Direction | null = keyToDirection(key);
    if (!direction) return;

    let result: PushResult;
    try {
      result = stepPush(pushConfig, registry, this.currentGrid, direction);
    } catch {
      return;
    }

    this.currentGrid = result.nextGrid;
    this.won = result.won;
  }
}

// ── Tests ────────────────────────────────────────────────────

describe("win-lockout（通关后门控 + R 重开）", () => {
  let game: GameSimulator;

  beforeEach(() => {
    game = new GameSimulator();
  });

  it("通关后方向键不再改变状态", () => {
    // Drive to win: left, right, right (same as assemble-push test)
    game.handleKey("ArrowLeft");
    game.handleKey("ArrowRight");
    game.handleKey("ArrowRight");

    // Should be won now
    expect(game.won).toBe(true);
    const wonGrid = game.currentGrid;

    // All direction keys should be ignored after winning
    game.handleKey("ArrowUp");
    expect(game.currentGrid).toEqual(wonGrid);

    game.handleKey("ArrowDown");
    expect(game.currentGrid).toEqual(wonGrid);

    game.handleKey("ArrowLeft");
    expect(game.currentGrid).toEqual(wonGrid);

    game.handleKey("ArrowRight");
    expect(game.currentGrid).toEqual(wonGrid);

    // WASD too
    game.handleKey("w");
    expect(game.currentGrid).toEqual(wonGrid);

    game.handleKey("a");
    expect(game.currentGrid).toEqual(wonGrid);

    game.handleKey("s");
    expect(game.currentGrid).toEqual(wonGrid);

    game.handleKey("d");
    expect(game.currentGrid).toEqual(wonGrid);
  });

  it("通关后按 R 重开：网格回到初始，方向键恢复工作", () => {
    // Drive to win
    game.handleKey("ArrowLeft");
    game.handleKey("ArrowRight");
    game.handleKey("ArrowRight");
    expect(game.won).toBe(true);

    const initialGrid = makeTestLevel();

    // Press R to reset
    game.handleKey("R");

    // Grid should be back to initial
    expect(game.won).toBe(false);
    expect(game.currentGrid).toEqual(initialGrid);

    // Direction keys should work again
    game.handleKey("ArrowLeft");
    // Player should have moved (pushed box left)
    expect(game.currentGrid.player).toEqual({ x: 2, y: 1 });
    expect(game.won).toBe(false);
  });

  it("通关前方向键正常工作", () => {
    const beforeMove = game.currentGrid;
    game.handleKey("ArrowLeft");
    // Player pushed box left, grid changed
    expect(game.currentGrid).not.toEqual(beforeMove);
    expect(game.won).toBe(false);
  });

  it("未识别的按键不改变任何状态", () => {
    const before = game.currentGrid;
    game.handleKey("x");
    game.handleKey("Enter");
    game.handleKey("Escape");
    expect(game.currentGrid).toEqual(before);
    expect(game.won).toBe(false);
  });

  it("小写 r 同样触发重开", () => {
    // Drive to win
    game.handleKey("ArrowLeft");
    game.handleKey("ArrowRight");
    game.handleKey("ArrowRight");
    expect(game.won).toBe(true);

    // Press lowercase r
    game.handleKey("r");
    expect(game.won).toBe(false);
    expect(game.currentGrid).toEqual(makeTestLevel());
  });

  it("DOM keydown 事件模拟（jsdom）", () => {
    // This test uses the jsdom environment to dispatch real KeyboardEvents
    // and verify the game simulator responds correctly via event listeners.
    let eventGrid: GridState = game.currentGrid;
    let eventWon = false;

    const handler = (event: KeyboardEvent) => {
      // R/r reset
      if (event.key === "r" || event.key === "R") {
        game.currentGrid = makeTestLevel();
        game.won = false;
        eventGrid = game.currentGrid;
        eventWon = game.won;
        return;
      }

      if (game.won) return;

      const direction = keyToDirection(event.key);
      if (!direction) return;

      try {
        const result = stepPush(pushConfig, registry, game.currentGrid, direction);
        game.currentGrid = result.nextGrid;
        game.won = result.won;
        eventGrid = game.currentGrid;
        eventWon = game.won;
      } catch {
        // ignore
      }
    };

    window.addEventListener("keydown", handler);

    // Dispatch direction events to solve
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));

    expect(eventWon).toBe(true);
    const wonGrid = eventGrid;

    // Direction after win should be gated
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }));
    expect(eventGrid).toEqual(wonGrid);

    // R resets
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "R" }));
    expect(eventWon).toBe(false);
    expect(eventGrid).toEqual(makeTestLevel());

    window.removeEventListener("keydown", handler);
  });
});
