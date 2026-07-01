# 贡献指南

> 如果你希望通过"交代码"来支持这个项目，先读完本文——**当前阶段最有价值的贡献不是代码**。

## 先了解这个项目所处的位置

AssemFlow 现在的定位是**研究稿 v0.1 · 范式验证中**（见根 [README.md](README.md)），不是一个可以直接拿来用的生产工具库。这决定了它对"参与"的期待跟主流开源项目不同：

- **接口没稳定**：引擎的 `inputMap` / 块契约都还有开放议题（见 [`docs/open-questions.md`](docs/open-questions.md)），大规模写代码 PR 很可能撞到还没有定型的地方
- **纪律密集**：AFP 有三条硬边界（[教程第 7 课](docs/tutorial/07-three-red-lines.md)）+ 五元构件术语 + `@paradigm` 标记约定 + SSOT 铁律。未经了解就直接改代码，撞规则概率很高
- **维护者精力有限**：路线图 [D-014](docs/paradigm-validation-sokoban-roadmap.md) 已经诚实标注了。**这个阶段收到高质量的一条 issue，比收到十个不合规的 PR 更有价值**

所以本文不是套模板的"welcome all contributions, please submit PR"，而是**明确列出四种参与方式，并对每一种诚实标注门槛与期待**。

## 四种参与方式（按门槛从低到高）

### 🟢 评论式参与（门槛最低，价值最高）

不用改任何文件。开一个 Issue 或 Discussion 就够了。

- **教程反馈**：读到 [12 课教程](docs/tutorial/README.md) 里哪一课卡住了？哪句话读不懂？哪个例子没说服你？**具体到"第 X 课的第 X 段"最有用**
- **可行性质疑**：读完 [可行性分析](docs/装配流编程-可行性分析.md) 或某个 `experiments/*/REPORT.md`，觉得哪条结论站不住？**"AFP 在 X 场景崩了"和"AFP 在 Y 场景成立"同等有价值**
- **业务场景问答**：描述你自己业务的一个流程，问"这个能落 AFP 甜区吗？为什么？"——**具体场景比抽象讨论有信息量得多**
- **实测碰到的问题**：跑 Sokoban demo 或引擎测试卡住了？OS / Node 版本 / 浏览器差异？直接开 Issue 附上错误输出

**为什么这一档价值最高**：研究性项目最缺的是外部诚实视角。维护者读自己的文字看不出问题，需要不同背景的读者指出"这里没说清楚"。

### 🟢 AI 自测（独家价值 · 需等交付物 A 发布）

