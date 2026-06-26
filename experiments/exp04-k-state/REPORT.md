# MVP-0 状态承载方案对比报告（A vs B）

> Spec: `sokoban-mvp-0-k-state` · 对应 `docs/open-questions.md` 的 **Q-026（K-STATE）**。
> 本报告满足 Requirement 2（状态承载方案对比），是 MVP-0 的核心交付物。
> 背景、术语、A/B 定义、工业先例与预判见同目录 `requirements.md`；设计取舍见 `design.md`。

## 这份报告比的是什么

一句话：**长寿命对象的"当前状态"存在哪里。** MVP-0 用一个带最小外部输入的红绿灯状态机（状态体量刻意极小，单枚举 `red/green/yellow`），在**同一份纯转移核** `transition(state, input)` 上搭出两个驱动器，做受控对比：

- **方案 A · 调用方持久化**：状态作 `initialInput` 进 / `nextState` 出，块保持纯。`src/driver-a.ts` 的 `stepA` 每回合把 `{state, input}` 喂进 `assemble()`，从结果上下文取 `nextState`，由**调用方**在回合间保管。
- **方案 B · 运行时承载状态**：状态活在「引擎所运行的有状态块」闭包内（`current`），配置只接线 `input`。`src/driver-b.ts` 的 `StatefulRunner.send(input)` 只发输入，状态对配置与调用方都不可见。B 整体带 `@paradigm NON-AFP: stateful-block` 标记。

受控变量只有一个——**状态存活在哪**。转移逻辑同一（A/B 复用 `src/traffic-light.ts` 的同一个纯函数），避免逻辑差异污染对比。

### 本报告所依据的已验证事实（status-sync：写入前已有同轮工具输出撑着）

| 验证项 | 命令 | 结果 |
| :--- | :--- | :--- |
| 类型检查 | `npm run typecheck` | 0 错误 |
| 测试套件 | `npm test` | 16 测试全过（transition 9 / determinism 2 fast-check / ab-equivalence 5） |
| A 路端到端 | `npm run assemble` | 轨迹 `red→green→green→yellow→red→red→green`，含 `green` 驻留态与 `green--pedestrian-->yellow` 分叉 |

A/B 行为等价（Property 5）与失败不前进对称（Property 6）由 `tests/ab-equivalence.test.ts` 的 5 条用例守住（含 fast-check 随机序列）。下文所有对比，都建立在"A、B 行为已被实测证明等价"这个前提上——否则对比不公平。

---

## 一、三维度对比

### 维度 1 · 配置可读性（实测材料：两份真实配置）

这是 MVP-0 最硬的一手材料——A/B 的配置**真的不同**，差异可直接并排比对。

**方案 A** `src/configs/traffic-light-a.jsonc`（接线纯块，状态在配置里**可见**）：

```jsonc
{
  "flowName": "traffic-light-a",
  "steps": [
    {
      "block": "traffic-light-step",
      "inputMap": {
        "state": "state",   // ← 状态显式接进块
        "input": "input"
      }
    }
  ]
}
```

**方案 B** `src/configs/traffic-light-b.jsonc`（接线有状态块，状态在配置里**消失**）：

```jsonc
{
  "flowName": "traffic-light-b",
  "steps": [
    {
      "block": "traffic-light-stateful",
      "inputMap": {
        "input": "input"    // ← 只有 input，state 不出现在配置任何地方
      }
    }
  ]
}
```

**对照结论**：

- **A：状态流向显式、可审，但啰嗦。** `inputMap` 含 `"state"`，读这份配置就能一眼看出状态从哪流入、又以 `nextState` 流出。代价是每回合都要把**全量状态**穿进穿出——本 MVP 状态只是单枚举，所以"啰嗦"还很轻；状态体量一大（如 MVP-1 的网格），这条穿透会明显变重（见"诚实边界"）。
- **B：简洁，但状态不可审。** `inputMap` 只剩 `"input"`，`state` 从配置里彻底消失。配置确实更短，但读这份配置**看不出有状态、也看不出状态怎么流转**——状态被 `traffic-light-stateful` 块的闭包吞掉了。这直接违背 AFP "**配置即图、一眼可审**"的卖点：配置图不再能完整表达数据流，状态成了图上看不见的暗线。

一句话：**A 用啰嗦换可审，B 用不可审换简洁。** 在 AFP 的价值排序里，"配置即图"是地基级承诺，B 在这一维度上是减分项。

### 维度 2 · 配置对 AI agent 的友好度 ⚠️ **（推测性分析，非实测）**

> **本维度明确标注为推测，不下实测结论。** 真正的"AI agent 照着配置产 / 改"的实测，整体外包给路线图交付物 A —— `docs/agent-test-prompts.md`（提示词自测包，由 Plucker518 自行到大模型实测裁定）。本报告**不**给出 AI 友好度的实测结论，仅做定性推测，避免伪精确打分。

基于配置形态的定性推测（**待 `docs/agent-test-prompts.md` 实测证伪/证实**）：

