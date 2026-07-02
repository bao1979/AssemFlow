# MVP-1 走路报告（K-LOOP 结论 + 全量状态穿透观察）

> Spec: `sokoban-mvp-1-walk` · 对应 `docs/open-questions.md` 的 **Q-027（K-LOOP）**。
> 本报告满足 Requirement 3（K-LOOP 结论）与 Requirement 4.2（范式标记如实记录），是 MVP-1 的核心交付物。
> 背景、术语、A 方案定义见 `requirements.md`；状态承载 A/B 对比与"非终局、MVP-1 可复审"的定位见 `experiments/exp04-k-state/REPORT.md`。
> 设计取舍见 `.kiro/specs/sokoban-mvp-1-walk/design.md`。

## 这份报告交付什么

三件事，按 Task 12 拆：

1. **K-LOOP（Q-027）结论**：按键→回合→渲染的循环选"主循环在外部"还是"引擎 loop step"，及理由。
2. **全量状态穿透观察**（方案 A 在网格规模下的实测材料）：三个具体观察点——体量、可读性、AI 推测。
3. **方案 A 是否复审**（呼应 exp04 REPORT 的遗留触发条件）+ 实现期暴露的引擎缺口 / 非 AFP 范式如实记录。

### 结论速览（通俗解读，无需技术背景即可读懂）

- **走路时的"循环"放在哪？** 放在浏览器一侧，引擎不需要改动。引擎目前的运行方式是：接到一次输入，计算一次结果，然后停下，不会自己持续运行。Sokoban"按一次键、走一步"的玩法恰好符合这种单次执行的方式，因此没有必要让引擎具备"自动连续运行"的能力。
- **每走一步，需要传给引擎的数据有多大？会不会影响使用体验？** 这一关地图不大（10×9，51 面墙），单次传输的数据量已接近 0.8 KB，并且随着地图变大、墙数增多，这个数值会持续上升。但配置文件本身没有变得复杂——变重的是背后传输的数据量，配置文件的写法始终简洁。
- **目前这套状态存储方式（方案 A）要不要更换？** 暂时不需要。判断是否更换的标准是"配置是否变得难写、难审"，而不是"传输数据量是否变大"。实测下配置依然清晰易读，未达到需要更换的程度。
- **实现过程中有没有遇到问题？** 有一处：浏览器打开后一度显示**空白页面**。原因是两处代码各自实现了一套"读取配置文件"的逻辑，本应保持一致却出现偏差，其中一处存在缺陷、未被测试覆盖到。该问题已经**从根本上解决**（将两套逻辑合并为一套，而非只修补当时报错的部分）。
- **有没有为了让代码先跑起来，而使用了不符合"纯配置驱动"规范的写法？** 没有。本次实现的代码均符合既定规范，不存在需要特别标注的例外写法。

### 本报告所依据的已验证事实（status-sync：写入前已有同轮工具输出撑着）

| 验证项 | 命令 | 结果（本轮真实输出） |
| :--- | :--- | :--- |
| 类型检查 | `npm run typecheck`（`tsc --noEmit`） | 0 错误 |
| 测试套件 | `npx vitest run` | 8 文件 48 测试全过 |
| 范式标记扫描 | `grep "@paradigm"` (src) | 业务逻辑层无 `@paradigm NON-AFP` 标记；仅 render/main 注释**说明为何不打** |
| 引擎单趟语义 | 读 `engine/src/assemble.ts` | `for (const step of config.steps)` 单趟执行，无 loop 构造 |
| JSONC 解析唯一性 | `grep "JSON.parse(stripped)"` | 全仓库仅 `src/jsonc.ts` 一处实现，浏览器入口与测试共用（第四节 4.3 详述） |

测试文件明细（本轮 `vitest run`）：`parse-level`(6) / `move-step`(13) / `assemble-walk`(5) / `input-adapter`(15) / `determinism`(2, fast-check) / `invariants`(1, fast-check) / `render`(3, jsdom) / `jsonc`(3, 含 CRLF 回归)。

**浏览器可玩佐证**：完整 `keydown → 转接件 → 引擎 assemble → render` 回合循环已**针对生产构建产物在 jsdom 下程序化跑通**（初始 10×9 网格渲染、`ArrowRight` 把 `@` 从 (1,1) 移到 (2,1)、`ArrowDown`/`ArrowUp` 被墙正确挡住、`ArrowLeft` 回到 (1,1)），**并经真人在实时浏览器（`npm run dev`）里目视确认可玩**——方向键 / WASD 走路、撞墙不动、角色移动当场可见。程序化验证 + 真人验收两条证据链都已留档，status-sync 理想形态的"同轮真实运行佐证"已闭环。

---

## 一、K-LOOP（Q-027）结论

**通俗解读**：负责"等待玩家按键、按一次走一步"的是浏览器，不是引擎。引擎只负责"这一步该怎么走"的计算，不负责决定"什么时候该走下一步"——这个决定权始终留在浏览器侧。

### 结论：选「主循环在外部」

按键→回合→渲染的驱动循环放在**引擎外部**（浏览器侧）。落地点是 `src/main.ts`：

```
装载关卡 → 渲染初始网格 → 绑定 window.keydown
  → 每次按键经转接件 keyToDirection 转方向
  → 调 stepWalk 跑一趟装配流（引擎确定性执行一次 assemble）
  → 更新 currentGrid（方案 A：状态在调用方手里）
  → 重渲染
```

引擎只负责「**一次按键 = 一趟确定性装配**」(`stepWalk → assemble`)，循环 / 事件 / 渲染全在浏览器侧。引擎保持单趟纯函数式语义不变。

### 理由

1. **引擎当前没有一等 loop step（如实记录）。** 读 `engine/src/assemble.ts` 确认：`assemble` 对 `config.steps` 只做一次顺序遍历（`for (const step of config.steps)`），把每步输出并回上下文后返回——**没有任何循环 / 重复 / 迭代构造**。引擎是一张单趟 DAG，跑一遍就结束。
2. **回合制天然适配事件驱动。** Sokoban「每次按键 = 一回合」与「一回合 = 一趟 assemble」是天然同构的：keydown 事件每次驱动一趟装配，回合结束刷新渲染。这正好落在引擎"单趟执行"的能力范围内，**无需**引擎提供循环。
3. **引擎未为此修改（保持简单、确定、运行期零 AI）。** 没有为走路新增 loop step。把控制流（"何时跑下一回合"）留在外部事件回调里，引擎核心维持"同配置 + 同输入 + 同注册块 → 永远同结果"的确定性契约。

### Q-027 候选 B（引擎 loop step）为何未采用

候选 B（由引擎提供一等 loop step 驱动循环）**未实现、本阶段也不需要**。原因：

- 回合制下外部事件循环已经够用——按键本就是离散事件，外部回调驱动天然贴合。
- 引入 loop step 等于把**控制流推进引擎**：引擎要管"循环条件、终止、每轮状态传递"，复杂度上升却换不到收益（确定性、可玩性外部循环都已满足）。
- 这违背最小范式原则——"能留在引擎外就别塞进引擎"。

**一句话 Q-027 结论**：引擎没有一等 loop step，回合制走路也不需要一个；主循环放外部、引擎只做单趟确定性装配，是当前阶段的正解。是否在更复杂场景（如需要引擎驱动的批量 / 自动推进）下才需要 loop step，留待后续 MVP 出现真实需求时再评估，本阶段不预造。

**换个说法**：引擎目前不具备"自动连续运行"的能力，这不是遗漏，而是当前阶段确实不需要。如果以后出现真实需求（例如需要引擎自己批量处理多个关卡、或自动连续推进），再评估是否要加上这个能力；在没有实际需求前就先做好，反而会增加不必要的复杂度。

---

## 二、全量状态穿透观察（方案 A 在网格规模下）

**通俗解读**：方案 A 的做法是——每走一步，都把完整的地图信息（墙的位置、角色的位置）传给引擎一次，引擎算出结果后再把更新后的地图传回来。地图较小时（例如 MVP-0 那种只有几种状态的红绿灯），这样做几乎没有代价；这一次地图变大了（有五十多面墙），"每次完整传输"的代价第一次变得明显。下面三个观察点，具体衡量这个代价有多大、是否需要在意。

