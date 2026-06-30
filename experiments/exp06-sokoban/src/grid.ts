/**
 * 【网格数据与解析】src/grid.ts —— AFP 纯数据 + 纯机制
 * ────────────────────────────────────────────────────────────
 * 在 AFP 里的角色：
 *   - Position / GridState / Direction 是「数据」(Godot Resource 类比)，纯 JSON，可见可审。
 *   - parseLevel 是「纯机制」——把 ASCII 关卡文本一次性变成初始 GridState。
 *     它在装载期跑一次（非每回合），故 MVP-1 不必升级成块（保持最小）。
 *
 * AFP 纪律点：
 *   1. parseLevel 是纯函数——同输入同输出，不读时钟 / 不用随机 / 不调 AI。
 *   2. walls 用 Position[]（纯 JSON 数组），不是 Set<"x,y">。
 *      理由：方案 A 全量穿透下墙坐标要在 initialInput / context / 日志里可见可审；
 *      Set 序列化进 JSON 会塌成 {}，破坏「全量状态穿透」的可观察性。
 *   3. TypeBox schema 既给 TS 类型，又产出标准 JSON Schema 供引擎 Ajv 校验。
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
 * MVP-1 只含墙 + 地板 + 角色，不含箱子 / 目标点。
 */
export interface GridState {
  readonly width: number;
  readonly height: number;
  readonly walls: readonly Position[]; // 墙坐标集合；其余可走格视为地板
  readonly player: Position; // 角色坐标
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
  player: PositionSchema,
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
 * ASCII 关卡解析：'#'=墙, '.' 或空格=地板, '@'=角色。
 *   - width  = 最长一行的长度
 *   - height = 行数
 *   - 必须恰有一个 '@'：零个或多个 '@' 视为畸形输入，抛 Error。
 * 装载期一次性纯函数（非每回合）。
 */
export function parseLevel(ascii: string): GridState {
  // 按行切分；统一去掉 \r 以兼容 CRLF 文本。
  // 末尾去掉空行：文件常以换行结尾（如 level-1.txt），否则会多解析出一整行"空地板"。
  const lines = ascii.replace(/\r/g, "").replace(/\n+$/, "").split("\n");
  const height = lines.length;
  let width = 0;
  for (const line of lines) {
    if (line.length > width) width = line.length;
  }

  const walls: Position[] = [];
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
        case ".":
        case " ":
          // 地板：无需记录。
          break;
        default:
          // 其它字符按地板处理（MVP-1 不引入箱子 / 目标点；严格校验留 MVP-3）。
          break;
      }
    }
  }

  if (players.length === 0) {
    throw new Error("parseLevel: 关卡缺少角色 '@'（畸形输入）");
  }
  if (players.length > 1) {
    throw new Error(`parseLevel: 关卡含多个角色 '@'（找到 ${players.length} 个，畸形输入）`);
  }

  return { width, height, walls, player: players[0] };
}
