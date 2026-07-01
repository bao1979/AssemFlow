<!-- Derived from the Chinese tutorial, which remains the source of truth. -->

# Complexity Cannot Be Removed, Only Moved

> Goal of this lesson: understand why AFP tries to avoid repeating thirty years of disappointment around block-style reuse.
> For the full argument, see [Feasibility Analysis](../../装配流编程-可行性分析.md). This lesson only gives the core idea.

## A Meta-Law

> The essential complexity of a system cannot be destroyed by tooling and cannot be defined in advance by a central planner. It can only be moved to a cheaper place and allowed to evolve through use.

This lesson stands on three older ideas:

- **Brooks, "No Silver Bullet"**: some complexity is essential and cannot be eliminated by better tools.
- **Tesler's law of conservation of complexity**: complexity can be shifted, but not erased.
- **Hayek's knowledge problem**: the knowledge of what granularity is correct is distributed across users and only emerges through use.

## AFP Does Not Remove Difficulty. It Relocates It.

AFP does not reduce the essential complexity of a business. What it does is **move complexity from imperative code into declarative config.**

That trade is only worthwhile when config is the better container for that complexity:

- A good trade: structural or wiring complexity
- A bad trade: algorithmic logic or condition explosion

This is why AFP draws a hard line: **algorithms do not belong in config. They stay inside blocks.**

## Mechanism Reuses. Policy Does Not.

One short sentence explains a large part of software reuse history:

> **Mechanism can be reused. Policy usually cannot.**

- lodash can be reused almost anywhere because it is pure mechanism.
- "user registration" is expensive to maintain because it is policy. When the business changes, the whole thing changes.

AFP responds by pushing fast-changing strategy out of blocks and into adapters, where it stays local and cheap to replace. Blocks keep only the reusable mechanism.

> This is where the earlier conclusion comes from: **"user registration" is not a reusable part. It is a flow. The reusable part is the mechanism inside it.**

-> [Granularity Cannot Be Defined Top-Down](10-granularity.md)