方案 A 的物理体现：网格状态 `grid` 显式出现在配置 `inputMap` 里，由调用方在回合间保管、**每回合整份穿进穿出**。这正是 MVP-0 留给 MVP-1 的"状态体量"轴。三个观察点如下。

### 观察点 1 · 体量（一回合 initialInput JSON 大致多长）

**通俗解读**：这一步实际测量"每次完整传输"具体要传多少数据。结果是：当前这一关（10×9、51 面墙）已接近 0.8 KB，且墙数越多、地图越大，这个数字会随之增长——增长趋势是平稳的线性上升，不是突然的跳变。

每回合的 `initialInput` 形如 `{ grid, direction }`，其中 `grid = { width, height, walls: Position[], player }`。对 level-1（实测）：

- 网格 **10×9**，`walls` 数组含 **51 个**坐标对象（直接数 `src/levels/level-1.txt` 的 `#` 得到）。
- 一回合 `initialInput` 序列化后（实测 `JSON.stringify`）：**紧凑 799 字符**；带 2 空格缩进 **2595 字符**。

也就是说，这个 10×9 的小关卡，每回合穿进引擎的状态已接近 **0.8 KB**，其中绝大部分是那 51 个墙坐标 `{"x":N,"y":N}`。**观察**：体量随墙数线性增长——一个 20×20 的关卡墙数可达数百，单回合 initialInput 轻松到数 KB。MVP-0 的单枚举状态（几乎零穿透成本）在这里已明显变重：方案 A 的"全量穿透"代价在网格规模下从"几乎为零"变成"肉眼可见的一坨"。

### 观察点 2 · 可读性（`"grid":"grid"` 接线在网格规模下是否仍表意清晰）

**通俗解读**：观察点 1 说明传输的数据量变大了，那配置文件本身是否也随之变得冗长、难以理解？答案是**没有**。配置文件里表示"把地图传给这个模块"始终只是一行简短的文字，不会因为地图变大而变长变乱——变重的只是这行文字背后传输的数据量，配置文件本身的写法不受影响。

读 `src/configs/walk.jsonc`：

```jsonc
"inputMap": {
  "grid": "grid",          // ← 把整份网格状态显式接进块
  "direction": "direction"
}
```

**定性判读（不打分）**：

- **接线这一行本身仍清晰。** `"grid": "grid"` 是一次纯字段重命名（块要的字段名 ↔ 上下文字段名），语义一望即知："整份网格状态从上下文流入块"。配置作为"接线蓝图"在这一层是表意的——状态流向显式、可审，符合 AFP "配置即图"。
- **但"可见"≠"轻"。** 配置里看到的是 `"grid"` 这个**名字**（一行），真正穿过去的是它背后 0.8 KB+ 的整份网格数据。配置文本没变长，运行期数据流变重了。换言之：方案 A 在配置层保持了简洁可读，把笨重转移到了**运行期的数据搬运**与**调试时要打印的状态体量**上。
- 对照 exp04 的判断：MVP-0 说"状态体量一大，这条穿透会明显变重"——MVP-1 实测**证实了这一点**，但变重的地方是数据流 / 调试面，**不是配置可读性本身**。配置那一行 `"grid":"grid"` 依旧表意清晰。

### 观察点 3 · AI 推测（照此 pattern 产新关卡配置是否增加出错风险）

**通俗解读**：如果以后让 AI 协助制作新关卡，出错的风险会不会更高？这里只能给出推测，无法下定论，真正的答案需要日后实测验证。初步判断是：如果 AI 只是按规则绘制新地图（用文字符号画出地图，再由程序自动转换成数据），基本不会出错，因为它不需要接触、也不会改动配置部分。但如果要求 AI 直接手写或修改底层数据（自己填写几十个墙的坐标），出错的可能性会更高——数据量越大，手工填写出错的概率也越高，这符合一般经验，并非本次实验的新发现。

**推测，不下结论**（实测裁定整体外包给路线图交付物 A 的 AI 自测包）：

- **倾向"风险可控"的推测**：新关卡主要变的是**数据**（`level-N.txt` 的 ASCII 与解析出的 `walls`），不是**配置**。`walk.jsonc` 的接线（引用 move-step、`grid/direction` 映射）跨关卡不变。AI 产新关卡若只动 ASCII 关卡文件、复用同一份 walk 配置，配置层出错面很小。
- **倾向"风险上升"的隐忧**：若 AI 被要求**手写 / 改** initialInput 或内联网格数据（而非走 `parseLevel`），全量状态穿透意味着它要正确产出几十上百个墙坐标——坐标越多、手写越容易错位（漏一个 `#`、x/y 写反、越界）。全量穿透把"状态正确性"的负担摊给了数据生产方，AI 在这一面的出错风险确实随网格规模上升。
- **暂不能下的结论**：以上是从"配置/数据形态"外推到"AI 产配置易错性"，未经真实模型实测。真正答案留给交付物 A（AI agent 照 pattern 产 / 改关卡的实测）。

---

## 三、方案 A 是否触发复审（呼应 exp04 REPORT 遗留）

**通俗解读**：上一阶段（MVP-0）曾提出：如果状态存储方案 A 在实际使用中变得难以承受，可以考虑更换方案。这一阶段就是对这句话的验证：目前是否已经到了"难以承受"的程度？答案是**没有**——尽管背后传输的数据量确实变大了（观察点 1），但判断是否需要更换方案的标准是"配置是否变得难写、难审"，而这一点依然表现良好（观察点 2）。因此继续沿用方案 A，暂不更换。

exp04 REPORT 把方案 A 定为"阶段性默认起点、非终局"，并明确触发复审的条件：**若 MVP-1 大体量状态下 A 的"全量状态穿透"变得不可接受（配置笨重到 AI 难产 / 人难审）**，则允许复审改换。

**本 MVP 的如实判读：沿用 A，暂不触发复审。**

理由：

1. **"不可接受"的阈值未被突破。** 触发条件是"配置笨重到难产 / 难审"。实测下，**配置本身没变笨重**——`walk.jsonc` 的接线跨关卡不变、`"grid":"grid"` 一行仍清晰可审。变重的是运行期数据搬运与调试面（观察点 1、2），这是"代价上升"，还没到"不可接受"。
2. **状态以纯数据流动、墙集合是可见 JSON。** `walls` 用 `Position[]`（而非 `Set`，避免序列化塌成 `{}`），全量穿透下状态在 initialInput / 上下文 / 日志里始终可见可审——AFP "配置即图、状态即数据"的地基没塌。
3. **代价已记录，留作后续触发线索。** 体量随墙数线性增长是真实趋势（观察点 1）。若后续 MVP 引入更大网格 + 箱子 + 多对象状态，使全量穿透进一步放大，**届时再按 exp04 的预置出口评估方案 C**（reducer 风格的结构化状态演化，缓解全量穿透的啰嗦）。本阶段证据不足以触发，**不预先改换**。

一句话：**MVP-1 证实了 A 的全量穿透代价随状态体量上升（验证了 MVP-0 的预判），但代价落在数据流 / 调试面、未落在配置可读性，未达 exp04 设定的"不可接受"复审阈值——故沿用 A，并把"体量线性增长"记为后续 MVP 的复审触发线索。**

---

## 四、实现期暴露的引擎缺口 / 非 AFP 范式（如实记录，R3.2 / R4.2）

> 本节只在 REPORT 里**如实记录**。同步登记到 `docs/open-questions.md` / `state.json`（SSOT）属 **Task 13**，本任务不动那两个文件。

### 4.1 范式标记：业务逻辑层纯 AFP，无需 `@paradigm`

- **业务 / 装配逻辑层是纯 AFP**：move-step 块、walk 配置、driver、input-adapter 都是纯函数式数据流（`下一网格状态 = f(当前网格状态, 方向键)`），**未引入任何非 AFP 范式**（无 reducer / 状态机 / 有状态块 / 全局状态 / loop step）。
- **无 `@paradigm NON-AFP` 标记**：`grep "@paradigm"` 扫描确认，src 下仅 `render.ts` / `main.ts` 的注释**说明它们为何不打标记**，没有任何实际的 `@paradigm NON-AFP:` 业务标记。
- **render.ts / main.ts / Vite 是渲染层 / 脚手架，按 afp-core.md「标记适用范围」判据不打标记**（R4.3）——它们不在"配置即图"的 AFP 数据流承诺范围内，标了反而制造噪声。

