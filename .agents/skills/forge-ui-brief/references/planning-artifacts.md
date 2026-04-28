# UI Planning Artifacts

For non-trivial UI work, add the relevant UI sections to the active execution pack.

## Recommended files or sections

- `04-ui-goals-and-user-journeys.md`
  - who the user is
  - what they are trying to do
  - primary and secondary actions
  - critical failure points

- `05-ui-system-and-reuse-plan.md`
  - exact existing components, layouts, and patterns to reuse
  - tokens or theme surfaces to extend
  - explicit no-drift rules

- `06-ui-states-and-breakpoints.md`
  - loading, empty, error, success, disabled states
  - mobile and desktop expectations
  - overflow and long-content handling

- `07-ui-evidence-requirements.md`
  - required screenshots
  - required routes or state setups
  - required Storybook stories or visual tests if available
  - manual QA notes

## Brief language

Prefer instructions like:

- reuse the existing page shell from `...`
- keep table density consistent with `...`
- use the same form row spacing and label treatment as `...`
- provide empty, loading, and error states
- capture screenshots at `<viewport>` after completing `<state>`

Avoid language like:

- make it nicer
- improve the UX
- modernize the layout
- redesign as needed

## QA checkpoints

If the UI batch spans multiple phases, create a `QA_CHECKPOINT` after any phase that changes:

- shared layout primitives
- navigation
- form framework or validation UX
- table structure
- core responsive behavior
- theme or token surfaces
