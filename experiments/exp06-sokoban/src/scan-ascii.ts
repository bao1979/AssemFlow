/**
 * 【共享底层扫描】src/scan-ascii.ts —— AFP 纯机制 · 独立文件
 * ────────────────────────────────────────────────────────────
 * 装载/校验共享的最低层原语：把 ASCII 关卡文本扫描成"每类字符的位置集合"。
 * 不做完整性校验（那是 checkLevel 的活）；只负责"把文本读成结构化坐标"。
 *
 * 独立文件的三条理由（design §1）：
 *   1. 职责单一：扫描是纯粹的字符位置读取机制
 *   2. check.ts 完全独立于装载层：若 scanAscii 留在 grid.ts，check.ts 会被迫依赖 grid.ts
 *   3. 测试可独立跑：scanAscii 有自己的单测文件 scan-ascii.test.ts
 *
 * 纯函数纪律：同 text 同结果、不读时钟 / 不随机 / 不调 AI / 无全局状态。
 */

// ── 类型（本文件自定义，不 import grid.ts，避免循环依赖）────

/** 网格坐标：x 向右、y 向下，原点在左上角。 */
export interface Position {
  readonly x: number;
  readonly y: number;
}

/**
 * 扫描结果：每类字符的位置集合 + 原始行列信息。
 * 不含任何校验判定（恰一玩家？箱=目标？边界闭合？——那些是 checkLevel 的活）。
 */
export interface RawScan {
  readonly width: number;          // 最长行的字符数
  readonly height: number;         // 行数（去掉末尾空行后）
  readonly walls: readonly Position[];     // '#'
  readonly goals: readonly Position[];     // '.' + '*' + '+'（'*'/'+' 同时进 goals）
  readonly boxes: readonly Position[];     // '$' + '*'（'*' 同时进 boxes）
  readonly players: readonly Position[];   // '@' + '+'（'+' 同时进 players）
  readonly invalidChars: readonly { pos: Position; ch: string }[];
}

// ── 核心函数 ────────────────────────────────────────────────

/**
 * 纯扫描：把 ASCII 关卡文本变成结构化坐标。
 *
 * 契约：
 *   - \r 兼容：开头 text.replace(/\r/g, "")
 *   - 末尾连续空行去掉（与 MVP-2 parseLevel 行为一致）
 *   - '*' 同时进 boxes 与 goals；'+' 同时进 players 与 goals
 *   - Ragged line 语义：短行末尾缺失的列位置不进任何集合
 *   - 中间空行：视为"满宽度的一整行可通行非墙空地"（不产生任何坐标）
 *   - 全空文本 / 单空行：返回 width=0, height=0, 各集合为空——不抛错
 *   - invalidChars 是权威记录：合法字符集外的字符逐个记录 { pos, ch }
 */
export function scanAscii(text: string): RawScan {
  // \r 兼容
  const normalized = text.replace(/\r/g, "");

  // 末尾连续空行去掉
  const trimmed = normalized.replace(/\n+$/, "");

  // 全空文本 / 单空行特例
  if (trimmed === "") {
    return {
      width: 0,
      height: 0,
      walls: [],
      goals: [],
      boxes: [],
      players: [],
      invalidChars: [],
    };
  }

  const lines = trimmed.split("\n");
  const height = lines.length;

  // width = 最长行的字符数
  let width = 0;
  for (const line of lines) {
    if (line.length > width) width = line.length;
  }

  const walls: Position[] = [];
  const goals: Position[] = [];
  const boxes: Position[] = [];
  const players: Position[] = [];
  const invalidChars: { pos: Position; ch: string }[] = [];

  for (let y = 0; y < lines.length; y++) {
    const line = lines[y];
    // Ragged line 语义：只扫到 line.length 为止
    for (let x = 0; x < line.length; x++) {
      const ch = line[x];
      switch (ch) {
        case "#":
          walls.push({ x, y });
          break;
        case ".":
          goals.push({ x, y });
          break;
        case "@":
          players.push({ x, y });
          break;
        case "+":
          // 玩家在目标格：同时进 players 和 goals
          players.push({ x, y });
          goals.push({ x, y });
          break;
        case "$":
          boxes.push({ x, y });
          break;
        case "*":
          // 箱子在目标格：同时进 boxes 和 goals
          boxes.push({ x, y });
          goals.push({ x, y });
          break;
        case " ":
          // 地板：不记录
          break;
        default:
          // 非法字符：记录
          invalidChars.push({ pos: { x, y }, ch });
          break;
      }
    }
  }

  return { width, height, walls, goals, boxes, players, invalidChars };
}
