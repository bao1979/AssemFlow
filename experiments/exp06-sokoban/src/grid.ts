/**
 * 【网格数据与解析】src/grid.ts —— AFP 纯数据 + 纯机制
 * ────────────────────────────────────────────────────────────
 * 在 AFP 里的角色：
 *   - Position / GridState / Direction 是「数据」(Godot Resource 类比)，纯 JSON，可见可审。
 *   - parseLevel 是「纯机制」——把 ASCII 关卡文本一次性变成初始 GridState。
 *     它在装载期跑一次（非每回合），故不必升级成块（保持最小）。
 *
 * AFP 纪律点：
 *   1. parseLevel 是纯函数——同输入同输出，不读时钟 / 不用随机 / 不调 AI。
 *   2. walls / goals / boxes 用 Position[]（纯 JSON 数组），不是 Set<"x,y">。
 *      理由：方案 A 全量穿透下坐标要在 initialInput / context / 日志里可见可审；
 *      Set 序列化进 JSON 会塌成 {}，破坏「全量状态穿透」的可观察性。
 *   3. TypeBox schema 既给 TS 类型，又产出标准 JSON Schema 供引擎 Ajv 校验。
 *   4. "box on goal" 是派生态，不入字段（单一真相 = 坐标；避免与坐标漂移）。
 *   5. 两层契约：base parseLevel（通用装载）与 assertPublishableLevel（发表关额外硬约束）分层。
 */

import { Type, type Static } from "@sinclair/typebox";

// ── 类型 ────────────────────────────────────────────────────

/** 网格坐标：x 向右、y 向下，原点在左上角。 */
export interface Position {
  readonly x: number;
  readonly y: number;
}

/**
 * 网格状态：纯数据（Godot Resource 类比）。
 * MVP-2 含墙 + 目标格（静态）+ 角色 + 箱子（动态）。
 */
export interface GridState {
  readonly width: number;
  readonly height: number;
  readonly walls: readonly Position[];   // 墙坐标集合
  readonly goals: readonly Position[];   // 目标格坐标集合（静态）
  readonly player: Position;             // 角色坐标
  readonly boxes: readonly Position[];   // 箱子坐标集合（动态）
}

/** 方向动作名（已由转接件从物理按键归一化）。 */
export type Direction = "up" | "down" | "left" | "right";

// ── TypeBox schema（喂给 BlockDef 与引擎 Ajv 校验）─────────────

export const PositionSchema = Type.Object({
  x: Type.Number(),
  y: Type.Number(),
});

export const GridStateSchema = Type.Object({
  width: Type.Number(),
  height: Type.Number(),
  walls: Type.Array(PositionSchema),
  goals: Type.Array(PositionSchema),
  player: PositionSchema,
  boxes: Type.Array(PositionSchema),
});

export const DirectionSchema = Type.Union([
  Type.Literal("up"),
  Type.Literal("down"),
  Type.Literal("left"),
  Type.Literal("right"),
]);

// 静态断言：手写 interface 与 TypeBox schema 推导类型一致，二者漂移会编译报错。
type _PositionMatches = Static<typeof PositionSchema> extends Position ? true : never;
type _GridStateMatches = Static<typeof GridStateSchema> extends GridState ? true : never;
type _DirectionMatches = Static<typeof DirectionSchema> extends Direction ? true : never;
const _typeGuards: [_PositionMatches, _GridStateMatches, _DirectionMatches] = [true, true, true];
void _typeGuards;

// ── 解析 ────────────────────────────────────────────────────

/**
 * ASCII 关卡解析（Sokoban 传统字符集）：
 *   '#' 墙 / ' ' 地板 / '.' 目标格 / '$' 箱子 / '*' 箱子在目标格 /
 *   '@' 玩家 / '+' 玩家在目标格
 *
 * base 契约校验：
 *   - 恰一 '@' 或一 '+'（缺/多角色抛 Error）
 *   - 箱数（$ + *）= 目标数（. + * + +），允许 0=0 合法特例
 *   - 边界闭合不强校验（留 MVP-3）
 *
 * 装载期一次性纯函数（非每回合）。
 */
