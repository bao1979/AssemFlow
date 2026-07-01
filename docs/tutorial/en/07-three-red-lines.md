<!-- Derived from the Chinese tutorial, which remains the source of truth. -->

# Three Red Lines And Their Counterexamples

> Goal of this lesson: understand why AFP sets three hard rules, and what goes wrong when you break each one.

## Red Line One: Algorithms Do Not Go Into Config

Config is only allowed to express **structure, wiring, and declarative strategy**. Algorithms must stay inside blocks.

**What happens if you break this?** The moment you start writing calculations and nested logic in config, the config degenerates into a terrible programming language: poor typing, poor debugging, poor testing. That is the familiar "YAML hell" problem in another costume.

A practical rule of thumb:

- OK in config: "if membership level is VIP, route to A, otherwise route to B". This is simple enum-style routing.
- Not OK in config: "calculate a tier from 30-day spend, activity score, and risk score, then route based on that result". That is algorithmic logic.

## Red Line Two: AI Stops At Config, Runtime Stays Zero AI

AI is only allowed to produce reviewable artifacts at design time. After human review, the engine executes deterministically. Runtime contains no AI.

**What happens if you break this?** If you let AI generate business-flow code on the fly and run it directly, the project collapses back into vibe coding:

- it is not reproducible
- it is hard to audit
- it adds supply-chain risk because the model may hallucinate packages or unsafe dependencies

> This is the only wedge AFP really stands on. If you keep it, AFP remains distinct. If you break it, AFP is just another flavor of vibe coding.

## Red Line Three: Blocks Must Be Pure Mechanism

Blocks must be pure mechanisms. The same input must always produce the same output. They should not read clocks, depend on global state, create side effects, or hard-code business wording.

**What happens if you break this?**

- If a block hard-codes business copy or business rules, it stops being reusable.
- If a block depends on time, randomness, or global state, the result stops being deterministic and property tests should catch it.

Need time or randomness? Pass it in explicitly. Do not let the block reach outside and grab it secretly.

## One-Sentence Summary

These three red lines are really three views of the same rule: **keep uncertainty and fast-changing concerns outside the engine.** Algorithms stay in blocks, AI stays at design time, and business-specific variation stays in adapters.

-> [When Not To Use AFP](08-when-not.md)
