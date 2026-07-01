/**
 * @paradigm NON-AFP: external-control-flow
 * @reason 回合门控（won → 拒绝方向键）、终局输入拦截、R/r 重开三条控制流是"跨回合的时间维度状态
 *         + 事件级条件分支"，用 AFP 数据流表达要么塞进配置的条件分支（违反"配置图静态可枚举"红线），
 *         要么把主循环推进引擎（违反 MVP-1 已钉的 K-LOOP 结论）。留浏览器 keydown 回调里是最简解。
 * @afp-debt 验证期结论：AFP 数据流不承担回合控制流是合理边界，非 AFP 在此处胜出。
 *          本 debt 不打算偿还——它是 D-013 目标的正面证据，将进 docs/paradigm-comparison.md。
 *          若门控扩到"暂停/多存档/回放"，需重评升级为 reducer / 状态机再重打标记。
 */

import type { FlowConfig } from "../../../engine/src/index.js";
import { parseLevel, assertPublishableLevel, type Direction, type GridState } from "./grid.js";
import { createPushRegistry } from "./blocks/register.js";
import { keyToDirection } from "./adapters/input-adapter.js";
import { stepPush } from "./driver.js";
import { render } from "./render.js";
import { parseJsonc } from "./jsonc.js";

import levelText from "./levels/level-push-1.txt?raw";
import pushConfigRaw from "./configs/push.jsonc?raw";

// ── 装载 ──

const config: FlowConfig = parseJsonc<FlowConfig>(pushConfigRaw);
const registry = createPushRegistry();

let currentGrid: GridState = parseLevel(levelText);
assertPublishableLevel(currentGrid); // fail-fast: ≥2 箱 / ≥2 目标 / 开局非通关

let won = false;

const container = document.getElementById("grid");
if (!container) throw new Error("main: 找不到挂载点 #grid");

render(currentGrid, container);

// ── 外部主循环 ──

window.addEventListener("keydown", (event) => {
  // R/r 重开
  if (event.key === "r" || event.key === "R") {
    currentGrid = parseLevel(levelText);
    won = false;
    render(currentGrid, container);
    return;
  }

  // 胜利门控
  if (won) return;

  const direction: Direction | null = keyToDirection(event.key);
  if (!direction) return;
  event.preventDefault();

  let result;
  try {
    result = stepPush(config, registry, currentGrid, direction);
  } catch (err) {
    console.error("[sokoban] stepPush failed:", err);
    return;
  }

  currentGrid = result.nextGrid;
  won = result.won;
  render(currentGrid, container, { won });
});
