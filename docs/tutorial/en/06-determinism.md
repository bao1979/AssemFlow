<!-- Derived from the Chinese tutorial, which remains the source of truth. -->

# See Determinism With Your Own Eyes

> Goal of this lesson: verify that the same config plus the same input always gives the same result, and understand why zero AI at runtime matters.

## Run It Twice And Compare

```powershell
cd experiments/exp01-sweet-spot
npm run assemble > result1.json
npm run assemble > result2.json
```

Compare the two files. They should be identical.

That is not luck. It happens because:

- the blocks are pure functions, and property tests check that claim
- the assembly script only reads config and invokes steps in order; there is no randomness, no clock, and no AI inside it
- values like salts and timestamps are passed in explicitly instead of being read from global system state

## Why Determinism Deserves Its Own Lesson

| Non-deterministic systems | Deterministic systems |
| :--- | :--- |
| Bugs are hard to reproduce | The same input reproduces the same bug |
| Tests become flaky | Tests stay stable |
| Auditing is difficult | Auditing is possible because the same config leads to the same result |
| Rollback is risky | Rollback is reliable because old config means old behavior |

AFP's determinism comes from three layers:

1. blocks are pure functions
2. the engine refuses to introduce randomness, clock reads, or runtime AI
3. wherever randomness or time is needed, it is passed in explicitly at the system boundary

## The Determinism Assertion In Smoke Tests

Each experiment includes a smoke-test assertion that reruns the same flow and expects the same output. If a future change secretly introduces non-determinism, that test turns red immediately.

-> [Three Red Lines And Their Counterexamples](07-three-red-lines.md)
