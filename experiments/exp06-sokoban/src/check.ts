/**
 * 【base 静态 check】src/check.ts —— AFP 纯机制 · 独立文件
 * ────────────────────────────────────────────────────────────
 * 装载前跑的独立校验层：纯函数、可脱离浏览器/引擎/DOM 独立调。
 * 内部调 scanAscii 一次；全跑不短路（一次跑完把该说的话说完，收集所有 issues）。
 *
 * 4 条规则：
 *   1. invalid-char：非法字符 → 精确到行列
 *   2. player-count：玩家数 ≠ 1 → 全局计数
 *   3. box-goal-imbalance：箱数 ≠ 目标数（允许 0=0）→ 全局计数
 *   4. boundary-not-closed：flood-fill 到达非墙边缘格 → 最相关坐标（hint）
 *
 * 纯函数纪律：无状态、无副作用、无时钟/随机/AI。零 @paradigm 标记。
 */

import { scanAscii, type RawScan, type Position } from "./scan-ascii.js";

// ── 类型导出 ──────────────────────────────────────────────────

export type CheckRule =
  | "invalid-char"
  | "player-count"
  | "box-goal-imbalance"
  | "boundary-not-closed";

/**
 * 单条诊断。location 分级：
 *   - invalid-char        → { line, column }（1-indexed，精确到行列）
 *   - boundary-not-closed → { hint: Position }（0-indexed，泄漏路径的一个可疑坐标）
 *   - player-count / box-goal-imbalance → 无 location（全局计数信息在 message 里说清）
 */
export interface CheckIssue {
  readonly rule: CheckRule;
  readonly message: string;
  readonly location?: { line: number; column: number } | { hint: Position };
}

export type LevelCheckResult =
  | { readonly ok: true; readonly scan: RawScan }
  | { readonly ok: false; readonly issues: readonly CheckIssue[] };

// ── 核心函数 ──────────────────────────────────────────────────

/**
 * base 静态 check：装载前跑。纯函数、可脱离浏览器/引擎/DOM 独立调。
 * 内部调 scanAscii(text) 一次；全跑不短路（收集所有 issues）。
 *
 * 成功时（ok: true）返回值携带 RawScan —— 供 parseLevel 直接复用构造 GridState，
 * 避免冗余扫描。失败时（ok: false）只返 issues。
 */
export function checkLevel(text: string): LevelCheckResult {
  const scan = scanAscii(text);
  const issues: CheckIssue[] = [];

  // 规则 1：invalid-char —— 逐条产 issue，精确到行列（1-indexed）
  for (const { pos, ch } of scan.invalidChars) {
    issues.push({
      rule: "invalid-char",
      message: `invalid-char: 第 ${pos.y + 1} 行第 ${pos.x + 1} 列出现非法字符 '${ch}'（合法字符集为 # . <space> @ $ * +）`,
      location: { line: pos.y + 1, column: pos.x + 1 },
    });
  }

  // 规则 2：player-count —— 恰一玩家
  if (scan.players.length !== 1) {
    issues.push({
      rule: "player-count",
      message: `player-count: 需要恰好 1 个玩家（'@' 或 '+'），当前找到 ${scan.players.length} 个`,
    });
  }

  // 规则 3：box-goal-imbalance —— 箱数 = 目标数（允许 0=0）
  if (scan.boxes.length !== scan.goals.length) {
    issues.push({
      rule: "box-goal-imbalance",
      message: `box-goal-imbalance: 箱数（${scan.boxes.length}）≠ 目标数（${scan.goals.length}）；允许 0=0 特例`,
    });
  }

  // 规则 4：boundary-not-closed —— flood-fill
  // 前置：若玩家数为 0（rule 2 已报），跳过边界检查（无参照点）
  if (scan.players.length > 0) {
    const leakResult = checkBoundaryClosed(scan);
    if (leakResult.leaked) {
      issues.push({
        rule: "boundary-not-closed",
        message: `boundary-not-closed: 从关内可达非墙边缘格 (${leakResult.hint.x}, ${leakResult.hint.y})，边界不闭合`,
        location: { hint: leakResult.hint },
      });
    }
  }

  if (issues.length === 0) {
    return { ok: true, scan };
  }
  return { ok: false, issues };
}

// ── 内部辅助：边界闭合 flood-fill ──────────────────────────────

/**
 * 边界闭合检查：flood-fill 4-连通穿"非墙格"。
 * 起点 = 所有 players + 所有 boxes 的坐标。
 * 若到达网格外边界（x==0 或 x==width-1 或 y==0 或 y==height-1）且不在 walls 中 → 泄漏。
 */
function checkBoundaryClosed(scan: RawScan): { leaked: false } | { leaked: true; hint: Position } {
  const { width, height, walls, players, boxes } = scan;

  // 构建墙壁 Set（用字符串 key 做快查）
  const wallSet = new Set<string>();
  for (const w of walls) {
    wallSet.add(`${w.x},${w.y}`);
  }

  const isWall = (x: number, y: number): boolean => wallSet.has(`${x},${y}`);

  // BFS
  const visited = new Set<string>();
  const frontier: Position[] = [];

  // 初始 frontier = 所有 players + 所有 boxes
  for (const p of players) {
    frontier.push(p);
  }
  for (const b of boxes) {
    frontier.push(b);
  }

  // 4-连通邻居偏移
  const dx = [1, -1, 0, 0];
  const dy = [0, 0, 1, -1];

  while (frontier.length > 0) {
    const { x, y } = frontier.pop()!;
    const key = `${x},${y}`;

    if (visited.has(key)) continue;
    visited.add(key);

    // 到达边界上的非墙格 → 泄漏
    if ((x === 0 || x === width - 1 || y === 0 || y === height - 1) && !isWall(x, y)) {
      return { leaked: true, hint: { x, y } };
    }

    // 扩展 4 个邻居
    for (let i = 0; i < 4; i++) {
      const nx = x + dx[i];
      const ny = y + dy[i];
      // 邻居必须在网格内、不是墙、未访问
      if (nx >= 0 && nx < width && ny >= 0 && ny < height && !isWall(nx, ny) && !visited.has(`${nx},${ny}`)) {
        frontier.push({ x: nx, y: ny });
      }
    }
  }

  return { leaked: false };
}

// 重导出 scan-ascii 的类型供外部使用
export type { RawScan, Position } from "./scan-ascii.js";
