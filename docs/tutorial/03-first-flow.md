# 拼你的第一条装配流

> 本课目标：亲手跑通实验①的注册流，看 5 个块 + 1 份配置如何被脚本串起来。

## 前置

```powershell
cd experiments/exp01-sweet-spot
npm install
```

## 看看有什么

```
src/
├─ blocks/
│  ├─ email-validator.ts   # 查邮箱格式
│  ├─ password-hasher.ts   # 加密密码
│  ├─ user-store.ts        # 存用户
│  ├─ notifier.ts          # 发通知
│  └─ audit-logger.ts      # 记审计
├─ configs/
│  └─ register.jsonc       # 接线蓝图（配置）
└─ assemble.ts             # 拼装脚本（模拟引擎）
```

5 个块 = 5 个与业务无关的纯机制小零件。
1 份配置 = 声明这些零件按什么顺序接起来。
拼装脚本 = 读配置、按顺序调零件。

## 跑一下

```powershell
npm run assemble
```

输出类似：

```json
{
  "success": true,
  "notifyChannel": "email",
  "users": [{ "email": "test@example.com", "passwordHash": "..." }],
  "sent": [{ "channel": "email", "to": "test@example.com", "message": "欢迎注册！" }],
  "logs": [{ "timestamp": "2026-06-25T12:00:00Z", "action": "register", "detail": "test@example.com" }]
}
```

用户存了、邮件发了、审计记了——一条注册流跑通。

## 配置长什么样

打开 `src/configs/register.jsonc`：

```jsonc
{
  "flowName": "user-register",
  "steps": [
    { "block": "email-validator" },
    { "block": "password-hasher" },
    { "block": "user-store" },
    { "block": "notifier" },
    { "block": "audit-logger" }
  ],
  "params": {
    "notifyChannel": "email",
    "notifyMessage": "欢迎注册！"
  }
}
```

没有算法，没有 if/else，只有"引用"和"值"。引擎照着接、照着跑。

## 关键观察

- 块里没有一行代码提到"注册"——它们是纯机制，到处能用。
- 是**配置**决定了"这是一条注册流"——它把零件按注册的顺序接起来。
- 拼装脚本里也没有业务逻辑——它只是"读配置、按顺序调"。

→ 下一课验证核心卖点：[只改配置就改行为](04-change-config.md)
