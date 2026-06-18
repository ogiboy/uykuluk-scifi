# Decisions

## Decision Log

### CLI/core remains the workflow source of truth

Reason: The first reliable surface is the strict state machine, ledger, artifact, and approval
model. A future web dashboard should make these contracts easier to operate, not become a second
runtime.

### Next.js is the preferred future dashboard stack

Reason: The operator workflow will be easier through a local browser UI with run lists, artifact
previews, approval dialogs, readiness panels, and evidence browsing. Next.js App Router is a good
fit once the core contracts are stable.

Constraints:

- The dashboard stays local-first.
- The dashboard calls typed local contracts.
- No public upload or publish path appears in the dashboard until the CLI has the same gate.
- UI work must include browser QA and route negative tests.

### `.ai/` is a product operating contract, not decoration

Reason: This project is safety-sensitive even though it produces media rather than trades. Prompts,
runbooks, workflows, QA checklists, and role guidance should be reviewable project artifacts so
future agent work does not silently weaken approval gates or evidence quality.

### Tracked operator prompts are runtime defaults

Reason: Provider stages and operator review must use one prompt authority. Ideas, scripts, and
production packages load their typed defaults from `.ai/prompts/`, and generated artifacts record
the exact source path and rendered prompt hash. Prompt edits affect future generation only and do
not mutate existing runs or imply approval.

### Public/scheduled publish is a separate future risk review

Reason: Publishing is irreversible and public. Upload config or generated metadata must not imply
publish authority. Public/scheduled publish needs its own approval, readiness, warning, evidence,
and QA matrix.

### Visual assets are committed production inputs

Reason: The channel brand pack is part of the production pipeline. Readiness should check for logo,
watermark, and lower-third/subtitle assets, and render work should consume assets from the tracked
`assets/` tree.

### CodeRabbit and formatting rules should focus on product risk

Reason: Automated review is useful when it reinforces the real risks: approval bypass, missing
evidence, hidden costs, route safety, default publish locks, and operator UX. Style-only suggestions
should stay secondary.
