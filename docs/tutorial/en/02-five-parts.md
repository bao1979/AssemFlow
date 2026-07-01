<!-- Derived from the Chinese tutorial, which remains the source of truth. -->

# The Five Parts

> Goal of this lesson: build intuition with a river metaphor first, then remember the names of the five parts.

## Think Of A River

Imagine a business flow as a river.

- The **water** flowing through it is data.
- The **riverbed** that constrains the flow is reusable mechanism.
- The **weirs** that split or redirect the flow are business-specific adaptation.
- The **river map** tells the river where to go.
- The **whole river in motion** is the business flow when it is actually running.

Those are AFP's five parts.

## The Five Parts

| Part | River metaphor | In one sentence | Tiny example |
| :--- | :--- | :--- | :--- |
| Block | Riverbed | Pure mechanism, not tied to one business case | "check whether an email address is valid" |
| Adapter | Weir | Business-specific adaptation or field mapping | "this business calls the field `mail`, but the block expects `email`" |
| Config | River map | A declarative blueprint describing how blocks are wired | "validate email, then store user, then notify" |
| Data | Water | Concrete runtime or test data | `{mail: "a@b.com"}` |
| Flow | Whole river | The complete business flow assembled from the four parts above | "user registration" |

## What Reuses Cleanly, And What Does Not

This is the most important point in AFP, so hold onto it early:

- **Blocks can be reused globally.** They are pure mechanism. "Validate an email" means the same thing everywhere.
- **Adapters, config, and data do not reuse globally.** They are tied to one business case. Field names, rules, and data shape vary from one context to another.

That leads to a counterintuitive conclusion:

> **"User registration" is not a reusable part. It is a flow** assembled from blocks, adapters, config, and data.
> What actually reuses are the pure mechanism blocks inside it.

Part Four will explain why this split matters and why it keeps repeating in software history. For now, just keep the feel of it.

-> Want to try it? [Assemble Your First Flow](03-first-flow.md)
-> Want the theory? [Complexity Cannot Be Removed, Only Moved](09-complexity.md)
