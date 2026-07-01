<!-- Derived from the Chinese tutorial, which remains the source of truth. -->

# Reuse: Assemble A Second Flow

> Goal of this lesson: reuse the same blocks in a second flow without changing their code.

## What Experiment 3 Does

Inside `experiments/exp03-wrap-reuse/`, the project wraps two lodash utilities as AFP blocks:

- `capitalize`
- `deep-get`

Then it builds **two very different flows** from the same pair of blocks:

- Flow A (`assemble-flow-a.ts`): read a user's name from a profile and capitalize it
- Flow B (`assemble-flow-b.ts`): read a product title from product data and capitalize it

Each flow is a separate piece of TypeScript code that calls the same blocks with different inputs. The block code itself stays unchanged.

**Honest note**: Experiment 3 currently proves **block reuse**, not full **config-driven reuse**. The second flow is not yet declared as a JSON config the way Experiment 1 is. The long-term direction is that a future engine should let you define the second flow by writing a new JSON config that points at the same blocks. That part is not finished yet.

## Run It

```powershell
cd experiments/exp03-wrap-reuse
npm install
npm test
```

You should see both Flow A and Flow B pass.

## The Key Observation

- `capitalize` does not know whether it is working on a user name or a product title. It only knows how to capitalize a string.
- The caller decides **which data** should be fed into that block.
- The same block is reused by two different flows without changing a line of block code.

That is the concrete meaning of "blocks are pure mechanisms and can be reused globally."

## The Cost Of Wrapping

How much work does it take to wrap a lodash function into a compliant AFP block?

- Thin shell code: about 1 to 2 lines
- Schema declaration: about 5 to 8 lines with TypeBox
- Total: roughly 15 lines per block

That is extremely cheap. A large ecosystem of pure functions becomes raw material for future blocks.

## Counterexample: Non-Pure Functions Do Not Wrap Cleanly

Experiment 3 also intentionally wraps `_.now`, which reads the system clock. Property tests catch it immediately: the same call can produce different results. It is non-deterministic, so it fails AFP's rules.

> AFP's engineering discipline blocks invalid blocks automatically through property tests. It does not rely only on manual review.

-> [See Determinism With Your Own Eyes](06-determinism.md)
