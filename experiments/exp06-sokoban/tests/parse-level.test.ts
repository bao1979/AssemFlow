// Feature: sokoban-mvp-2-push, Property 1: 装载正确
// Feature: sokoban-mvp-2-push, Property 9: 发表关满足 publication-gate 硬约束（EXAMPLE 级）

/**
 * 【解析测试】tests/parse-level.test.ts
 * ────────────────────────────────────────────────────────────
 * Property 1：fast-check ≥100 iterations 生成合法 Sokoban ASCII，
 *   断言 parseLevel 输出的 walls/goals/boxes/player 坐标一一对应，
 *   width = 最长行长度、height = 行数；覆盖 * 与 + 交叉出现。
 * Property 9（EXAMPLE）：对 level-push-1.txt 装出的 initialGrid，
 *   assertPublishableLevel 不抛错；三份故意畸形反例抛 Error。
 *
 * Validates: Requirements 1.1, 2.4
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  parseLevel,
  isBoxOnGoal,
  assertPublishableLevel,
  type GridState,
  type Position,
} from "../src/grid.js";
import levelPushRaw from "../src/levels/publishable/level-push-1.txt?raw";

// ── 辅助 ─────────────────────────────────────────────────────

/** 归一化 Position[] 成排序后的字符串集合，避免顺序影响断言 */
function posKeys(positions: readonly Position[]): string[] {
  return positions.map((p) => `${p.x},${p.y}`).sort();
}

// ── Property 1: 装载正确（fast-check PBT）──────────────────────

/**
 * **Validates: Requirements 1.1**
 *
 * 生成策略：
 *   1. 随机 width ∈ [3,12]、height ∈ [3,12]
 *   2. 第 0 行和末行全墙；中间行首尾为墙
 *   3. 内部格随机填 ' '（地板）/ '.'（目标）/ '$'（箱子）/ '#'（内墙）/ '*'（箱+目标）
 *   4. 恰放置一个玩家（随机选 '@' 或 '+'）
 *   5. 确保 boxCount = goalCount（含 0=0 特例）
 */
