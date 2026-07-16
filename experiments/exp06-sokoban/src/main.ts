/**
 * @paradigm NON-AFP: external-control-flow
 * @reason 回合门控（won → 拒绝方向键）、终局输入拦截、R/r 重开三条控制流是"跨回合的时间维度状态
 *         + 事件级条件分支"，用 AFP 数据流表达要么塞进配置的条件分支（违反"配置图静态可枚举"红线），
 *         要么把主循环推进引擎（违反 MVP-1 已钉的 K-LOOP 结论）。留浏览器 keydown 回调里是最简解。
 * @afp-debt 验证期结论：AFP 数据流不承担回合控制流是合理边界，非 AFP 在此处胜出。
 *          本 debt 不打算偿还——它是 D-013 目标的正面证据，将进 docs/paradigm-comparison.md。
 *          若门控扩到"暂停/多存档/回放"，需重评升级为 reducer / 状态机再重打标记。
 */

import type { FlowConfig } from "@assemflow/core";
import { parseJsonc } from "@assemflow/core";
import { parseLevel, assertPublishableLevel, type Direction, type GridState } from "./grid.js";
import { checkLevel } from "./check.js";
import { createPushRegistry } from "./blocks/register.js";
import { keyToDirection } from "./adapters/input-adapter.js";
import { stepPush } from "./driver.js";
import { render } from "./render.js";

import { LEVELS, DEFAULT_LEVEL, PUBLISHABLE_LEVELS } from "./levels-manifest.js";
import pushConfigRaw from "./configs/push.jsonc?raw";

// ── bootstrap 装载期一次性函数 ──

/**
 * 装载期一次性函数：解析 URL 选关 → base check → parseLevel → gate → render + 绑定 keydown。
 * 可注入依赖，支持 jsdom 测试。不新增 @paradigm 标记（装载期一次性，非跨回合控制流）。
 */
export function bootstrap(
  container: HTMLElement,
  urlSearch: string,
  levels: Readonly<Record<string, string>>,
  defaultLevel: string,
  publishableLevels: ReadonlySet<string>,
  pushConfigRaw: string,
): { currentGrid: GridState; levelText: string; levelName: string } {
  const { name: levelName, rawText: levelText } = resolveLevelFromUrl(
    urlSearch, levels, defaultLevel,
  );

  // 装载前：base 静态 check（所有关都跑）
  const checkResult = checkLevel(levelText);
  if (!checkResult.ok) {
    console.error("[sokoban] base check 未通过：", checkResult.issues);
    container.textContent =
      `关卡 "${levelName}" 未通过 base 静态 check：\n` +
      checkResult.issues.map(i => `  [${i.rule}] ${i.message}`).join("\n");
    throw new Error(`base check failed for level "${levelName}"`);
  }

  // 装载期
  let currentGrid: GridState = parseLevel(levelText);

  // 仅发表关：assertPublishableLevel
  if (publishableLevels.has(levelName)) {
    assertPublishableLevel(currentGrid);
  }

  // 装配流配置 + 注册
  const config: FlowConfig = parseJsonc<FlowConfig>(pushConfigRaw);
  const registry = createPushRegistry();

  let won = false;

  render(currentGrid, container);

  // ── 外部主循环 ──
  function handleKeydown(event: KeyboardEvent): void {
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
  }

  window.addEventListener("keydown", handleKeydown);

  // 返回清理函数，调用方可移除监听器（支持 HMR / 多次调用场景）
  const cleanup = (): void => {
    window.removeEventListener("keydown", handleKeydown);
  };

  // 将清理函数挂到 container 上，方便外部获取
  (container as unknown as Record<string, unknown>)["__sokoban_cleanup"] = cleanup;

  return { currentGrid, levelText, levelName };
}

// ── 顶层调用 ──

const gridEl = document.getElementById("grid");
if (gridEl) {
  bootstrap(gridEl, window.location.search, LEVELS, DEFAULT_LEVEL, PUBLISHABLE_LEVELS, pushConfigRaw);
}

// ── resolveLevelFromUrl ──

/**
 * 装载期解析 URL 中的 level 参数。纯函数（同 search 同结果），
 * 属于装载前"用户选哪份数据"的一次性数据选择，非跨回合控制流——
 * 因此不新增 @paradigm 标记。
 */
export function resolveLevelFromUrl(
  search: string,
  levels: Readonly<Record<string, string>>,
  defaultLevel: string,
): { name: string; rawText: string } {
  const params = new URLSearchParams(search);
  const requested = params.get("level");
  if (requested && levels[requested]) {
    return { name: requested, rawText: levels[requested] };
  }
  // 未指定 或 指定了不存在的关 → 用默认关
  if (requested) {
    console.warn(`[sokoban] 未知关卡 "${requested}"，回退到默认关 "${defaultLevel}"`);
  }
  return { name: defaultLevel, rawText: levels[defaultLevel] };
}