路线图有一份[交付物 A：AI 介入提示词自测包](docs/paradigm-validation-sokoban-roadmap.md#交付物-aai-介入提示词自测包非自动验收)（暂未发布）——一组结构化提示词，让读者用**自己常用的大模型**（Claude / ChatGPT / Gemini / DeepSeek 等）跑一遍，反馈"这个模型能不能在 AFP 结构下产出合规配置"。

发布后可参与的方式：
- 挑一条自测包里的任务（例如"加一关指定尺寸与难度的迷宫"）
- 用你的模型跑，把提示词 + 模型输出 + 你的判断（合规 / 不合规 / 部分合规）以 Issue 或 Discussion 形式反馈
- 不需要你懂 AFP 的所有细节，只需要按自测包给的判据打勾

**为什么这一档独家**：项目最缺的数据只能由外部提供——维护者一个人测所有模型既不现实也不客观。你用什么模型都算贡献。

### 🟡 数据 / 关卡贡献（门槛中等）

只动数据文件，不动代码——PR 通道从这一档才真正打开。

- **加一关 Sokoban**（MVP-3 场景）：认识 Sokoban ASCII 字符集（`# . @ $ * +` 空格）就能做。在 `experiments/exp06-sokoban/src/levels/` 加一份 `level-N.txt`，本地跑 `npm run dev` 玩一遍能通关，就可以提 PR
- **故意写坏关卡**：写一份"墙不闭合 / 箱数 ≠ 目标数 / 缺少玩家"的关卡，测试引擎的静态校验（`parseLevel` + `assertPublishableLevel`）拦不拦得住、报错好不好懂——**故意写错比再加一个能玩的更有信息量**
- **翻译贡献**：教程或文档的英文/其它语言翻译。约定见根 [`.kiro/steering/language.md`](.kiro/steering/language.md)：中文是内容真相源，其它语言是翻译派生视图，改中文须同步重生成

**这一档 PR 通道说明**：
- 提 PR 前跑一遍 `cd experiments/exp06-sokoban && npm test` 确认没打破回归
- Commit message 用中文，简洁描述改动
- PR 描述：说清"改了什么、验收方式"

### 🔴 代码 PR（当前阶段暂不欢迎未经讨论的）

这条通道**当前阶段是关的**——不是永远关，是在验证阶段关。原因已在开头说清：接口不稳、纪律密集、维护者精力有限。**这不是傲慢**，是想保护读者不浪费时间——写了不会被合并的 PR 是最伤志愿者积极性的事。

如果你确认要动代码：

**第一步：先开 Issue 讨论**

- 说清楚你想改什么、为什么、大概怎么改
- 引用相关的 spec / open-question / REPORT（能引用越具体越好）
- 得到维护者确认后再写代码

**第二步：了解硬纪律（改代码前必读）**

- **五元构件与三条红线**：[`.kiro/steering/afp-core.md`](.kiro/steering/afp-core.md)、[教程第 7 课](docs/tutorial/07-three-red-lines.md)
- **状态同步铁律**：[`.kiro/steering/status-sync.md`](.kiro/steering/status-sync.md)——凡是"完成 / 通过"的断言必须有同轮真实工具输出撑着
- **`@paradigm` 范式标记约定**：如果你的改动引入了非 AFP 范式（reducer / 状态机 / 有状态块 / 全局状态），必须在文件头打标记（见 afp-core.md「范式混合标记约定」节）
- **相关 AI skills**（工作模式参考）：`.kiro/skills/afp-discover-blocks/` · `afp-author-config/` · `afp-write-adapter/` · `afp-extract-block/`

**第三步：工程要求**

- **环境**：Node.js >= 18（推荐 20+）·  Windows / macOS / Linux 都可
- **提交前必过**（在你改动涉及的目录跑）：
  ```powershell
  npm run typecheck   # tsc --noEmit 0 错
  npm test            # vitest run 全绿
  ```
- **Commit message 用中文**，一行说清改动主旨
- **PR 描述**说明：改了什么 / 为什么 / 关联的 Issue 或 Spec / 验收方式（哪些测试守着这个改动）
- **git 规范**见 [`.kiro/steering/git-workflow.md`](.kiro/steering/git-workflow.md)

## 行为准则

**诚实 > 礼貌。** 结论错就直说，措辞平和即可。不需要"我可能理解不对但……"这类稀释——直接说"我觉得这条结论不成立，因为 X"。

**反例与正例同价。** "AFP 在 X 场景崩了" 与 "AFP 在 Y 场景成立" 是同等有价值的贡献。项目目标是画出诚实的边界，不是证明 AFP 无所不能。

**"我不懂"是合法输入。** 教程读不懂、术语不清楚、例子不 get——这些反馈本身就是贡献。不需要装懂再来提 issue。

**不接受**：人身攻击、歧视性言论、恶意 spam。

## 语言约定

- **中文优先**：内容真相源在中文。所有 Issue / PR / Discussion 都欢迎用中文
- **英文欢迎**：如果你更习惯用英文，直接用即可。维护者会用中文回复；如果需要英文回复，请在开头说明
- **术语一致**：写"装配块 / 转接件 / 配置 / 数据 / 装配流"这五个词，不要造新翻译。江河隐喻见 [教程第 2 课](docs/tutorial/02-five-parts.md)

## 你的贡献会怎样被记录

- Issue / Discussion 里的对话会被引用进 [`docs/open-questions.md`](docs/open-questions.md) 或 REPORT，署 GitHub 用户名
- 数据 / 关卡 PR 合并后作者信息保留在 git 历史里
- 交付物 A（AI 自测）反馈会被引用进 [`docs/paradigm-comparison.md`](docs/paradigm-comparison.md)，署你选择的名字/handle
- 项目 v1.0 前不接受 CLA（贡献者许可协议），签署行为不必要

---

## 一句话收束

> 这个项目暂时不缺代码，缺的是**诚实读者**——愿意花时间读一遍、说一句"这里读不懂 / 这条我不信 / 我的场景是这样"的人。你花 10 分钟提一条这样的 Issue，比你花 10 小时改一段过不了 review 的代码更贴合项目当前需要的贡献形态。

有想法先开 Issue / Discussion，一起把边界画清楚。
