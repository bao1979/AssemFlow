<!-- Derived from the Chinese tutorial, which remains the source of truth. -->

# Assemble Your First Flow

> Goal of this lesson: run Experiment 1 by hand and see how five blocks plus one config are connected into a registration flow.

## Before You Start

```powershell
cd experiments/exp01-sweet-spot
npm install
```

## What Is In There

```text
src/
|- blocks/
|  |- email-validator.ts   # validates email format
|  |- password-hasher.ts   # hashes passwords
|  |- user-store.ts        # stores users
|  |- notifier.ts          # sends notifications
|  \- audit-logger.ts      # writes audit logs
|- configs/
|  \- register.jsonc       # the wiring blueprint
\- assemble.ts             # the assembly script that simulates the engine
```

Five blocks means five small business-agnostic mechanisms.
One config means one declarative blueprint that says how they connect.
The assembly script reads the config and invokes them in order.

## Run It

```powershell
npm run assemble
```

The output looks roughly like this:

```json
{
  "success": true,
  "notifyChannel": "email",
  "users": [{ "email": "test@example.com", "passwordHash": "..." }],
  "sent": [{ "channel": "email", "to": "test@example.com", "message": "Welcome!" }],
  "logs": [{ "timestamp": "2026-06-25T12:00:00Z", "action": "register", "detail": "test@example.com" }]
}
```

The user is stored, the notification is sent, and the audit record is written. A complete registration flow just ran.

## What The Config Looks Like

Open `src/configs/register.jsonc`:

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
    "notifyMessage": "Welcome!"
  }
}
```

There is no algorithm here and no loop. There are only references and values. The engine reads the blueprint and follows it. Simple enum-style routing can also remain in config; Lesson 08 explains that boundary.

## The Key Observation

- No block contains business wording like "registration". They are pure mechanisms and can be reused elsewhere.
- The **config** is what makes this specific flow a registration flow. It fixes the order of steps and the parameter values.
- The assembly script walks the `steps` array, but it still contains **registration-specific mapping glue**. For example, it knows which field in the context should be fed into the email validator. Later the engine's generic `inputMap` mechanism is meant to take over this role. For now, the script is handwritten for teaching, not a fully general engine.

-> Next: [Change Behavior By Changing Config Only](04-change-config.md)
