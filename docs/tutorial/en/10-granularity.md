<!-- Derived from the Chinese tutorial, which remains the source of truth. -->

# Granularity Cannot Be Defined Top-Down

> Goal of this lesson: understand why AFP does not try to define the perfect block size in advance, and instead tries to make wrong cuts cheap to fix.
> For the full argument, see [Feasibility Analysis](../../装配流编程-可行性分析.md). This lesson only covers the core idea.

## Do Not Try To Solve Granularity Once And For All

How large should a block be? Where should you split it?

Hayek's knowledge problem suggests that trying to define the correct granularity top-down is already the wrong move. That is central planning. npm package granularity was not decided by one mind. It emerged from repeated use, friction, duplication, and convergence across many users.

So AFP changes the objective function:

> Do not optimize for "cut it perfectly the first time." Optimize for "if we cut it wrong, it is cheap to correct later." In other words: optimize evolvability, not early certainty.

## How To Make Wrong Cuts Cheap To Fix

- **Standardize the joints, not the size of parts.** Freeze contracts such as input/output schema, versions, and adapter protocols, but leave granularity flexible.
- **Make refactoring safe.** Strong schema contracts plus tests catch damage when a block is split or merged.
- **Prefer smaller cuts when in doubt.** Composition is reversible; decomposition is destructive.

## Evolution Does Not Stop At Perfect. It Stops At Locked-In.

lodash granularity stopped changing not because it became perfect, but because change became too expensive. AFP blocks can lock in the same way once many flows depend on them.

The intended response is:

- before v1.0, allow aggressive refactoring
- after v1.0, use semantic versioning and allow multiple versions to coexist
- because blocks have explicit contracts, the engine may eventually be able to assist with migration

> Honest warning: this evolution story is still a **hypothesis**, not a proven result. Reliable evolution is one of AFP's least certain areas. Semantic changes may resist migration, multi-version coexistence may fragment the ecosystem, and feature interaction after composition is still an open problem.

## One More AFP-Specific Twist

npm granularity was optimized for human assemblers. Humans dislike searching through and wiring together too many tiny pieces, so package size tends to converge at a scale that saves human effort.

AFP changes that pressure because much of the searching and wiring is expected to be done by an LLM.

> So AFP's best granularity may end up **smaller than npm's**. That is an open question earlier generations did not really have a reason to ask.

-> Back to the [Learning Map](README.md)
