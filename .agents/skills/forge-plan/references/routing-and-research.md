# Routing And Research

## Quick vs Deep Planning

### Use quick mode when

- the change is localized
- an established code pattern already exists
- no major architectural choice is involved
- no new integration or schema change is involved
- the user mostly needs scoping, not design exploration

### Use deep mode when

- the task creates a new capability or subsystem
- the task spans frontend plus backend plus persistence
- the task introduces or changes an external integration
- the task affects schema, jobs, caching, auth, payments, permissions, or security
- the task needs a genuine choice between multiple implementation patterns
- the cost of choosing the wrong approach is meaningful

If the mode is uncertain, do one fast code inspection first and choose the lightest mode that still protects a meaningful decision. Escalate to deep mode as soon as any deep trigger survives inspection.

## Research Triggers

Do external research when:

- framework guidance may have changed
- the task depends on a current vendor or library recommendation
- there are security, performance, or standards implications
- the user explicitly asks for best practice

## Source Rules

- prefer official framework, language, library, and vendor documentation
- use standards or RFCs when relevant
- avoid blog-level guidance as the main basis for a recommendation
- when evidence is incomplete, say so and label the recommendation as an inference

## Recommendation Heuristic

For every deep-mode task, answer these questions before recommending a path:

1. What is the simplest acceptable implementation?
2. What is the strongest fit with the current repo structure?
3. What is the current official guidance from the relevant primary sources?
4. What would be over-engineered here?
5. What future condition would justify upgrading to a more complex architecture?
