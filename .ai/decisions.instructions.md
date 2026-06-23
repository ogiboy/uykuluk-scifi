# Decisions

## Decision Log

### Product is channel-specific production software, not a generic AI video platform

Reason: The strongest product advantage is the UykulukSciFi context: Turkish cinematic sci-fi
narration, scientific caution, channel assets, approval gates, evidence, and local cost control.
Competing with broad AI video editors would pull the project toward generic features before the
channel can reliably ship videos.

Constraints:

- Optimize for repeatable UykulukSciFi draft production first.
- Do not add generic SaaS, hosted workspace, marketplace, or one-prompt public publishing features
  merely because they are common in video tools.
- Keep public upload/publish manual or separately gated until the exact CLI/core controls exist.

### Render Plan + Contact Sheet MVP is the first real production-loop slice

Reason: The safe core can already produce reviewable packages. The next useful product step is to
make the first real video format explicit before adding TTS or FFmpeg execution.

Constraints:

- Implemented artifacts are `production/render_plan.json`, `production/storyboard_contact_sheet.md`,
  and `production/asset_provenance.json`.
- The slice consumes approved production-package and asset contracts; it does not implement FFmpeg
  render, upload, public publish, or paid providers.
- Artifact presence does not imply render approval.

### Local TTS starts as disabled-by-default voiceover artifact generation

Reason: The product needs reviewable local audio before FFmpeg render, but voice generation must not
become an implicit render, upload, publish, or paid-provider path.

Constraints:

- `producer voice` requires explicit local TTS config, `READY_FOR_MANUAL_PRODUCTION`, script
  approval, production-package integrity, and valid render-plan evidence.
- `deterministic-local` is a reference adapter for timing and pipeline tests, not production voice
  quality.
- `local-piper` may call a configured local Piper binary and model path, but voice models and
  generated audio are local/ignored artifacts, not committed repository state.
- Voiceover artifact presence does not imply render approval.

### Manual analytics feedback precedes YouTube Analytics API

Reason: The product needs a learning loop, but API credentials, privacy, quota, and external-state
handling are unnecessary before the channel has a stable production cadence.

Constraints:

- Start with operator-provided CSV/JSON imports.
- Record source, time range, definitions, and missingness.
- Do not invent metrics or claim causality from weak data.

### Paid or generative media providers are deferred until local production works

Reason: Paid image/video/TTS APIs add cost, credential, policy, consistency, and evidence risk. The
first useful draft format can be produced with local prompts, local assets, local TTS, and FFmpeg.

Constraints:

- No paid adapter, SDK, credential, or operator command is enabled without a separate design review.
- Future paid providers must use the approved reservation/execution boundary.
- Deterministic local render should be useful before paid/generative video providers are considered.

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

### `.ai/` is development guidance, not runtime state

Reason: This project is safety-sensitive even though it produces media rather than trades. Runbooks,
workflows, QA checklists, checkpoints, findings, and role guidance should be reviewable development
artifacts so future agent work does not silently weaken approval gates or evidence quality. Runtime
code must not require `.ai/` files to execute.

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

### Product prompt defaults are runtime assets outside `.ai`

Reason: Provider stages and operator review must use one prompt authority without depending on the
agent-tracking area. Ideas, scripts, and production packages load their typed defaults from
`prompts/defaults/`, and generated artifacts record the exact source path and rendered prompt hash.
Prompt edits affect future generation only and do not mutate existing runs or imply approval.

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

### Reserved provider execution is a separate internal authority

Reason: A reservation proves budget commitment but does not prove whether an external callback was
invoked. Future nonzero provider adapters need one composed boundary that durably claims execution
before callback entry and classifies every observed outcome without treating an error as proof that
no request was sent.

Constraints:

- Adapter provider/model identity must match the exact approved quote before reservation.
- Only `RESERVED -> EXECUTION_STARTED` grants one local callback invocation.
- Same-operation retries never redispatch after execution starts or reaches a terminal state.
- Definitely-not-sent outcomes release; unknown, malformed, thrown, or timed-out outcomes remain
  uncertain; confirmed success settles exact integer USD micros.
- Provider request ids are bounded at the callback boundary and only their SHA-256 hashes persist;
  neither form is proof of charge.
- The contract does not enable a paid adapter, CLI command, credential, TTS, render, upload, or
  publish path.

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
- Existing `runs/`, run-directory, intermediate-directory, and final-file symbolic links are
  rejected by the canonical run-path owner before access.
- Existing final regular files with multiple hard links are rejected before reads or append sinks.
- Missing path suffixes remain valid for creation. Portable Node APIs do not provide a directory
  handle-based `openat` workflow, so hostile concurrent path replacement remains a local TOCTOU
  limitation rather than a claimed guarantee.

### Visual assets are committed production inputs

Reason: The channel brand pack is part of the production pipeline. Readiness should check for logo,
watermark, and lower-third/subtitle assets, and render work should consume assets from the tracked
`assets/` tree.

### CodeRabbit and formatting rules should focus on product risk

Reason: Automated review is useful when it reinforces the real risks: approval bypass, missing
evidence, hidden costs, route safety, default publish locks, and operator UX. Style-only suggestions
should stay secondary.
