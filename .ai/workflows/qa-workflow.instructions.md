# QA Workflow

Use for validation planning, usage tests, smoke runs, and future browser QA.

## Test Tiers

| Tier        | Use When                 | Examples                               |
| ----------- | ------------------------ | -------------------------------------- |
| Focused     | One contract changed     | Vitest for one guard/stage             |
| Static      | Source/tooling changed   | `pnpm lint`, `pnpm typecheck`          |
| Unit        | Behavior changed         | `pnpm test`                            |
| Usage Smoke | Operator flow changed    | `pnpm qa:usage`                        |
| Browser     | Future dashboard changed | Playwright screenshots and route tests |

## Evidence Rules

- Prefer reproducible commands.
- Save QA summaries under `.ai/qa/artifacts/`.
- Record skipped checks and why.
- Do not mark a scenario passed unless observed.
- Redact secrets from logs and artifacts.

## Durable Scenarios

- Full safe mock pipeline.
- Script blocked before idea approval.
- Package blocked before script approval.
- Voice/render/upload/publish blocked by default.
- Readiness state agrees with evidence.
- Brand asset readiness.
- Future dashboard read-only pages match core state.
