/**
 * 打包期关卡清单 —— 通过 import.meta.glob 分别扫 publishable/ 与 practice/ 两个子目录。
 *
 * PUBLISHABLE_LEVELS 从 publishable/ 目录派生，添加发表关走 `git mv` 或直接落 txt 到该目录、不改本文件。
 * malformed/ 目录不扫——畸形关不进浏览器 LEVELS，只走 CLI 报错验收路径。
 *
 * 目录结构承担发表关分类，兑现 R1.3"仅数据层变化即可加/切关"。
 */

const publishableModules = import.meta.glob("./levels/publishable/*.txt", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const practiceModules = import.meta.glob("./levels/practice/*.txt", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

/** 提取"去路径去后缀"的短名，例如 './levels/publishable/level-push-1.txt' → 'level-push-1'。 */
function normalize(modules: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [path, text] of Object.entries(modules)) {
    const name = path.split("/").pop()!.replace(/\.txt$/, "");
    result[name] = text;
  }
  return result;
}

const publishable = normalize(publishableModules);
const practice = normalize(practiceModules);

/** 全部可通过 URL 装载的关（发表关 + 普通对照关）。 */
export const LEVELS: Readonly<Record<string, string>> = { ...publishable, ...practice };

/** 默认关：URL 未指定 ?level 时用这份。 */
export const DEFAULT_LEVEL = "level-push-1";

/**
 * 发表关白名单——从 publishable/ 目录派生（非硬编码）。
 * 加一个发表关 = 扔一份 txt 到 src/levels/publishable/ 目录，不改一行代码。
 */
export const PUBLISHABLE_LEVELS: ReadonlySet<string> = new Set(Object.keys(publishable));
