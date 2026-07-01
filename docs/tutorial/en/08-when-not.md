<!-- Derived from the Chinese tutorial, which remains the source of truth. -->

# When Not To Use AFP

> Goal of this lesson: describe AFP's boundary honestly. A paradigm becomes more credible when it is willing to say where it fails.

## The Breaking Point Found By Experiment 2

Experiment 2 uses order-discount calculation as a boundary test in `experiments/exp02-boundary/`. The conclusion is simple:

**AFP fails when the business problem is condition-dense and those conditions change frequently.**

What exactly breaks? The discount conditions are functions, such as "amount >= 200". Functions do not fit naturally into JSON config. But the business still wants to change those conditions often without changing code. AFP's promise of "change behavior by changing config" no longer holds there.

## The Boundary Line

| Inside the line: AFP fits | Outside the line: do not force AFP |
| :--- | :--- |
| Linear steps or enum-style routing | Pipeline structure depends on runtime data |
| Strategy changes mean switching enum values or tuning parameters | Strategy changes mean rewriting logic or algorithms |
| Blocks are reusable and business-agnostic | Dense business rules change frequently |
| A small set of rules with enumerable combinations | Rule combinations explode |

## What To Do When You Hit The Boundary

AFP discipline rule 6 says: **do not force AFP into the stubborn 10 percent.** There are three honest responses:

1. **Fall back to ordinary development.** Admit that this part is not an AFP job.
2. **Wrap the complexity inside a rule-engine block.** Complexity does not disappear, but it is contained in one tested block instead of leaking everywhere.
3. **Extract a new reusable block over time.** If the same kind of complexity keeps returning, standardize it as a reusable mechanism.

## One Sentence

> AFP is not a silver bullet. It is designed for the ninety percent where structure is stable and variation is enumerable. The remaining ten percent should be admitted, isolated, and prevented from polluting the sweet spot.

-> Back to the [Learning Map](README.md)