- **倾向 A 的理由（推测）**：A 的配置把状态流显式写在 `inputMap` 里，AI 改行为时"状态从哪来、到哪去"是配置里可见的锚点，符合"配置即接线"的心智；且 A 是纯 AFP，与引擎现有 `assemble` 心智一致，AI 不需要理解"块内有记忆"这种隐藏语义。
- **倾向 B 的隐忧（推测）**：B 的状态藏在块闭包里，AI 读配置无法得知"这条流是有记忆的"，改配置时容易误判（以为是无状态变换），且"重建 registry 才能 reset"这类运行时语义无法从配置推断。
- **暂不能下的结论**：以上都是从"人读配置"外推到"AI 读配置"，未经真实模型验证。AI 也可能反而偏好 B 的简洁（更少字段 = 更少出错点）。**这正是为什么本维度只能推测、必须留给交付物 A 实测。**

### 维度 3 · 调试容易程度

关键前提：**A/B 的失败语义是对称的**，这是 `design.md` Error Handling 与 Property 6 刻意保证的，目的是让"调试容易程度"的对比**只反映状态归属差异，而非错误处理差异**。

- 非法 `input`（枚举 `tick/pedestrian` 之外）被引擎 **Ajv 在块 `execute` 之前**拦下，`assemble` 返回 `success:false`。
- A 路 `stepA` 与 B 路 `send` **都**在此抛错，且**状态都不前进**：A 的调用方保留旧 `state`；B 的块 `execute` 未运行，闭包 `current` 不变。
- 这条"失败不前进、A/B 对称"已由 `tests/ab-equivalence.test.ts` 的 Property 6 用例实测（非法 input 抛错后再发合法 `tick`，两路都正确回到 `green`）。

在失败语义对称的前提下，调试差异只剩状态归属：

- **A：状态可见即可调。** 出问题时，当前 `state` 就在调用方手里、在每次 `assemble` 的入参/出参里，是数据流上的显式值——打印一行就能看到"上一步状态 + 输入 + 下一步状态"。复现只需重放同一 `(state, input)`，因为 `transition` 是纯函数（确定性由 `determinism.test.ts` 守）。
- **B：状态藏在闭包里，调试要多走一步。** 当前 `current` 不在数据流上，要观察它得从有状态块内部捞，或靠"再发一个已知输入、看输出反推"。复现一个中间态不能只喂单个输入，必须**从初始态重放整条输入序列**，因为状态是累积在闭包里的。

结论：**A 调试更直接**——状态是显式数据，可打印、可重放单步；B 把状态变成运行时暗状态，定位与复现都要多绕一层。

### 三维度小结

| 维度 | 方案 A（调用方持久化） | 方案 B（运行时承载状态） |
| :--- | :--- | :--- |
| 配置可读性 | 状态显式可审，配置略啰嗦 | 配置简洁，但状态不可见（违"配置即图"） |
| AI agent 友好度 ⚠️推测 | 推测略优（状态是配置锚点） | 推测有隐忧（隐藏记忆语义）— **留交付物 A 实测** |
| 调试容易程度 | 更直接（状态即数据，可重放单步） | 要多绕一层（暗状态，须重放整段序列） |

---

## 二、结论：后续 MVP 的默认起点

**选定 A（调用方持久化）作为后续 MVP 的状态承载默认起点 —— 阶段性默认、非终局定案，MVP-1 可复审。**

理由（实测 + 预判分层）：

1. **本 MVP 实测层面**：在三个可测维度里，A 在"配置可读性"与"调试容易程度"两维占优，且不牺牲 AFP "配置即图"的地基；B 的简洁是以"状态不可审 + 暗状态调试"为代价换来的。AI 友好度维度按纪律不计入裁定（推测、未实测）。
2. **工业先例层面（预判，非结论）**：`requirements.md` 的现实参考表显示，最经得起时间的范式几乎一边倒站 A —— Redux（`reducer(state, action)`）、Elm Architecture（`update(Msg, Model)->Model`）、确定性 lockstep 游戏同步（`nextState = step(state, inputs)`，与回合制 Sokoban 几乎同构）、Event Sourcing。B 也能成（Temporal / Step Functions 是铁证），但代价是一个会做持久化与恢复的**重引擎**，而那种引擎里的可变状态恰是 AFP 想躲的。

**为什么强调"非终局"**：本结论是在**状态体量极小（单枚举）**这个窄切面上得出的。MVP-1 的网格会引入大体量状态，A 的"全量状态每回合穿进穿出"可能从"轻微啰嗦"变成"明显笨重"。若 MVP-1 暴露这种反例，**允许复审改换** —— 不得把这个窄切面结论伪装成终局（R2.3）。本结论的定位是"**默认起点**"：后续 MVP 默认从 A 出发，除非有新证据推翻。

---

## 三、诚实边界（适用范围与 B 的真实成本）

### 3.1 本 MVP 没验证什么（R2.4）

