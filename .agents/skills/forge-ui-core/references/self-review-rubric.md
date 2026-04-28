# UI Self-Review Rubric

Run this pass before returning UI work.

## Layout

- Is the primary action obvious?
- Does the page have one clear shell and hierarchy?
- Do similar sections use similar spacing and alignment?
- Does the composition still make sense on narrow screens?

## System fidelity

- Did the implementation reuse existing primitives?
- Are semantic tokens used instead of raw values where the repo supports them?
- Did you avoid introducing a second visual language?

## State coverage

- Are loading, empty, error, and success states handled where relevant?
- Does disabled behavior look intentional?
- Does long content wrap or truncate predictably?

## Interaction

- Are controls labeled?
- Is focus visible?
- Are hover, pressed, selected, and disabled states coherent?
- Are destructive actions clearly distinguished?

## Accessibility

- Are semantics reasonable for the control type?
- Is color contrast likely acceptable?
- Can the main path be completed with a keyboard?
- Are status messages and validation errors understandable?

## Visual quality

- Does the screen feel precise rather than generic?
- Is density appropriate to the product surface?
- Is there any decorative noise that does not support comprehension?

## Evidence

- If the change is visually meaningful, did you verify it in a browser?
- If regression risk exists, did you capture screenshots or visual evidence?