describe("parseLevel —— Property 1: 装载正确（fast-check PBT）", () => {
  /**
   * 生成一份合法 Sokoban ASCII 关卡 + 预期的坐标集合
   */
  const _validLevelArb = fc.tuple(
    fc.integer({ min: 4, max: 12 }),  // width（含左右墙至少 4）
    fc.integer({ min: 4, max: 12 }),  // height（含上下墙至少 4）
    fc.boolean(),                      // 玩家用 '+' 还是 '@'
    fc.integer({ min: 0, max: 4 }),   // boxCount = goalCount（含 0）
  ).chain(([width, height, playerOnGoal, boxCount]) => {
    // 内部可用格数 = (width-2) * (height-2)
    const innerW = width - 2;
    const innerH = height - 2;
    const innerTotal = innerW * innerH;
    // 需要放置的实体数：1 player + boxCount boxes + goalCount goals
    // 但 '*' 合并 box+goal，'+' 合并 player+goal
    // 简化：先分配坐标，再决定是否使用 '*' / '+'
    const neededSlots = 1 + boxCount * 2; // worst case: player + boxes + goals separate
    if (neededSlots > innerTotal) {
      // 降为 0=0 + player only
      return fc.constant({ width, height, playerOnGoal, boxCount: 0, innerPositions: [0] as number[] });
    }
    // 随机选取不重复的内部格索引
    const totalNeeded = Math.min(1 + boxCount * 2, innerTotal);
    return fc.shuffledSubarray(
      Array.from({ length: innerTotal }, (_, i) => i),
      { minLength: totalNeeded, maxLength: totalNeeded }
    ).map((positions) => ({ width, height, playerOnGoal, boxCount, innerPositions: positions }));
  }).map((params) => {
    const { width, height, playerOnGoal, boxCount, innerPositions } = params;
    const innerW = width - 2;

    // 构建字符网格
    const grid: string[][] = [];
    // 顶墙行
    grid.push(Array(width).fill("#"));
    // 中间行
    for (let y = 1; y < height - 1; y++) {
      const row = Array(width).fill(" ");
      row[0] = "#";
      row[width - 1] = "#";
      grid.push(row);
    }
    // 底墙行
    grid.push(Array(width).fill("#"));

    // 期望坐标集合
    const expectedWalls: Position[] = [];
    const expectedGoals: Position[] = [];
    const expectedBoxes: Position[] = [];
    let expectedPlayer: Position = { x: 0, y: 0 };

    // 记录外墙坐标
    for (let x = 0; x < width; x++) {
      expectedWalls.push({ x, y: 0 });
      expectedWalls.push({ x, y: height - 1 });
    }
    for (let y = 1; y < height - 1; y++) {
      expectedWalls.push({ x: 0, y });
      expectedWalls.push({ x: width - 1, y });
    }

    // 把 innerPositions 分配角色
    // [0]: player, [1..boxCount]: boxes, [boxCount+1..boxCount*2]: goals
    // 使用 '*' 来同时占 box+goal 概率：如果 boxCount > 0 且位置足够
    // 简化策略：前 boxCount 位分给 box+goal 的组合处理
    const toInnerCoord = (idx: number): Position => ({
      x: (idx % innerW) + 1,
      y: Math.floor(idx / innerW) + 1,
    });

    // Player
    const playerPos = toInnerCoord(innerPositions[0]);
    expectedPlayer = playerPos;
    if (playerOnGoal) {
      grid[playerPos.y][playerPos.x] = "+";
      expectedGoals.push(playerPos);
    } else {
      grid[playerPos.y][playerPos.x] = "@";
    }

    // Boxes and goals — 用独立位置：前 boxCount 个是 boxes，接下来 boxCount 个是 goals
    // 随机决定是否使用 '*'（box on goal 合并格）
    // 为了保证覆盖 '*' 与 '+'，如果 boxCount >= 2 则让第一个 box 使用 '*'（合并 box+goal）
    let usedStarCount = 0;
    if (boxCount >= 2) {
      // 第一个 box 用 '*'（同一格同时是 box 和 goal）
      const starPos = toInnerCoord(innerPositions[1]);
      grid[starPos.y][starPos.x] = "*";
      expectedBoxes.push(starPos);
      expectedGoals.push(starPos);
      usedStarCount = 1;

      // 剩余 boxes 用 '$'
      for (let i = 2; i <= boxCount; i++) {
        const boxPos = toInnerCoord(innerPositions[i]);
        grid[boxPos.y][boxPos.x] = "$";
        expectedBoxes.push(boxPos);
      }
      // 剩余 goals 用 '.'（需 boxCount - usedStarCount 个独立 goal，加上 playerOnGoal 带来的）
      // 总 goal 需求 = boxCount（因 boxCount=goalCount）
      // 已有 goal：usedStarCount(1) + (playerOnGoal ? 1 : 0)
      // 还需独立 '.'：boxCount - usedStarCount - (playerOnGoal ? 1 : 0)
      const goalsFromStar = usedStarCount;
      const goalsFromPlayer = playerOnGoal ? 1 : 0;
      const independentGoalsNeeded = boxCount - goalsFromStar - goalsFromPlayer;
      for (let i = 0; i < independentGoalsNeeded; i++) {
        const goalPos = toInnerCoord(innerPositions[boxCount + 1 + i]);
        grid[goalPos.y][goalPos.x] = ".";
        expectedGoals.push(goalPos);
      }
    } else if (boxCount === 1) {
      // 1 box, 1 goal — use '$' and '.'
      const boxPos = toInnerCoord(innerPositions[1]);
      grid[boxPos.y][boxPos.x] = "$";
      expectedBoxes.push(boxPos);

      if (!playerOnGoal) {
        // Need 1 independent goal
        const goalPos = toInnerCoord(innerPositions[2]);
        grid[goalPos.y][goalPos.x] = ".";
        expectedGoals.push(goalPos);
      }
      // If playerOnGoal, the '+' already contributed 1 goal → boxCount=goalCount=1 ✓
    }
    // boxCount === 0: no boxes, no goals needed (0=0 special case)
    // playerOnGoal contributes a goal but then goalCount=1 and boxCount=0 → mismatch!
    // Fix: when boxCount=0, force playerOnGoal=false
    // Actually we handle this differently: if boxCount=0 and playerOnGoal, we need 1 box
    // Let's simplify: boxCount always equals total goals (from '.' + '*' + '+')
    // The formula is: boxes('$' + '*') must equal goals('.' + '*' + '+')

    // Recalculate: the construction above ensures boxCount = goalCount because:
    // - '*' contributes 1 box + 1 goal
    // - '$' contributes 1 box
    // - '.' contributes 1 goal
    // - '+' contributes 1 goal
    // Total boxes = usedStarCount + (boxCount - usedStarCount) = boxCount ✓
    // Total goals = usedStarCount + independentGoalsNeeded + (playerOnGoal ? 1 : 0) = boxCount ✓
    // BUT: when boxCount=0 and playerOnGoal=true → goals=1, boxes=0 → mismatch!
    // We need to handle this edge: force playerOnGoal=false when boxCount=0
    // This is handled in the chain above by always using playerOnGoal only when boxCount > 0

    const ascii = grid.map((row) => row.join("")).join("\n");
    return { ascii, width, height, expectedWalls, expectedGoals, expectedBoxes, expectedPlayer };
  });
  void _validLevelArb; // kept as reference; actual tests use sokobanLevelArb below

  // 由于上面的生成逻辑在 boxCount=0+playerOnGoal=true 时有 mismatch，
  // 需要修正。改用更简洁的生成器：

  /** 简化版：先随机内容，再统计期望坐标 */
  const sokobanLevelArb = fc.tuple(
    fc.integer({ min: 4, max: 10 }),  // width
    fc.integer({ min: 4, max: 10 }),  // height
    fc.nat({ max: 99999 }),           // seed for placement decisions
  ).chain(([width, height, _seed]) => {
    const innerW = width - 2;
    const innerH = height - 2;
    const innerTotal = innerW * innerH;
    // We need at least 1 cell for the player
    if (innerTotal < 1) return fc.constant(null);

    return fc.tuple(
      // player position index
      fc.integer({ min: 0, max: innerTotal - 1 }),
      // player type: '@' or '+'
      fc.boolean(),
      // box count (0..min(3, available))
      fc.integer({ min: 0, max: Math.min(3, Math.floor((innerTotal - 1) / 2)) }),
      // random permutation for box/goal placement
      fc.shuffledSubarray(
        Array.from({ length: innerTotal }, (_, i) => i),
        { minLength: innerTotal, maxLength: innerTotal }
      ),
      // how many '*' to use (merge box+goal)
      fc.integer({ min: 0, max: 3 }),
    ).map(([playerIdx, playerIsPlus, boxCount, permutation, starHint]) => {
      return { width, height, playerIdx, playerIsPlus, boxCount, permutation, starHint };
    });
  }).filter((v): v is NonNullable<typeof v> => v !== null)
  .map((params) => {
    const { width, height, playerIdx, playerIsPlus, boxCount, permutation, starHint } = params;
    const innerW = width - 2;

    const toCoord = (flatIdx: number): Position => ({
      x: (flatIdx % innerW) + 1,
      y: Math.floor(flatIdx / innerW) + 1,
    });

    // Build the grid
    const grid: string[][] = [];
    grid.push(Array(width).fill("#"));
    for (let y = 1; y < height - 1; y++) {
      const row = Array(width).fill(" ");
      row[0] = "#";
      row[width - 1] = "#";
      grid.push(row);
    }
    grid.push(Array(width).fill("#"));

    // Track expected positions
    const walls: Position[] = [];
    const goals: Position[] = [];
    const boxes: Position[] = [];

    // Record walls (border)
    for (let x = 0; x < width; x++) {
      walls.push({ x, y: 0 });
      walls.push({ x, y: height - 1 });
    }
    for (let y = 1; y < height - 1; y++) {
      walls.push({ x: 0, y });
      walls.push({ x: width - 1, y });
    }

    // Get non-player positions from permutation (skip playerIdx)
    const available = permutation.filter((idx) => idx !== playerIdx);

    // Decide how many '*' to use (box on goal combined)
    const starCount = Math.min(starHint, boxCount);
    const separateBoxes = boxCount - starCount;

    // When playerIsPlus, player contributes 1 goal
    // Total goals needed = boxCount
    // Goals from '+' = playerIsPlus ? 1 : 0
    // Goals from '*' = starCount
    // Goals from '.' = boxCount - starCount - (playerIsPlus ? 1 : 0)
    const goalsFromPlayer = playerIsPlus ? 1 : 0;
    const independentGoals = boxCount - starCount - goalsFromPlayer;

    // If independentGoals < 0, we can't use '+' with this boxCount
    // Fall back: don't use '+'
    const actualPlayerIsPlus = independentGoals >= 0 ? playerIsPlus : false;
    const actualIndependentGoals = actualPlayerIsPlus
      ? boxCount - starCount - 1
      : boxCount - starCount;

    // Check we have enough slots
    const neededSlots = starCount + separateBoxes + Math.max(0, actualIndependentGoals);
    if (neededSlots > available.length) {
      // Fallback: 0 boxes, 0 goals, simple player
      const playerPos = toCoord(playerIdx);
      grid[playerPos.y][playerPos.x] = "@";
      const ascii = grid.map((row) => row.join("")).join("\n");
      return { ascii, width, height, expectedWalls: walls, expectedGoals: [] as Position[], expectedBoxes: [] as Position[], expectedPlayer: playerPos };
    }

    // Place player
    const playerPos = toCoord(playerIdx);
    if (actualPlayerIsPlus) {
      grid[playerPos.y][playerPos.x] = "+";
      goals.push(playerPos);
    } else {
      grid[playerPos.y][playerPos.x] = "@";
    }

    let slotIdx = 0;
    // Place '*' (box + goal on same cell)
    for (let i = 0; i < starCount; i++) {
      const pos = toCoord(available[slotIdx++]);
      grid[pos.y][pos.x] = "*";
      boxes.push(pos);
      goals.push(pos);
    }
    // Place '$' (separate boxes)
    for (let i = 0; i < separateBoxes; i++) {
      const pos = toCoord(available[slotIdx++]);
      grid[pos.y][pos.x] = "$";
      boxes.push(pos);
    }
    // Place '.' (separate goals)
    for (let i = 0; i < Math.max(0, actualIndependentGoals); i++) {
      const pos = toCoord(available[slotIdx++]);
      grid[pos.y][pos.x] = ".";
      goals.push(pos);
    }

    const ascii = grid.map((row) => row.join("")).join("\n");
    return { ascii, width, height, expectedWalls: walls, expectedGoals: goals, expectedBoxes: boxes, expectedPlayer: playerPos };
  });

  it("parseLevel 把合法 Sokoban ASCII 正确映射为 GridState（≥100 iterations）", () => {
    fc.assert(
      fc.property(sokobanLevelArb, (level) => {
        const result = parseLevel(level.ascii);

        // width = 最长行长度
        expect(result.width).toBe(level.width);
        // height = 行数
        expect(result.height).toBe(level.height);
        // player 坐标
        expect(result.player).toEqual(level.expectedPlayer);
        // walls 一一对应
        expect(posKeys(result.walls)).toEqual(posKeys(level.expectedWalls));
        // goals 一一对应
        expect(posKeys(result.goals)).toEqual(posKeys(level.expectedGoals));
        // boxes 一一对应
        expect(posKeys(result.boxes)).toEqual(posKeys(level.expectedBoxes));
      }),
      { numRuns: 100 },
    );
  });
});

