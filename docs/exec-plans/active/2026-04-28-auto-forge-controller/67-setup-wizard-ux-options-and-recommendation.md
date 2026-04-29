# Setup Wizard UX Options And Recommendation

Updated: `2026-04-29T06:57:08Z`

## Option A - Patch Terminal Prompts In Place

Make the current `promptTelegramChatId()` loop until discovery succeeds or the user enters a manual chat ID. Replace `codex login` with `codex login --device-auth` and remove `I UNDERSTAND`.

Pros:

- Smallest code change.
- Directly fixes the observed launch blockers.

Cons:

- If implemented without reusable helpers, it preserves terminal-only logic that the future chat setup flow will have to duplicate.

Verdict: acceptable only if the retry/auth logic is extracted enough to test and reuse.

## Option B - Extract Setup Interaction Helpers

Keep the CLI wizard but move the decision loops into small helpers that accept terminal callbacks or command runners. The CLI remains the first consumer, and later browser/chat setup can reuse the same retry/auth behavior.

Pros:

- Fixes today's launch blocker.
- Keeps behavior testable without brittle terminal scripting.
- Aligns with the future browser/chat setup workflow.
- Avoids overbuilding a new UI now.

Cons:

- Slightly more structure than a direct inline patch.

Verdict: recommended.

## Option C - Skip CLI OAuth And Force API Key

Remove OAuth from setup and require `OPENAI_API_KEY`.

Pros:

- Simplifies unattended launch.

Cons:

- User explicitly hit an OAuth setup flow, and the product already supports OAuth/manual login as an advanced path.
- Does not address future auth flexibility.

Verdict: rejected. Keep API-key default, but make OAuth mode smooth and correct.

## Recommendation

Implement Option B.

The next worker should fix the current CLI wizard while extracting just enough reusable setup logic to prevent the future chat workflow from inheriting terminal-specific friction.

Key requirements:

- Telegram discovery becomes an in-place retry/manual loop.
- Empty `getUpdates` is not fatal in interactive setup.
- Codex OAuth uses `codex login --device-auth`.
- No `I UNDERSTAND` prompt remains.
- Tests cover behavior without requiring live Telegram or real OAuth.
