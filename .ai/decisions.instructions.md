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

### Project-local capability routing is the agent tool authority

Reason: The host has far more skills, plugins, connectors, and MCP tools than any one task needs.
Repeatedly loading the full catalog wastes context and can make automatic compaction fail. Agents
must route through `.ai/capabilities.instructions.md`, load only the selected capabilities, and use
tracked checkpoints for long goals.

Constraints:

- Capability presence does not grant authority for external writes, spend, deployment, upload, or
  publish.
- One orchestration framework and one browser-control surface should own a task unless a plan proves
  otherwise.
- Large-thread forks are not the default continuation mechanism.

### Tracked operator prompts are runtime defaults

Reason: Provider stages and operator review must use one prompt authority. Ideas, scripts, and
production packages load their typed defaults from `.ai/prompts/`, and generated artifacts record
the exact source path and rendered prompt hash. Prompt edits affect future generation only and do
not mutate existing runs or imply approval.

### Public/scheduled publish is a separate future risk review

Reason: Publishing is irreversible and public. Upload config or generated metadata must not imply
publish authority. Public/scheduled publish needs its own approval, readiness, warning, evidence,
and QA matrix.

### Paid-generation quote approval and reservation are separate authorities

Reason: An operator must be able to review and approve an exact future production quote without that
approval silently becoming a reusable or concurrent payment capability. The JSON and operator-facing
Markdown form one quote bundle bound to the run, production package, enabled stage pricing, relevant
provider/budget config, and exact persisted bytes.

Constraints:

- Hard per-video, daily, and weekly budgets remain non-overridable.
- Readiness revalidates the current quote and exact approval digest.
- Approval does not call a provider or record incurred cost.
- One project-wide filesystem lock serializes reservation budget decisions across runs.
- A quote line remains consumed after release; retrying paid work requires a new quote and approval.
- Active, settlement-pending, and uncertain reservations remain in hard-budget totals.
- Settlement journals intent before recording the linked cost event so retries are idempotent.
- Paid execution remains unavailable until a provider adapter makes reservation the only pre-call
  path and proves its failure and timeout behavior end to end.

### Run identifiers are filesystem capabilities

Reason: CLI input and future Studio/worker requests use a run id to select durable local state.
Allowing separators, dot segments, absolute paths, or unbounded identifiers would turn that lookup
into authority outside the run root.

Constraints:

- One canonical validator owns the accepted format.
- Every run-root state, ledger, artifact, and cost path must pass through the validated `runDir`
  boundary.
- Persisted state must contain the same run id as its directory.
- Unrelated or malformed directories are ignored by run listing and never treated as runs.

### Artifact names are run-scoped filesystem capabilities

Reason: Artifact helpers are shared by CLI stages and future Studio/worker services. A caller-chosen
absolute path, separator variant, or dot segment must not escape or ambiguously address the run
root.

Constraints:

- Artifact paths use one bounded canonical forward-slash relative format.
- Every segment starts with an ASCII letter or digit and contains only ASCII letters, digits, dots,
  underscores, or hyphens.
- Windows reserved device basenames and trailing-dot aliases are rejected.
- Validation happens before filesystem and ledger mutation.
- Persisted artifact lists are revalidated when run state is loaded or saved.
- Lexical validation does not claim symlink containment; that remains a separate filesystem
  integrity control.

### Visual assets are committed production inputs

Reason: The channel brand pack is part of the production pipeline. Readiness should check for logo,
watermark, and lower-third/subtitle assets, and render work should consume assets from the tracked
`assets/` tree.

### CodeRabbit and formatting rules should focus on product risk

Reason: Automated review is useful when it reinforces the real risks: approval bypass, missing
evidence, hidden costs, route safety, default publish locks, and operator UX. Style-only suggestions
should stay secondary.
