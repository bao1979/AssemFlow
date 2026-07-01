/**
 * 【浏览器入口】src/main.ts —— 外部主循环（脚手架，不打 @paradigm）
 * ────────────────────────────────────────────────────────────
 * 在 AFP 里的角色：前端脚手架 + K-LOOP「外部主循环」选型的落地点。
 *   它把装配流串成一个可玩的回合制 demo：
 *     装载关卡 → 渲染初始网格 → 绑定 keydown
 *       → 每次按键经转接件 keyToDirection 转方向
 *       → 调 stepWalk 跑一趟装配流（引擎确定性执行）
 *       → 更新 currentGrid（方案 A：状态在调用方手里）
 *       → 重渲染
 *
 * K-LOOP（Q-027）选型落地：循环在引擎外。
 *   引擎只负责「一次按键 = 一趟确定性装配」(stepWalk → assemble)，
 *   循环 / 事件 / 渲染都在这里（浏览器侧）。回合制天然适配事件驱动：
 *   keydown 每次按键驱动一趟 assemble，回合后刷新渲染。
 *   引擎不为此引入一等 loop step——保持单趟纯函数式语义。
 *
 * 为什么不打 @paradigm：
 *   main.ts 是前端脚手架 / 浏览器入口，不在「配置即图」的 AFP 数据流承诺范围内
 *   （判据见 .kiro/steering/afp-core.md「标记适用范围」，R4.3）。业务/装配逻辑
 *   （move-step 块、walk 配置、driver）已是纯 AFP，本文件只做事件绑定与状态保管。
 */

import type { FlowConfig } from "../../../engine/src/index.js";

import { parseLevel, type Direction, type GridState } from "./grid.js";
import { createWalkRegistry } from "./blocks/move-step.js";
import { keyToDirection } from "./adapters/input-adapter.js";
import { stepWalk } from "./driver.js";
import { render } from "./render.js";
// 唯一的 JSONC 解析实现（浏览器入口与测试共用，见 jsonc.ts 头部注释：
// 消灭"各自维护一套解析逻辑"的分叉，是白屏 bug 的根治，不是头痛医头）。
import { parseJsonc } from "./jsonc.js";

// Vite `?raw` 导入：把关卡文本与配置原样作为字符串引入（design 未决问题：取最简的 ?raw）。
import levelText from "./levels/level-1.txt?raw";
import walkConfigRaw from "./configs/walk.jsonc?raw";

// ── 装载（一次性）──────────────────────────────────────────────

const config: FlowConfig = parseJsonc<FlowConfig>(walkConfigRaw);
const registry = createWalkRegistry();

// 方案 A：调用方持有 currentGrid，在回合间保管。
let currentGrid: GridState = parseLevel(levelText);

const container = document.getElementById("grid");
if (!container) {
  throw new Error("main: 找不到挂载点 #grid（index.html 缺少 <div id=\"grid\">）");
}

// 渲染初始网格（R2.1：浏览器中加载并显示初始网格）。
render(currentGrid, container);

// ── 外部主循环：keydown → adapter → stepWalk → render ───────────

window.addEventListener("keydown", (event) => {
  const direction: Direction | null = keyToDirection(event.key);
  if (!direction) return; // 无关按键不触发回合（状态不前进）。

  event.preventDefault(); // 阻止方向键滚动页面。

  // 一回合：跑一趟确定性装配，更新调用方保管的状态，再重渲染（R2.2：移动当场可见）。
  currentGrid = stepWalk(config, registry, currentGrid, direction);
  render(currentGrid, container);
});