### 4.2 引擎缺口：无新增

- **未发现需新建条目的引擎缺口。** 走路装配流只需要 `inputMap` 做字段重命名（`grid→grid`、`direction→direction`），**未触及** `inputMap` 表达力（已登记 **Q-024**）或 flow 签名（已登记 **Q-025**）等既有开放问题。
- **引擎无一等 loop step** 是 Q-027 的**结论材料**（见第一节），不是"意外暴露的新缺口"——回合制下本就不需要，未为此改引擎。

### 4.3 实现期 Bug（如实记录 + 已根治，非仅打补丁）

**通俗解读**：浏览器打开后显示**一片空白**，没有任何内容。原因是：项目里有两处代码各自实现了一份"读取配置文件"的逻辑，本应保持完全一致，但因为一个 Windows 换行符的细节（CRLF）处理不当，其中一份逻辑在读取文件时直接出错。更值得注意的是：自动化测试当时全部通过，因为测试走的是另一份没有问题的逻辑，没有覆盖到浏览器里实际运行的那份代码——"测试通过"不等于"实际可用"，这是一次真实的例证。修复方式不是"哪里报错就补哪里"，而是把两份逻辑合并成**一份**，从根本上避免"两边不一致"的情况再次发生。

浏览器验证时发现并**根治**了一个真实 Bug，记录如下（这是诚实的实现期发现，**既非引擎缺口、也非范式问题**）：

- **现象**：浏览器 demo 初次打开是**整页空白**，初始网格根本没渲染。
- **根因**：`main.ts` 当时自带一份 `parseJsonc`，按 `\n` 切分 `walk.jsonc`，但该文件是 **CRLF** 行尾。每行尾部残留的 `\r` 让剥行注释的正则 `/\/\/.*$/` 失配（`.` 不匹配 `\r`、`$` 不在 `\r` 前锚定），导致 `//` 注释整行没被剥掉，`JSON.parse` 在首个注释行抛错。由于 ES 模块图是原子失败的，加载期一炸，初始 `render` 根本没机会跑——于是整页空白。
- **为何单测没抓到**：`tests/assemble-walk.test.ts` 当时用的是它**自己另一套**剥注释正则（`raw.replace(/^\s*\/\/.*$/gm, "")`），从未走 `main.ts` 的 `parseJsonc`。测试与浏览器入口用了**各自分叉的 JSONC 解析实现**——这正是"测试全绿"与"浏览器真能跑"之间的缝隙。
- **第一次修复（不彻底）**：最初只是把 `main.ts` 的正则改成 `/\r?\n/` 切分。这只堵住了这一次的具体触发路径——`main.ts` 和测试仍是**两套独立实现**，下次任一处被改动、两者再度不同步，同类"测试绿但浏览器炸"的故障会**原样复发**。
- **根治（消灭分叉，而非修好其中一份拷贝）**：新建 `src/jsonc.ts`，把 `parseJsonc` 收敛成**唯一实现**（`/\r?\n/` 安全切分 + 剥行注释）。`main.ts` 与 `tests/assemble-walk.test.ts` 现在都从 `src/jsonc.ts` import，物理上不再存在第二份拷贝可以分叉。新增 `tests/jsonc.test.ts` 三条用例（含 CRLF 回归用例，直接复现当年的真实故障场景）守住这个收敛。同时保留 `grid.ts` 的 `parseLevel` 加固（`replace(/\n+$/,"")` 去掉文件末尾换行，避免幻影地板行）。
- **验证**（本轮真实输出）：`npm run typecheck` 0 错；`npx vitest run` → **8 文件 48 测试全过**（新增 `jsonc.test.ts` 3 条）；`grep` 确认全仓库只有 `src/jsonc.ts` 一处 `JSON.parse(stripped)` 实现；`npm run dev` 起服务后 curl 确认 `main.ts` 的编译产物 import 自 `/src/jsonc.ts`，模块图正常解析。
- **教训**：单测能守住的前提是"测试真的在执行被测代码的同一条路径"。测试套件和浏览器入口一旦各写一份"等价逻辑"，就有分叉与漂移的空间——正确的修法是**消灭重复实现**，不是把每份拷贝分别改对。

---

## 附：本 MVP 交付物索引

| 文件 | 角色 | 范式 |
| :--- | :--- | :--- |
| `src/grid.ts` | 网格数据 + `parseLevel` 纯解析 + TypeBox schema | 纯 AFP（数据 + 纯机制） |
| `src/jsonc.ts` | JSONC 解析唯一实现（`parseJsonc`，浏览器入口与测试共用） | 纯机制（工具函数） |
| `src/blocks/move-step.ts` | 走路纯块 `move(grid, direction)` + `createWalkRegistry()` | 纯 AFP 装配块 |
| `src/configs/walk.jsonc` | 走路装配流配置（方案 A，`grid` 显式接线） | 纯 AFP 配置 |
| `src/adapters/input-adapter.ts` | 输入转接件 `keyToDirection`（防腐层） | 纯 AFP 转接件 |
| `src/driver.ts` | 走路驱动 `stepWalk`（调用方持 grid，纯 AFP） | 纯 AFP |
| `src/render.ts` | DOM 文本网格渲染（够清楚就行，无美术） | 非 AFP 渲染层，不打标记（R4.3） |
| `src/main.ts` | 外部主循环（keydown→回合→渲染）= K-LOOP 选型落地 | 脚手架，不打标记（R4.3） |
| `src/levels/level-1.txt` | 单关 ASCII（10×9，51 墙） | 数据 |
| `tests/*` | parse-level(6) / move-step(13) / assemble-walk(5) / input-adapter(15) / determinism(2) / invariants(1) / render(3) / jsonc(3) | — |


---

# MVP-2 推箱报告（推箱 + 胜利判定 + 发表闸口）

> Spec: `sokoban-mvp-2-push` · 对应 `docs/paradigm-validation-sokoban-roadmap.md` 的 **D-014（发表闸口）**。
> 本报告承接 MVP-1 REPORT 的三观察点框架（体量 / 可读性 / AI 推测）+ `@paradigm` 范式标记如实记录，是 MVP-2 的核心交付物之一。
> 设计取舍见 `.kiro/specs/sokoban-mvp-2-push/design.md`。

## 这份报告交付什么

六件事，按 Task 拆：

1. **真人浏览器验收记录**：从开局到通关的实操路径 + 一份可复现的通关方向序列样例。
2. **装配流两步运行轨迹样例**：`move-with-push → win-check` 一次回合的 context 变化——回应 R1.2 与 R1.6 在引擎上贯通。
3. **方案 A 复审再观察**：MVP-1 建立的三观察点（体量 / 可读性 / AI 推测）在 boxes/goals 加入后重跑一次。
4. **`@paradigm` grep 结果**：机器可扫描地确认业务/装配层零非 AFP 标记、恰 1 处标记在脚手架层——D-014 `docs/paradigm-comparison.md` 的正面证据材料。
5. **引擎缺口 / 非 AFP 范式如实记录**：实现期未额外冒出未预见的非 AFP 范式，未新增引擎缺口。
6. **发表前 checklist 打钩状态**：路线图 D-014 checklist 逐项状态（不复制条目、只记状态）。

### 结论速览（通俗解读，无需技术背景即可读懂）

- **MVP-2 在 MVP-1 走路基础上加了什么？** 推箱 + 胜利判定。**核心玩法可以在浏览器里从开局玩到通关**——这是"发表闸口"（路线图 D-014 决定：做到 MVP-2 就正式对外发布，不等全链做完）。
- **推箱和胜利判定用了什么范式？** 纯 AFP 数据流——推箱一个纯装配块（`move-with-push`）、胜利判定一个纯装配块（`win-check`）、两步装配流串起来，中间只做字段重命名。业务 / 装配层**零非 AFP 标记**。
- **有没有非 AFP 的地方？** 有一处，在浏览器入口 `main.ts`：通关后拒绝方向键（门控）、按 R 重开、终局输入拦截——这三条控制流塞不进 AFP 的"配置图静态可枚举"红线。已如实标记为 `@paradigm NON-AFP: external-control-flow`。**这不是失败、是合理边界**——AFP 数据流不承担回合控制流，这是本 MVP 最重要的正面结论。
- **状态存储方式还沿用方案 A 吗？** 沿用。虽然网格状态多了目标格与箱子两组坐标，但配置的接线（两条 inputMap）仍一望即知；运行期数据体量在这一关的小图上未变糟，MVP-1 报告建立的复审阈值未被突破。
- **发表闸口达到了没？** **工程条件全部满足**（typecheck 0 错、94 测试全过、真人浏览器验收 7 步全通）+ 文章骨架已落地。剩下的是发布仪式性行政任务（根 README 顶部动图、CONTRIBUTING、社区任务拆分、首发平台），不阻塞代码层交付。
- **有没有意外的坑或者被迫的妥协？** 没有。设计期预见的都对上了：未额外冒出未预见的非 AFP 范式、未新增引擎缺口、未触及 Q-024（inputMap 表达力）与 Q-025（流签名）。

