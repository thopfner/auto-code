# UI QA Rubric

## System fidelity

- Does the implementation reuse existing primitives and layout patterns?
- Are tokens used consistently?
- Did the change introduce a parallel visual language?

## UX clarity

- Is the primary action obvious?
- Are labels and helper text understandable?
- Are destructive or irreversible actions clearly signaled?

## State coverage

- Can the reviewer see how loading, empty, error, and success behave?
- Is validation feedback clear?
- Does long content break the layout?

## Responsive behavior

- Does the surface remain usable on narrow screens?
- Does density stay credible on larger screens?
- Are overflow and sticky behaviors intentional rather than accidental?

## Accessibility

- Are controls labeled?
- Is keyboard focus visible?
- Are contrast and semantics plausibly acceptable?
- Are there obvious hit-target or focus-order issues?

## Evidence

- Were screenshots or browser checks provided for visually meaningful changes?
- Do claimed manual QA steps actually prove the behavior?

## Hard-stop cases

Default to `REVISION_PACK_REQUIRED` when:

- a primary state is missing
- the primary action is unclear
- responsive behavior clearly regresses
- the change violates the repo’s established UI system
- the worker claims UI completion without adequate visual evidence
