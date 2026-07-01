<!-- Derived from the Chinese tutorial, which remains the source of truth. -->

# Change Behavior By Changing Config Only

> Goal of this lesson: see with your own eyes that changing one config value can change behavior without touching code.

## Run A Small Experiment

Open `src/configs/register.jsonc` and change `notifyChannel` from `"email"` to `"sms"`:

```jsonc
"notifyChannel": "sms",
```

Then run the flow again:

```powershell
npm run assemble
```

Look at the `sent` field in the output:

```json
"sent": [{ "channel": "sms", "to": "test@example.com", "message": "Welcome!" }]
```

The notification now goes through SMS. **You did not touch block code, and you did not touch the assembly script.**

## Why This Matters

- In a traditional setup, changing the notification channel usually means changing code, updating tests, and shipping again.
- In AFP, changing the notification channel means changing one config value, assembling again, and getting a different behavior.

This is the core promise of AFP's sweet spot: **reduce the cost of "change behavior" from "change code" to "change config."**

## But There Is A Condition

This works because the channel choice is an **enum**: `email` or `sms`. Enum-style routing can stay in config.

If what you want to change is the discount algorithm itself, then you are no longer switching among a finite set of options. You are changing logic, which belongs in code. Lesson 08 explains that boundary.

## Verify It With A Smoke Test

If you do not want to test it manually, run the tests. One of the smoke tests checks exactly this claim:

```powershell
npm test
```

Look for the test that confirms changing config from `email` to `sms` changes behavior without changing block code.

-> [Reuse: Assemble A Second Flow](05-reuse.md)