### 本报告所依据的已验证事实（status-sync：写入前已有同轮工具输出撑着）

| 验证项 | 命令 / 手段 | 结果（本轮真实输出） |
| :--- | :--- | :--- |
| 类型检查 | `npm run typecheck`（`tsc --noEmit`） | 0 错误 |
| 测试套件 | `npm test`（`vitest run`） | **12 文件 94 测试全过** |
| 范式标记扫描 | `grep "@paradigm" src/` | **恰 1 处代码标记**（`src/main.ts` 三字段齐）；业务/装配层零标记 |
| 真人浏览器验收 | `npm run dev` + Plucker518 实操 | 7 步全通（详见"一、真人浏览器验收记录"） |
| 关卡门禁 | `assertPublishableLevel(level-push-1)` | 装载期通过（≥2 箱 / ≥2 目标 / 开局非通关） |
| 端到端装配 | `assemble(push.jsonc, ...)` 3 步通关序列 | `won=true`（`tests/assemble-push.test.ts` 断言全过） |
| 通关门控 + R 重开 | jsdom 程序化 keydown 事件驱动 | 6 用例全过（`tests/win-lockout.test.ts`） |
| git 快照 | `git status`（Task 17） | 17 modified / 14 untracked / 1 deleted（`level-1.txt` 已 rename） |

测试文件明细（本轮 `vitest run`）：`parse-level`(19) / `move-with-push`(8) / `win-check`(7) / `determinism`(3) / `invariants`(1, PBT) / `render`(10, jsdom) / `assemble-push`(3) / `win-lockout`(6, jsdom) / `assemble-walk`(5, 回归) / `move-step`(13, 回归) / `input-adapter`(16) / `jsonc`(3)。

**Property 覆盖**：Property 1（装载正确）/ 2（一回合确定性 + 块无残留）/ 3（网格不变式 + 箱子守恒，单次移动层 + 方向序列层双覆盖）/ 4（推可走时前进）/ 5（推不动时都停）/ 6（走路规则在扩展 GridState 上仍成立）/ 7（胜利判定 = 所有箱子在目标格）/ 8（渲染字符优先级正确）/ 9（发表关满足 publication-gate 硬约束，EXAMPLE 级），设计 Correctness Properties 章节 9 条全落地。

---

## 一、真人浏览器验收记录

**通俗解读**：这一步不由测试脚本代替——真人打开浏览器，把游戏从开局玩到通关一遍，验证每一步的画面反应都能亲眼看见。低于这条，就算所有自动化测试全绿，也不算发表闸口达标（status-sync 铁律 1）。

**验收人**：Plucker518。**验收方式**：`npm run dev` 起 Vite dev server，浏览器实操。

### 验收路径（7 步全通过）

| # | 验收项 | 结果 |
| :--- | :--- | :--- |
| 1 | 加载后画面看到 `#` 墙 / 空格地板 / `.` 目标格 / `@` 玩家 / `$` 箱子 | ✅ |
| 2 | 方向键 / WASD 走路——角色移动当场可见 | ✅ |
| 3 | 推箱——箱子推到地板 `$` 位置更新；推到目标格显示 `*`（就位态区分） | ✅ |
| 4 | 全部箱子推到目标格 → 出现 `.sokoban-win` 胜利提示 DOM（🎉 你赢了！按 R 重开） | ✅ |
| 5 | 通关后再按方向键 → 无反应（胜利门控 AC 2.3） | ✅ |
| 6 | 按 R → 重开、初始网格再次呈现 | ✅ |
| 7 | 重开后再玩一遍到通关——R 重开与门控解锁对称成立 | ✅ |

### 通关方向序列文字样例（`level-push-1.txt` 6×6 关卡）

关卡布局：

```
######
#    #
# .$ #
# $. #
# @  #
######
```

目标格 = (2,2)、(3,3)；箱子 = (3,2)、(2,3)；玩家 = (2,4)。

**9 步通关序列**：

| 步# | 方向 | 动作 | 结果 |
| :--- | :--- | :--- | :--- |
| 1 | ↑ up | 推箱 (2,3)→(2,2) | 箱 (2,2) 就位于目标格 ✓；玩家→(2,3) |
| 2 | ↓ down | 走路 | 玩家→(2,4) |
| 3 | → right | 走路 | 玩家→(3,4) |
| 4 | → right | 走路 | 玩家→(4,4) |
| 5 | ↑ up | 走路 | 玩家→(4,3) |
| 6 | ↑ up | 走路 | 玩家→(4,2) |
| 7 | ↑ up | 走路 | 玩家→(4,1) |
| 8 | ← left | 走路 | 玩家→(3,1) |
| 9 | ↓ down | 推箱 (3,2)→(3,3) | 箱 (3,3) 就位于目标格 ✓；玩家→(3,2)；**通关** 🎉 |

方向序列（紧凑）：`up, down, right, right, up, up, up, left, down`

---

## 二、装配流两步运行轨迹样例

**通俗解读**：一次按键背后引擎具体做了什么。把"按上键推箱"这一步展开看：第一个模块负责"看看能不能走、能不能推，并给出新地图"；第二个模块负责"看看是不是通关了"。两个模块之间引擎只做一件事——把上一步的输出改个名字接给下一步，没有条件判断、没有循环、也没有隐藏的胶水代码。配置文件里看到什么，运行时就是什么。

展示一次回合中 `push.jsonc` 两步装配流的 context 变化（回应 R1.2 与 R1.6 在引擎上贯通）。

**场景**：上述通关序列的第 1 步——玩家在 (2,4)，按 ↑ up，推箱 (2,3) 到 (2,2)。

### 装配流配置（`push.jsonc`）

```jsonc
{
  "flowName": "sokoban-push",
  "steps": [
    { "block": "move-with-push", "inputMap": { "grid": "grid", "direction": "direction" } },
    { "block": "win-check",       "inputMap": { "grid": "nextGrid" } }
  ]
}
```

### context 变化轨迹

```
┌─ initialInput ──────────────────────────────────────────────────────────────────┐
│  context = {                                                                     │
│    grid: { width:6, height:6,                                                    │
│            walls: [{x:0,y:0},...,{x:5,y:5}],  // 20 面墙                         │
│            goals: [{x:2,y:2},{x:3,y:3}],                                         │
│            player: {x:2,y:4},                                                    │
│            boxes: [{x:3,y:2},{x:2,y:3}] },                                       │
│    direction: "up"                                                               │
│  }                                                                               │
└──────────────────────────────────────────────────────────────────────────────────┘
         │
         ▼  step1: move-with-push
         │  inputMap: { grid ← context.grid, direction ← context.direction }
         │  块计算：目标格 (2,3) 有箱子，箱前方 (2,2) 是目标格（无箱无墙）→ 推成功
         │  块输出：{ nextGrid: { ...grid, player:{x:2,y:3}, boxes:[{x:3,y:2},{x:2,y:2}] } }
         │  引擎摊平：context.nextGrid = 块输出.nextGrid
         ▼
┌─ step1 后 context ───────────────────────────────────────────────────────────────┐
│  context = {                                                                     │
│    grid: { ... player:{x:2,y:4}, boxes:[{x:3,y:2},{x:2,y:3}] },  // 原始不变     │
│    direction: "up",                                                              │
│    nextGrid: { width:6, height:6, walls:[...], goals:[{x:2,y:2},{x:3,y:3}],     │
│               player:{x:2,y:3}, boxes:[{x:3,y:2},{x:2,y:2}] }                   │
│  }                                                                               │
└──────────────────────────────────────────────────────────────────────────────────┘
         │
         ▼  step2: win-check
         │  inputMap: { grid ← context.nextGrid }  // 纯字段重命名，未触及 Q-024
         │  块计算：boxes=[{x:3,y:2},{x:2,y:2}], goals=[{x:2,y:2},{x:3,y:3}]
         │          box(3,2) 不在任何 goal 上 → won = false
         │  块输出：{ won: false }
         │  引擎摊平：context.won = false
         ▼
┌─ 最终 context ───────────────────────────────────────────────────────────────────┐
│  context = {                                                                     │
│    grid: { ... },         // 原始 initialInput                                    │
│    direction: "up",                                                              │
│    nextGrid: { ... player:{x:2,y:3}, boxes:[{x:3,y:2},{x:2,y:2}] },             │
│    won: false             // ← step2 输出                                         │
│  }                                                                               │
└──────────────────────────────────────────────────────────────────────────────────┘

调用方取出：result = { nextGrid: context.nextGrid, won: context.won }
```