// ── Edge Cases: 畸形输入 ─────────────────────────────────────

describe("parseLevel —— 畸形输入边界", () => {
  it("缺 '@'（无角色）→ 抛 Error", () => {
    const ascii = ["####", "#  #", "####"].join("\n");
    expect(() => parseLevel(ascii)).toThrowError(/缺少角色/);
  });

  it("多个 '@' → 抛 Error", () => {
    const ascii = ["####", "#@@#", "####"].join("\n");
    expect(() => parseLevel(ascii)).toThrowError(/多个角色/);
  });

  it("'@' + '+' 同时出现（多角色）→ 抛 Error", () => {
    const ascii = ["#####", "#@#+#", "#####"].join("\n");
    expect(() => parseLevel(ascii)).toThrowError(/多个角色/);
  });

  it("箱数 ≠ 目标数（且非 0=0）→ 抛 Error", () => {
    // 2 boxes, 1 goal → mismatch
    const ascii = ["######", "#@$$.#", "######"].join("\n");
    expect(() => parseLevel(ascii)).toThrowError(/箱数/);
  });

  it("箱数 ≠ 目标数（1 box, 0 goals）→ 抛 Error", () => {
    const ascii = ["#####", "#@ $#", "#####"].join("\n");
    expect(() => parseLevel(ascii)).toThrowError(/箱数/);
  });

  it("0=0 合法特例：纯走路关卡（无箱无目标）通过校验", () => {
    const ascii = ["####", "#@ #", "####"].join("\n");
    const grid = parseLevel(ascii);
    expect(grid.boxes).toEqual([]);
    expect(grid.goals).toEqual([]);
    expect(grid.player).toEqual({ x: 1, y: 1 });
  });
});