- **状态体量刻意极小。** 状态 = 单个枚举（`red/green/yellow`）。本 MVP 只取"迁移复杂度"这一个轴（迁移依赖外部输入：`nextState = f(state, input)`），**刻意不碰"状态体量"轴**。
- **"大体量状态下 A/B 的差异"未在本 MVP 验证。** A 的核心代价是"全量状态穿透"，但单枚举的穿透成本几乎为零——所以本 MVP **测不出** A 在大状态下到底有多笨。这个变量整体留给 **MVP-1 的网格**（对应 `docs/open-questions.md` Q-027 K-LOOP 同站验证）。
- 因此本报告的结论强度是"**小状态切面下，A 更优**"，外推到大状态需 MVP-1 复核。

### 3.2 方案 B 原型的真实成本（如实记录，不粉饰）

MVP-0 的 B 用**闭包有状态块**作最小忠实原型，**不改引擎核心**（这是 `design.md` 钉死的取舍）。它缺少 Q-026 设想的 B 最终形态的一等机制，这些缺失是 B 的真实成本：

- **无一等 reset。** 闭包里的 `current` 无法被外部直接改写。要回到初始态，只能**丢弃整个有状态块、重建 `registryB`**（`StatefulRunner.reset` 即 `this.registryB = createRegistryB(initial)`）。"reset = 重建注册表"是 prototype 的将就，不是引擎能力。
- **无状态快照 / 恢复。** 闭包里的 `current` 引擎读不出、也回放不了——没有 Q-026 设想的"引擎自动读 / 写状态快照"。
- **无多实例隔离。** 靠"每次 `createRegistryB` 新建块实例"凑隔离，没有引擎级的实例边界。

一句话：**B 在 MVP-0 只验证了"状态藏进运行时"这个方向能跑通，并未交付一套引擎级状态机制。** 它能成（Temporal 证明了 B 方向的上限），但要补齐 reset / 快照 / 隔离意味着把引擎做重——而那正是 AFP 想躲开的可变状态中心。

---

## 四、预留：方案 C（如 reducer）

> 满足 R2.5：若 A、B **两种方案都不令人满意**，如实记录并探索第三方案，不允许跳过 MVP-0 直接做游戏。

**当前状态：未触发。** 本 MVP 的 A 在可测维度上达到了"可作默认起点"的标准，B 也跑通了（只是成本更高），**没有出现"两方案都不满意"的情形**。故方案 C 暂不展开，仅在此预留位置与触发条件。

**何时启用方案 C**：若 MVP-1 大体量状态暴露——

- A 的"全量状态穿透"在网格规模下变得不可接受（配置笨重到 AI 难产、人难审）；**且**
- B 的"运行时暗状态"在更复杂场景下仍违背"配置即图"、调试代价继续放大；

——即两方案都不满意时，探索**方案 C**。候选方向（仅登记，未论证）：

- **Reducer 风格的纯归约**：把状态演化表达为一串可声明、可枚举的 `reducer(state, action)` 组合，状态仍外置（属 A 谱系），但用结构化的 action/reducer 缓解"全量穿透"的啰嗦——介于"裸穿全量状态"（A）与"藏进运行时"（B）之间。
- 其它（待 MVP-1 证据触发后再补）。

方案 C 不是现在要做的事，而是"两方案都不满意"这个出口的预置应急通道。

---

## 五、实现期暴露的引擎缺口

按任务要求核查实现期是否暴露**新的**引擎缺口（已登记的不重复造）：

- **未发现需新建条目的引擎缺口。** 本 MVP 实现顺利跑通（typecheck 0 错、16 测试全过、A 路端到端跑通），没有撞出 `open-questions.md` 之外的新引擎问题。
- **既有缺口的关联**：
  - `inputMap` 仅支持字段重命名 —— 已登记 **Q-024**。本 MVP 的两份配置都只做重命名，未触及该缺口，无需新增。
  - B 原型缺一等 reset / 快照 / 多实例隔离 —— 这正是 **Q-026（本 MVP 所属议题）** B 选项的已知内容，不是"意外暴露的新缺口"。本 MVP 用闭包原型**具体确认**了这一缺口的形态，已作为 B 的成本记入第 3.2 节，并在 `docs/open-questions.md` Q-026 下补一条"实现期发现"备注（不改 Q-026 状态，仍 `open`）。

---

## 附：本 MVP 交付物索引

| 文件 | 角色 |
| :--- | :--- |
| `src/traffic-light.ts` | 纯转移核 `transition(state, input)` + I/O schema（A/B 共享） |
| `src/blocks/register.ts` | A 纯块 + B 有状态块工厂 + `createRegistryA/B` |
| `src/configs/traffic-light-a.jsonc` | 配置 A（接线 state+input，状态可见） |
| `src/configs/traffic-light-b.jsonc` | 配置 B（只接线 input，状态不可见） |
| `src/driver-a.ts` | 方案 A 驱动 `stepA`（调用方持状态，纯 AFP） |
| `src/driver-b.ts` | 方案 B 驱动 `StatefulRunner`（状态在块闭包，`@paradigm NON-AFP`） |
| `tests/transition.test.ts` | 转移表穷举（9） |
| `tests/determinism.test.ts` | 确定性属性测试 fast-check（2） |
| `tests/ab-equivalence.test.ts` | A/B 行为等价 + 失败不前进对称（5） |