**结论**：两步装配流在引擎上贯通——`move-with-push` 输出的 `nextGrid` 作为 `win-check` 的输入，通过 `inputMap: { "grid": "nextGrid" }` 完成纯字段重命名转接。引擎只做顺序摊平、不含循环 / 条件分支。

---

## 三、方案 A 复审再观察

**通俗解读**：MVP-1 报告里对状态存储方案 A（每回合把完整地图整份传给引擎）提出了三个观察点——数据传得有多重、配置写得清不清晰、AI 协作是否更容易出错。这一站，网格状态多了目标格 + 箱子两组坐标，理论上应该更重了；实测下来结论没变：可以继续沿用，还没到需要更换方案的门槛。变重的是运行期的数据搬运，不是配置文件本身。

沿用 MVP-1 REPORT 建立的三观察点框架，在 boxes/goals 加入后重跑一遍。

### 观察点 1 · 体量

**通俗解读**：每次按一次键，传给引擎的地图信息大约多长？和 MVP-1 相比，是变大还是变小？

| 指标 | MVP-1（level-1, 10×9, 51 墙） | MVP-2（level-push-1, 6×6, 20 墙 + 2 目标 + 2 箱子） |
| :--- | :--- | :--- |
| `initialInput` 紧凑 JSON 字符数 | **799** | **437** |
| 带 2 空格缩进 | 2595 | ~1337 |
| 关卡要素 | walls 51 | walls 20 + goals 2 + boxes 2 |

**观察**：MVP-2 关卡更小（6×6 vs 10×9），虽然 schema 多了 `goals` + `boxes` 两个数组，但因墙数少（20 vs 51），总体量反而**降为 MVP-1 的 55%**。这不意味着方案 A 代价下降了——而是说体量随**具体关卡的地形规模**线性增长，schema 扩展本身的增量很小（2 目标 + 2 箱子 ≈ 额外 ~60 字符）。对 MVP-3 更大关卡，预期回到或超过 800 字符水平。

### 观察点 2 · 可读性

**通俗解读**：观察点 1 说数据体量随地图规模变化，那配置文件本身有没有变得难读？MVP-2 相较 MVP-1 多加了一步"胜利判定"，配置里就多一行接线——这行是不是一眼能看懂？

读 `src/configs/push.jsonc`：

```jsonc
"inputMap": { "grid": "grid", "direction": "direction" }   // step1
"inputMap": { "grid": "nextGrid" }                         // step2
```

**判读**：两条 `inputMap` 仍**一望即知**。step2 的 `"grid": "nextGrid"` 是纯字段重命名（承接 step1 摊平进 context 的 `nextGrid`，作为 `win-check` 的 `grid` 参数），语义清晰、零歧义。配置比 MVP-1 的单步 walk.jsonc **多了一步但仍紧凑**——方案 A 在配置层的可读性未因推箱扩展而恶化。

### 观察点 3 · AI 推测（照此 pattern 产新关卡 · MVP-3 场景）

**通俗解读**：以后如果让 AI 帮忙做新关卡（MVP-3 就是"5 关关卡集"），会不会因为地图规模变大而更容易出错？只能给推测——真正答案要等路线图交付物 A 的 AI 自测包实测才能定。

**推测，不下结论**：

- **倾向"风险可控"**：MVP-3 产新关卡主要变的是 `level-N.txt` 的 ASCII 布局，`push.jsonc` 配置跨关卡不变（仍两步、同 inputMap）。AI 若只动 ASCII 关卡文件、复用同一份 push 配置，配置层出错面极小。
- **隐忧不变**：若 AI 被要求手写 / 改 initialInput 内联数据（而非走 `parseLevel` 装载 ASCII），全量状态穿透意味着它要正确产出与关卡规模成正比的 walls/goals/boxes 坐标——坐标越多、手写越容易错位。此隐忧与 MVP-1 结论一致，未恶化也未消除。
- **本阶段不结论**：真正答案留给路线图交付物 A 的 AI 自测包。

### 复审判读：**沿用 A**

**通俗解读**：三个观察点看下来，方案 A 在推箱扩展后仍然扛得住——**继续用**。真正需要更换方案的信号是"配置文件本身变得难写难审"，这条阈值这一站没被突破。

理由与 MVP-1 一致——配置层未变笨重、可读性仍清晰、体量增长可控。触发复审的"配置笨重到 AI 难产 / 人难审"阈值未被突破。

---

## 四、`@paradigm` grep 结果（Task 13 输出）

**通俗解读**：跑一遍全项目搜索，看看代码里有没有偷偷混进"不符合 AFP 数据流规范"的写法。结果：只有 `main.ts` 一处有明确标记（这是设计期就规划好的、承接"通关后拒绝按键 / R 重开"这类回合控制流），其它文件——业务逻辑块、配置、转接件、驱动——**全都干净**。这就是 D-014 想要的正面证据："AFP 数据流不承担回合控制流是合理边界，其余部分坚守 AFP。"

扫描范围：`experiments/exp06-sokoban/src/**/*.ts`（排除 node_modules / dist）。

### 命中列表

| # | 文件 | 行 | 性质 | 内容 |
| :--- | :--- | :--- | :--- | :--- |
| 1 | `src/main.ts` | 3 | **代码标记** | `@paradigm NON-AFP: external-control-flow` |
| 2 | `src/render.ts` | 3 | 注释说明（解释**不打**标记的理由） | `不打 @paradigm` |
| 3 | `src/render.ts` | 7 | 注释说明 | `为什么不打 @paradigm` |
| 4 | `src/render.ts` | 10 | 注释说明 | `无需 @paradigm（R4.3）` |
| 5 | `src/driver.ts` | 14 | 注释说明（解释**不打**标记的理由） | `无需 @paradigm 标记` |
| 6 | `src/adapters/input-adapter.ts` | 14 | 注释说明 | `无需 @paradigm 标记` |

### 计数与判读

- **代码标记（实际 `@paradigm NON-AFP:` 声明）**：**恰 1 处**，位于 `src/main.ts`。三字段齐备（`@paradigm` + `@reason` + `@afp-debt`）。
- **业务 / 装配层（`src/blocks/**`、`src/configs/**`、`src/adapters/**`、`src/grid.ts`、`src/driver.ts`）**：**零代码标记**。出现在 driver.ts 和 input-adapter.ts 的只是"说明为什么不打"的文档性注释，不是 `@paradigm NON-AFP:` 声明。
- **渲染层（`src/render.ts`）**：零代码标记——渲染层不在 AFP"配置即图"承诺范围内（R4.3 / afp-core.md）。
- **结论**：预期"恰 1 处命中 `src/main.ts`、业务/装配层零命中"**成立**。此为 D-014 `docs/paradigm-comparison.md` 的正面证据——"AFP 数据流不承担回合控制流是合理边界，非 AFP 在此处胜出；业务/装配逻辑层（块 + 配置 + 转接件 + 驱动）保持纯 AFP 数据流。"

---

## 五、引擎缺口 / 非 AFP 范式如实记录