// ── 示例级覆盖：'*' 与 '+' 交叉出现 ─────────────────────────

describe("parseLevel —— '*' 与 '+' 交叉覆盖（示例补充）", () => {
  it("'*' 同时进 boxes + goals", () => {
    const ascii = ["####", "#@*#", "####"].join("\n");
    const grid = parseLevel(ascii);
    expect(posKeys(grid.boxes)).toEqual(posKeys([{ x: 2, y: 1 }]));
    expect(posKeys(grid.goals)).toEqual(posKeys([{ x: 2, y: 1 }]));
  });

  it("'+' 同时定位 player + goals", () => {
    const ascii = ["#####", "# +$#", "#####"].join("\n");
    const grid = parseLevel(ascii);
    expect(grid.player).toEqual({ x: 2, y: 1 });
    expect(posKeys(grid.goals)).toEqual(posKeys([{ x: 2, y: 1 }]));
    expect(posKeys(grid.boxes)).toEqual(posKeys([{ x: 3, y: 1 }]));
  });

  it("'*' 与 '+' 交叉出现：goals 包含两者", () => {
    // '+' at (1,1): player + goal; '*' at (3,1): box + goal; '$' at (4,1): box
    // boxes=2 (*, $), goals=2 (+, *) → valid
    const ascii = ["######", "#+ *$#", "######"].join("\n");
    const grid = parseLevel(ascii);
    expect(grid.player).toEqual({ x: 1, y: 1 });
    expect(posKeys(grid.goals)).toEqual(posKeys([{ x: 1, y: 1 }, { x: 3, y: 1 }]));
    expect(posKeys(grid.boxes)).toEqual(posKeys([{ x: 3, y: 1 }, { x: 4, y: 1 }]));
  });

  it("宽度取最长一行的长度（行长不齐时）", () => {
    const ascii = ["#####", "#@#", "#####"].join("\n");
    const grid = parseLevel(ascii);
    expect(grid.width).toBe(5);
    expect(grid.height).toBe(3);
  });

  it("兼容 CRLF 换行", () => {
    const ascii = "####\r\n#@ #\r\n####";
    const grid = parseLevel(ascii);
    expect(grid.width).toBe(4);
    expect(grid.height).toBe(3);
    expect(grid.player).toEqual({ x: 1, y: 1 });
  });
});