export function parseLevel(ascii: string): GridState {
  // 按行切分；统一去掉 \r 以兼容 CRLF 文本。
  // 末尾去掉空行：文件常以换行结尾，否则会多解析出一整行"空地板"。
  const lines = ascii.replace(/\r/g, "").replace(/\n+$/, "").split("\n");
  const height = lines.length;
  let width = 0;
  for (const line of lines) {
    if (line.length > width) width = line.length;
  }

  const walls: Position[] = [];
  const goals: Position[] = [];
  const boxes: Position[] = [];
  const players: Position[] = [];

  for (let y = 0; y < lines.length; y++) {
    const line = lines[y];
    for (let x = 0; x < line.length; x++) {
      const ch = line[x];
      switch (ch) {
        case "#":
          walls.push({ x, y });
          break;
        case "@":
          players.push({ x, y });
          break;
        case "+":
          // 玩家在目标格：同时定位 player + 追加 goals
          players.push({ x, y });
          goals.push({ x, y });
          break;
        case ".":
          goals.push({ x, y });
          break;
        case "$":
          boxes.push({ x, y });
          break;
        case "*":
          // 箱子在目标格：同时进 boxes + goals
          boxes.push({ x, y });
          goals.push({ x, y });
          break;
        case " ":
          // 地板：无需记录。
          break;
        default:
          // 其它字符按地板处理（兼容宽松输入）。
          break;
      }
    }
  }

  // base 契约：恰一个角色（@ 或 +）
  if (players.length === 0) {
    throw new Error("parseLevel: 关卡缺少角色 '@' 或 '+'（畸形输入）");
  }
  if (players.length > 1) {
    throw new Error(`parseLevel: 关卡含多个角色（找到 ${players.length} 个，畸形输入）`);
  }

  // base 契约：箱数 = 目标数（允许 0=0 合法特例）
  if (boxes.length !== goals.length) {
    throw new Error(
      `parseLevel: 箱数（${boxes.length}）≠ 目标数（${goals.length}），畸形输入`,
    );
  }

  return { width, height, walls, goals, player: players[0], boxes };
}

// ── 派生函数 ────────────────────────────────────────────────

/**
 * 判断指定位置的箱子是否在目标格上。
 * 纯函数、不入字段（单一真相 = 坐标；避免"就位态"与坐标漂移）。
 */
export function isBoxOnGoal(grid: GridState, pos: Position): boolean {
  return grid.goals.some((g) => g.x === pos.x && g.y === pos.y);
}

// ── 发表关门禁 ──────────────────────────────────────────────

/**
 * 发表关额外硬约束（publication-gate）：
 *   - boxes.length >= 2
 *   - goals.length >= 2
 *   - 开局非通关（checkWin === false）
 *
 * 与 base parseLevel 分层——一份代码支撑两个 MVP 关卡语义，
 * 避免 base 契约内塞条件分支。
 * 命中任一抛 Error，消息说明命中哪一条。
 */
export function assertPublishableLevel(grid: GridState): void {
  if (grid.boxes.length < 2) {
    throw new Error(
      `assertPublishableLevel: 箱子数（${grid.boxes.length}）< 2，不满足发表关最低要求`,
    );
  }
  if (grid.goals.length < 2) {
    throw new Error(
      `assertPublishableLevel: 目标格数（${grid.goals.length}）< 2，不满足发表关最低要求`,
    );
  }
  // 内联 win-check 逻辑：所有箱子都在目标格上 → 开局已通关，不合法
  const alreadyWon = grid.boxes.every((b) =>
    grid.goals.some((g) => g.x === b.x && g.y === b.y),
  );
  if (alreadyWon) {
    throw new Error(
      "assertPublishableLevel: 开局已通关（所有箱子都在目标格上），不满足发表关要求",
    );
  }
}