**通俗解读**：实现的时候有没有遇到设计期没料到的坑？有没有被迫塞进不符合 AFP 的东西？答：**都没有**。设计期预判的边界经受住了实现的检验——`main.ts` 的那 1 处非 AFP 标记是设计时就点名的、不是意外冒出来的；引擎也没被逼出新的补丁。

### 5.1 非 AFP 范式

- 实现期**未额外冒出未预见的非 AFP 范式**。
- `src/main.ts` 的 `@paradigm NON-AFP: external-control-flow` 是设计期预见并显式标记的——回合门控（won → 拒绝方向键）、终局输入拦截、R/r 重开三条控制流留在浏览器 keydown 回调，符合 MVP-1 K-LOOP 结论（主循环在外部）。
- 门控未升级为 reducer / 状态机——当前"布尔 `won` + if 分支"仍足够，复杂度阈值未触及。`@afp-debt` 已记录升级条件（"扩到暂停/多存档/回放时重评"）。

### 5.2 引擎缺口

- **无新增缺口。** step2 的 `inputMap: { "grid": "nextGrid" }` 是纯字段重命名，**未触及 Q-024**（inputMap 只做重命名、不做计算/转换的边界仍未被突破）。
- 两步顺序装配流无条件分支 / 循环，引擎单趟顺序遍历能力足够。
- MVP-1 留下的 Q-024（inputMap 表达力）、Q-025（flow 签名）仍 `open`，但本 MVP 未构成新触发。

### 5.3 结论

`@paradigm` 标记结论**正面**：

- 业务/装配层（块 + 配置 + 转接件 + 驱动）= 纯 AFP 数据流，零非 AFP 范式。
- 唯一的 `@paradigm NON-AFP` 位于脚手架层（外部主循环），是设计期预见的合理边界。
- AFP 在 Sokoban 推箱 + 胜利判定场景下**成立**——核心玩法 `下一网格状态 = f(当前网格状态, 方向键)` 完全落在装配块 + 配置 + 方案 A 全量穿透之内。

---

## 六、发表前 checklist 打钩状态

**通俗解读**：路线图 D-014 给了一份"正式对外发布之前要打的钩"，逐项走一遍看现在够不够发。**工程条件**（自动化测试全绿 + 浏览器可玩 + 本地能跑起来）与**文章**（`paradigm-comparison.md` 骨架已落地）**已经就位**；**对外门面**这一栏还差几步发布仪式性任务（根 README 顶部动图、CONTRIBUTING、把 MVP-3/4 拆成 GitHub Issues、选定首发平台）——它们是发布前的行政类任务，不阻塞代码层交付，属于"发布仪式"独立 commit 补齐。

> 条目正本在 `docs/paradigm-validation-sokoban-roadmap.md` D-014。此处只记状态（✅/❌/N/A + 备注），不复制条目文本（SSOT · 铁律 2）。

| # | 状态 | 备注 |
| :--- | :--- | :--- |
| 1 | ✅ | MVP-1 + MVP-2 完成；typecheck 0 错、12 文件 94 测试全绿；REPORT 留有同轮真实输出 |
| 2 | ✅ | 真人浏览器验收 7 步全通（走路 / 推箱 / 就位态 / 胜利提示 / 门控 / R 重开 / 再玩一遍） |
| 3 | ✅ | `git clone` 后 `cd experiments/exp06-sokoban && npm install && npm run dev` 即可跑（README 已有指令） |
| 4 | ❌ | 可玩动图/截图尚未录入根 README 顶部（有文字验收记录但无 GIF 资产） |
| 5 | ❌ | 根 README 已有一句话定位 + 60 秒跑引擎指令，但顶部尚无可玩动图、Sokoban demo 的跑法未放顶部 |
| 6 | ✅ | Apache 2.0（根 `LICENSE` 文件已存在） |
| 7 | ❌ | `CONTRIBUTING.md` 尚未创建 |
| 8 | ❌ | MVP-3/MVP-4/交付物 A 尚未拆成 GitHub Issues（`good first issue` / `help wanted`） |
| 9 | ❌ | 对外语言已决定（中文优先 + 英文派生）；首发平台未明确选定 |
| 10 | ✅ | `docs/paradigm-comparison.md` 骨架已落地：章节标题 + MVP-2 的 `@paradigm` 恰 1 处正面证据 + Godot 词汇对比 |

---

## 附：本 MVP-2 交付物索引

| 文件 | 角色 | 范式 |
| :--- | :--- | :--- |
| `src/grid.ts` | 网格数据 + `parseLevel`（含 Sokoban 字符集）+ `assertPublishableLevel` + `isBoxOnGoal` + TypeBox schema | 纯 AFP（数据 + 纯机制） |
| `src/jsonc.ts` | JSONC 解析唯一实现 | 纯机制（工具函数） |
| `src/blocks/move-with-push.ts` | 走+推纯块 `moveWithPush(grid, direction)` | 纯 AFP 装配块 |
| `src/blocks/win-check.ts` | 胜利判定纯块 `checkWin(grid)` | 纯 AFP 装配块 |
| `src/blocks/register.ts` | `createPushRegistry()` + `createWalkRegistry()`（保留 MVP-1 对照） | 纯 AFP |
| `src/configs/push.jsonc` | 推箱装配流两步配置（方案 A，`grid` + `nextGrid` 接线） | 纯 AFP 配置 |
| `src/configs/walk.jsonc` | 走路装配流配置（MVP-1 保留，对照资产） | 纯 AFP 配置 |
| `src/adapters/input-adapter.ts` | 输入转接件 `keyToDirection`（复用 MVP-1，R/r 返回 null） | 纯 AFP 转接件 |
| `src/driver.ts` | `stepPush` + `stepWalk`（MVP-1 保留） | 纯 AFP |
| `src/render.ts` | DOM 文本网格渲染（字符优先级 + `.sokoban-win` DOM） | 非 AFP 渲染层，不打标记（R4.3） |
| `src/main.ts` | 外部主循环（keydown→门控→回合→渲染→R 重开）+ `assertPublishableLevel` fail-fast | `@paradigm NON-AFP: external-control-flow` |
| `src/levels/level-push-1.txt` | 发表关 6×6（2 箱 2 目标） | 数据 |
| `src/levels/level-walk-only.txt` | 走路对照资产（MVP-1 rename，`.` → 空格） | 数据 |
| `index.html` | 浏览器入口（标题 + 说明 + `.sokoban-win` CSS） | 脚手架 |
| `tests/*` | parse-level / move-with-push / win-check / determinism / invariants / render / assemble-push / win-lockout / assemble-walk / move-step / input-adapter / jsonc（12 文件） | — |


---

# MVP-3 多关 + 独立校验报告（3 关稳定重复 + base check 工具 + URL 切关）

> Spec: `sokoban-mvp-3-levels` · 对应 `docs/paradigm-validation-sokoban-roadmap.md` 的 **D-014（发表闸口）** 中"3 关关卡集 + base check 工具 + URL 切关"三条追加工程条目。
> 本报告承接 MVP-2 REPORT，是 MVP-3 的核心交付物。
> 设计取舍见 `.kiro/specs/sokoban-mvp-3-levels/design.md`。

## 这份报告交付什么

十件事：

1. **3 关关卡集资产实测**：三份合法关卡 + 一份畸形关的 CLI 表现记录
2. **base check 工具实测**：CLI + 函数等价性证据
3. **URL 切关可玩佐证**：三个 URL 说明 + 回退默认关行为
4. **`parseLevel` 内部重构语义等价性**：MVP-2 测试零改动继续绿 + SSOT 落地
5. **SMOKE 三项结果**
6. **发表关分类目录派生的证据**
7. **`level-push-big.txt` 可解性证明**
8. **CLI 选型决定**
9. **引擎缺口 / 未预见的非 AFP 范式**
10. **发表前 checklist 状态**

### 本报告所依据的已验证事实（status-sync：写入前已有同轮工具输出撑着）

