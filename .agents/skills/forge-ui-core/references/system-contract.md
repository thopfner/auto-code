# UI System Contract

Use this reference when a repo does not already define a stronger frontend system.

## Minimum durable system

Every serious product repo should eventually have:

- semantic color tokens
- spacing scale
- typography scale
- radius and elevation rules
- layout containers
- primitive component set
- interaction-state rules
- reference screens or stories

## Preferred token shape

Favor semantic names over raw values:

- `--color-bg-canvas`
- `--color-bg-surface`
- `--color-text-primary`
- `--color-text-secondary`
- `--color-border-subtle`
- `--color-accent`
- `--color-success`
- `--color-warning`
- `--color-danger`

Spacing should come from a finite scale, not arbitrary increments.

Typography should define:

- display or hero
- page title
- section title
- body
- secondary text
- label or caption

## Primitive set

Prefer a stable primitive layer for:

- page shell
- section wrapper
- card
- button
- input
- select
- textarea
- table
- tabs
- modal or drawer
- toast or inline alert
- empty state
- loading skeleton or progress state

## Operational rule

It is better to have a small system that repeats well than a large system with inconsistent exceptions.

## Design-system drift smells

- hardcoded one-off hex colors
- repeated custom wrappers around the same primitive
- multiple incompatible paddings on similar surfaces
- too many button styles
- tables and forms that do not share spacing and typography rules
- state handling that visually changes from one screen to another