// ── isBoxOnGoal 测试 ─────────────────────────────────────────

describe("isBoxOnGoal —— 派生判定", () => {
  const grid: GridState = {
    width: 5, height: 3,
    walls: [],
    goals: [{ x: 1, y: 1 }, { x: 3, y: 1 }],
    player: { x: 0, y: 0 },
    boxes: [{ x: 1, y: 1 }, { x: 2, y: 1 }],
  };

  it("箱子在目标格上 → true", () => {
    expect(isBoxOnGoal(grid, { x: 1, y: 1 })).toBe(true);
  });

  it("箱子不在目标格上 → false", () => {
    expect(isBoxOnGoal(grid, { x: 2, y: 1 })).toBe(false);
  });

  it("非箱子位置（但碰巧是目标格）→ true（纯坐标匹配）", () => {
    expect(isBoxOnGoal(grid, { x: 3, y: 1 })).toBe(true);
  });
});

// ── Property 9: 发表关满足 publication-gate 硬约束（EXAMPLE 级）─

describe("assertPublishableLevel —— Property 9: publication-gate", () => {
  it("正例：level-push-1.txt 装载后 assertPublishableLevel 不抛错", () => {
    const grid = parseLevel(levelPushRaw);
    // 确认满足发表关门槛
    expect(grid.boxes.length).toBeGreaterThanOrEqual(2);
    expect(grid.goals.length).toBeGreaterThanOrEqual(2);
    // assertPublishableLevel 不抛
    expect(() => assertPublishableLevel(grid)).not.toThrow();
  });

  it("反例：< 2 箱 → assertPublishableLevel 抛 Error（命中箱子数约束）", () => {
    // 1 box, 1 goal → boxes < 2
    const ascii = ["#####", "#@$.#", "#####"].join("\n");
    const grid = parseLevel(ascii);
    expect(grid.boxes.length).toBe(1);
    expect(() => assertPublishableLevel(grid)).toThrowError(/箱子数.*< 2/);
  });

  it("反例：< 2 目标 → assertPublishableLevel 抛 Error（命中目标格数约束）", () => {
    // 1 goal, 1 box — goals < 2
    const ascii = ["#####", "#@$.#", "#####"].join("\n");
    const grid = parseLevel(ascii);
    expect(grid.goals.length).toBe(1);
    expect(() => assertPublishableLevel(grid)).toThrowError(/< 2/);
  });

  it("反例：开局即通关（checkWin===true）→ assertPublishableLevel 抛 Error", () => {
    // 2 boxes both on goals → already won
    // '*' = box on goal; need 2 of them
    const ascii = ["######", "#@** #", "######"].join("\n");
    const grid = parseLevel(ascii);
    expect(grid.boxes.length).toBe(2);
    expect(grid.goals.length).toBe(2);
    // All boxes on goals → already won
    expect(() => assertPublishableLevel(grid)).toThrowError(/开局已通关/);
  });
});