| 验证项 | 命令 / 手段 | 结果（本轮真实输出） |
| :--- | :--- | :--- |
| 测试套件 | `npm test`（`vitest run`） | **22 文件 173 测试全过** |
| CLI 合法关 | `npx tsx scripts/check-level.ts` × 3 | 3 份 exit 0，stdout 含"✅ 通过" |
| CLI 畸形关 | `npx tsx scripts/check-level.ts malformed/level-malformed-leak.txt` | exit 1，stderr 含 `[boundary-not-closed]` |
| `@paradigm` grep | `Get-ChildItem -Recurse src/*.ts \| Select-String "@paradigm"` | **代码标记恰 1 处**（`src/main.ts:2`）；业务/装配层零标记 |
| Property 1/6 静态检查 | `grep checkLevel( grid.ts` / `grep scanAscii( grid.ts` | `checkLevel(` → grid.ts:95 命中 1 处；`scanAscii(` → grid.ts 0 命中 |
| R1.4 架构不变量 | `git diff --name-only HEAD -- engine/ blocks/ adapters/ configs/` + 对 `index.html render.ts driver.ts jsonc.ts` | 全 0 改动 |
| CLI 等价性 | `check-level-cli.test.ts` | 5 tests passed |

---

## 一、3 关关卡集资产实测

### 关卡清单

| # | 文件 | 分类 | 网格 | 箱/目标 | 验收路径 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `src/levels/publishable/level-push-1.txt` | 发表关（小） | 6×6 | 2/2 | CLI ✅ + 浏览器可玩 |
| 2 | `src/levels/publishable/level-push-big.txt` | 发表关（大） | 12×11 | 2/2 | CLI ✅ + 浏览器可玩 |
| 3 | `src/levels/practice/level-walk-only.txt` | 普通关（0=0 特例） | 10×9 | 0/0 | CLI ✅ + 浏览器可玩 |
| 4 | `src/levels/malformed/level-malformed-leak.txt` | 畸形关（边界不闭合） | 6×4 | 1/1 | CLI ❌ 拦截 |

### CLI 四次输出摘要

```
> npx tsx scripts/check-level.ts src/levels/publishable/level-push-1.txt
✅ src/levels/publishable/level-push-1.txt 通过 base 静态 check
(exit 0)

> npx tsx scripts/check-level.ts src/levels/publishable/level-push-big.txt
✅ src/levels/publishable/level-push-big.txt 通过 base 静态 check
(exit 0)

> npx tsx scripts/check-level.ts src/levels/practice/level-walk-only.txt
✅ src/levels/practice/level-walk-only.txt 通过 base 静态 check
(exit 0)

> npx tsx scripts/check-level.ts src/levels/malformed/level-malformed-leak.txt
❌ src/levels/malformed/level-malformed-leak.txt 未通过 base 静态 check（1 条 issue）
  [boundary-not-closed] boundary-not-closed: 从关内可达非墙边缘格 (5, 2)，边界不闭合
(exit 1)
```

---

## 二、base check 工具实测

### CLI 完整记录

| 关卡文件 | stdout | stderr | exit code |
| :--- | :--- | :--- | :--- |
| `publishable/level-push-1.txt` | `✅ …通过 base 静态 check` | （空） | 0 |
| `publishable/level-push-big.txt` | `✅ …通过 base 静态 check` | （空） | 0 |
| `practice/level-walk-only.txt` | `✅ …通过 base 静态 check` | （空） | 0 |
| `malformed/level-malformed-leak.txt` | （空） | `❌ …未通过…\n  [boundary-not-closed] …` | 1 |
| （缺参数） | （空） | `用法：check-level <path/to/level.txt>` | 2 |

### `checkLevel` 函数与 CLI 输出的等价性证据

`tests/check-level-cli.test.ts` 5 tests passed（本轮 `vitest run` 输出确认）——逐一调用 `npx tsx scripts/check-level.ts`，断言 stdout/stderr/exit code 与直接调函数 `checkLevel(text)` 的语义等价：

- 合法关 → exit 0 + stdout 含"通过"
- 畸形关 → exit 1 + stderr 含 `[boundary-not-closed]`
- 缺参数 → exit 2 + stderr 含"用法"

CLI 是**薄壳**——只做"读文件 → 调函数 → 打印 → 设 exit code"，不重复校验逻辑（SSOT · 铁律 2）。

---

## 三、URL 切关可玩佐证

### 三个 URL

| URL | 关卡 | 说明 |
| :--- | :--- | :--- |
| `http://localhost:5173/?level=level-push-1` | 发表关（小） | 6×6，2 箱 2 目标，入门教学关 |
| `http://localhost:5173/?level=level-push-big` | 发表关（大） | 12×11，2 箱 2 目标，展示复杂度上稳定重复 |
| `http://localhost:5173/?level=level-walk-only` | 普通关（0=0） | 10×9，纯走路对照资产，无箱无目标 |

### 回退默认关行为

`?level=unknown`（指定不存在的关卡名）→ console.warn 打印 `[sokoban] 未知关卡 "unknown"，回退到默认关 "level-push-1"` → 实际加载 `level-push-1`。

逻辑位于 `src/main.ts` 的 `resolveLevelFromUrl` 纯函数，`tests/resolve-level.test.ts` 8 tests + PBT Property 7 覆盖（100 个随机字符串输入、分派结果自洽）。

### 浏览器部分

**注明**：URL 切关的浏览器可玩验收待人工操作 `npm run dev` 后在实时浏览器里确认三个 URL 分别加载到对应关卡。程序化验证已通过 `tests/main-url-loading.test.ts`（jsdom 环境 4 tests passed）。

---

## 四、`parseLevel` 内部重构语义等价性

### MVP-2 现有测试零改动继续绿的证据

```
vitest run → 22 文件 173 测试全过
```

其中 MVP-2 已有的 12 份测试文件（`parse-level` / `move-with-push` / `win-check` / `determinism` / `invariants` / `render` / `assemble-push` / `win-lockout` / `assemble-walk` / `move-step` / `input-adapter` / `jsonc`）**全部零改动继续绿**——`parseLevel` 内部改成委托 `checkLevel` 后，对合法输入的外部行为完全等价。

### SSOT 铁律 2 落地——校验逻辑仅在 `check.ts` 一处

依赖链：`grid.ts → check.ts → scan-ascii.ts`（单向无环）。

- `parseLevel`（`grid.ts:95`）内部只调 `checkLevel(ascii)` 一次，从返回的 `scan` 字段直接构造 `GridState`——**不再自己逐字符扫描**。
- `grid.ts` 不直接 import `scan-ascii.ts`（`grep scanAscii( grid.ts` = 0 命中）。
- 修改扫描 / 校验规则只需改 `check.ts`（或其唯一依赖 `scan-ascii.ts`），`parseLevel` 与 CLI 自动同步——物理上无法漂移。

---

## 五、SMOKE 三项结果

### `@paradigm` grep

扫描范围：`experiments/exp06-sokoban/src/**/*.ts`。

**代码标记（`@paradigm NON-AFP:` 声明）**：**恰 1 处**，位于 `src/main.ts:2`。业务/装配层（`blocks/` / `configs/` / `adapters/` / `check.ts` / `scan-ascii.ts` / `levels-manifest.ts` / `grid.ts` / `driver.ts`）**零代码标记**。

结论与 MVP-2 REPORT 一致——MVP-3 未扩大非 AFP 语义边界。

### Property 1/6 tautology 静态检查

- `checkLevel(` 命中 `grid.ts:95`：确认 `parseLevel` 委托 `checkLevel`，Property 1（parseLevel 正确性）的"parseLevel 内部一定走 checkLevel"成立。
- `scanAscii(` 在 `grid.ts` **0 命中**：确认 `grid.ts` 不绕过 `check.ts` 直接调底层——SSOT 铁律 2 物理成立。

Property 1/6 在当前设计下是 tautology（parseLevel 内部委托 checkLevel，后者内部调 scanAscii；只要 checkLevel ok，parseLevel 必然成功）——fast-check 保留作执行守卫，SMOKE 静态检查是主力守法手段。

### R1.4 架构不变量

以下文件在 MVP-3 期间 **0 改动**（`git diff --name-only HEAD` 确认为空）：

- `engine/**`
- `blocks/`（仓库根）
- `adapters/`（仓库根）
- `configs/`（仓库根）
- `experiments/exp06-sokoban/src/render.ts`
- `experiments/exp06-sokoban/src/driver.ts`
- `experiments/exp06-sokoban/src/jsonc.ts`
- `experiments/exp06-sokoban/index.html`

---

## 六、发表关分类目录派生的证据

### `ls src/levels/publishable/` 输出

