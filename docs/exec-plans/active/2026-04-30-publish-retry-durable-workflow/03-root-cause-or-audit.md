# Root Cause And Audit

## Findings

### 1. Target Was Behind Source

The latest handoff observed target commit `35e8261`, before source commit `d34150d` landed durable store selection and basic `/task retry`.

Impact: live behavior may still appear memory-based until the target pulls and restarts on `d34150d`.

### 2. Basic Retry Is Too Coarse

`ForgeWorkflowEngine.retryTask()` currently transitions `blocked -> queued` and reruns from scope.

Impact: a task blocked only by GitHub push auth will rerun agents unnecessarily, even though canonical QA artifacts already prove local QA passed.

### 3. QA Artifact Contract Can Identify Publish-Only Blockers

`automation/qa.json` now distinguishes:

- `qa_status: CLEAR_CURRENT_PHASE`
- `push_status: failed...`
- `human_input_required: true`

Impact: the controller has enough artifact truth to classify a publish retry if it also verifies repo state safety.

### 4. Health Checks Do Not Yet Prove Store Mode

`packages/ops/src/health.ts` checks runtime config and database URL shape, but does not prove the API/worker actually selected Postgres or can execute the workflow schema query.

Impact: `ops:health` can overstate durability.

### 5. OpenClaw Setup Test Drift

`tests/vps-setup-wizard.test.ts` expects missing CLI wording, but a real environment may have `openclaw` installed while the gateway is not discoverable. The intended fail-closed behavior is still correct, but the expected message may need to cover both missing CLI and not-running gateway cases.

Impact: `npm run verify` can fail for a stale assertion rather than a product regression.