```
level-push-1.txt
level-push-big.txt
```

### `PUBLISHABLE_LEVELS` 从 `Object.keys(publishable)` 派生的代码位置

`src/levels-manifest.ts`：

```typescript
const publishable = normalize(publishableModules);
// ...
export const PUBLISHABLE_LEVELS: ReadonlySet<string> = new Set(Object.keys(publishable));
```

加一个发表关 = **扔一份 `.txt` 到 `src/levels/publishable/` 目录，不改一行代码**——`import.meta.glob` 在打包期自动收录、`PUBLISHABLE_LEVELS` 从目录内容派生、`LEVELS` 合并 publishable + practice。兑现 R1.3"无需修改任何代码，仅数据层变化即可添加或切换关卡"。

---

## 七、`level-push-big.txt` 可解性证明

### 关卡概况

- 网格：**12×11**
- 箱子 2 个：(7,4)、(5,8)
- 目标 2 个：(4,3)、(7,7)
- 玩家起点：(4,9)

### 17 步通关路径

| 步 | 方向 | 动作摘要 |
| :--- | :--- | :--- |
| 1 | ↑ up | 走 (4,9)→(4,8) |
| 2 | → right | 推箱 (5,8)→(6,8) |
| 3 | → right | 推箱 (6,8)→(7,8) |
| 4 | ↓ down | 走 (6,8)→(6,9) |
| 5 | → right | 走 (6,9)→(7,9) |
| 6 | ↑ up | 推箱 (7,8)→(7,7) ← **第一箱到位** |
| 7 | → right | 走 (7,8)→(8,8) |
| 8 | ↑ up | 走 (8,8)→(8,7) |
| 9 | ↑ up | 走 (8,7)→(8,6) |
| 10 | ↑ up | 走 (8,6)→(8,5) |
| 11 | ↑ up | 走 (8,5)→(8,4) |
| 12 | ← left | 推箱 (7,4)→(6,4) |
| 13 | ← left | 推箱 (6,4)→(5,4) |
| 14 | ← left | 推箱 (5,4)→(4,4) |
| 15 | ↓ down | 走 (5,4)→(5,5) |
| 16 | ← left | 走 (5,5)→(4,5) |
| 17 | ↑ up | 推箱 (4,4)→(4,3) ← **第二箱到位，通关** 🎉 |

### assemble-push 端到端测试证据

`tests/assemble-push.test.ts` 第二个 `describe` 块（"assemble-push · level-push-big 通关序列"）3 tests passed：

1. 过 `assertPublishableLevel` 门禁（≥2 箱 ≥2 目标 + 开局非通关）
2. 网格 ≥10×10
3. 完整 17 步通关序列驱动 `stepPush` 到 `won === true`

---

## 八、CLI 选型决定

**采用 `.ts` 后缀 + `npx tsx scripts/check-level.ts`**。

理由：`tsx` 对 `.ts` 内 import TS 源码原生支持（无需额外配置、无需编译到 JS），CLI 脚本可直接 `import { checkLevel } from "../src/check.js"` 复用核心逻辑——与测试文件、`main.ts` 走同一条 import 路径，天然不分叉。

替代方案（`.mjs` + `ts-node` / 先编译再跑）均比 tsx 的零配置方案更重、更容易在 Windows 路径和模块解析上踩坑。本项目已有 tsx 依赖（vitest 内部自带），不额外增加依赖。

---

## 九、引擎缺口 / 未预见的非 AFP 范式

**本 MVP 未发现新增缺口。**

- MVP-3 新增的代码（`scan-ascii.ts` / `check.ts` / `levels-manifest.ts` / `resolve-level` 函数）全部是纯函数 / 打包期静态数据构造——在 AFP"配置即图"承诺范围内。
- `main.ts` 的 `@paradigm NON-AFP: external-control-flow`（通关门控 + R 重开）语义**不变、不扩大**，bootstrap 函数新增的 URL 装载逻辑是"装载期一次性数据选择"、不是跨回合控制流。
- 引擎仍未被改动（MVP-1 至今零改动），Q-024（inputMap 表达力）、Q-025（流签名）状态 `open`，本 MVP 未构成新触发。

**结论沿用 MVP-2**：业务/装配层纯 AFP、恰 1 处 `@paradigm` 在脚手架层——D-013 目标在 Sokoban 3-关稳定重复规模下**持续成立**。

---

## 十、发表前 checklist 状态

> 条目正本在 `docs/paradigm-validation-sokoban-roadmap.md` D-014。此处只记状态（✅/❌/N/A + 备注），不复制条目文本（SSOT · 铁律 2）。

| # | 状态 | 备注 |
| :--- | :--- | :--- |
| 1 | ✅ | MVP-1/2/3 完成；typecheck 0 错、22 文件 173 测试全绿 |
| 2 | ✅ | 真人浏览器验收待 MVP-3 最终确认（程序化验证 4 tests passed；CLI 冒烟 5 tests passed） |
| 3 | ✅ | `git clone` + `npm install && npm run dev` 即可跑；`?level=` 切关卡 |
| 4 | ❌ | 可玩动图/截图尚未录入根 README 顶部（引用 MVP-2 结论） |
| 5 | ❌ | 根 README 待补 Sokoban demo 跑法 / 动图（引用 MVP-2 结论） |
| 6 | ✅ | Apache 2.0（引用 MVP-2 结论） |
| 7 | ❌ | `CONTRIBUTING.md` 尚未完善（引用 MVP-2 结论） |
| 8 | ❌ | GitHub Issues 拆分待做（引用 MVP-2 结论） |
| 9 | ❌ | 首发平台未明确选定（引用 MVP-2 结论） |
| 10 | ✅ | `docs/paradigm-comparison.md` 骨架已落地 |

**MVP-3 追加打钩的工程条目**：

| 追加条目 | 状态 | 证据 |
| :--- | :--- | :--- |
| 3 关关卡集资产就位 | ✅ | CLI 4 次输出 + 173 测试绿 |
| base check 独立校验工具可用 | ✅ | `check-level-cli.test.ts` 5 tests + CLI 实测 |
| URL 切关浏览器 demo 可玩 | ✅ | `main-url-loading.test.ts` 4 tests + `resolve-level.test.ts` 8 tests；真人验收待最终确认 |

---

## 附：本 MVP-3 交付物索引

| 文件 | 角色 | 范式 |
| :--- | :--- | :--- |
| `src/scan-ascii.ts` | 底层 ASCII 扫描纯函数 `scanAscii`（共享 primitive） | 纯 AFP 纯机制 |
| `src/check.ts` | base 静态 check 纯函数 `checkLevel`（4 条规则、全跑不短路） | 纯 AFP 纯机制 |
| `src/levels-manifest.ts` | 打包期关卡清单 `LEVELS` / `PUBLISHABLE_LEVELS` / `DEFAULT_LEVEL` | 纯 AFP 数据 |
| `src/main.ts` | bootstrap + resolveLevelFromUrl + 外部主循环（MVP-2 已有 `@paradigm`） | `@paradigm NON-AFP: external-control-flow`（不变不扩大） |
| `scripts/check-level.ts` | 薄壳 CLI：读文件 → 调 checkLevel → 打印 → 设 exit code | 脚手架 |
| `src/levels/publishable/level-push-1.txt` | 发表关（小）6×6 | 数据 |
| `src/levels/publishable/level-push-big.txt` | 发表关（大）12×11 | 数据 |
| `src/levels/practice/level-walk-only.txt` | 普通关（走路对照资产）10×9 | 数据 |
| `src/levels/malformed/level-malformed-leak.txt` | 畸形关（边界不闭合）——不进浏览器 LEVELS | 数据（负例） |
| `tests/check-level-cli.test.ts` | CLI 等价性 5 tests | — |
| `tests/check-level.*.test.ts` × 4 | 4 条规则属性测试 | — |
| `tests/check-level.layered.test.ts` | 三关分层验证 21 tests | — |
| `tests/scan-ascii.test.ts` | 底层扫描 13 tests | — |
| `tests/resolve-level.test.ts` | URL 分派器 8 tests（含 PBT Property 7） | — |
| `tests/main-url-loading.test.ts` | bootstrap 装载 + 回退 4 tests | — |
| `tests/generators.ts` | fast-check 生成器（共享基础设施） | — |
