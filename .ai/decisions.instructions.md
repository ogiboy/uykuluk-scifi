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

### FFmpeg draft render is a local review artifact behind exact approval

Reason: The channel needs reviewable local video drafts, but render execution must not imply upload
or publish authority and must not run from stale visual/audio inputs.

Constraints:

- `producer approve render` records approval for the exact current render-plan and voiceover audio
  digests.
- `producer render` requires `RENDER_APPROVED`, production-package integrity, valid render-plan
  evidence, valid voiceover evidence, and the matching render approval digest.
- The first implementation may be visually simple, but it must write local render evidence and must
  not call upload, schedule, public publish, paid providers, or external media services.

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

### Draft timing follows the actual voiceover, not estimated package timing

Reason: Real Piper/FFmpeg validation showed that treating voiceover duration as total video duration
cuts bookends and that package SRT estimates can drift from generated audio. A technically decodable
MP4 is not sufficient operator proof when audio, subtitles, and visuals use different clocks.

Constraints:

- The complete draft duration is intro + voiceover-backed scene window + outro unless an explicit
  short-review cap applies.
- Voiceover and subtitles begin after intro and end before outro.
- V1 linearly maps source SRT duration onto actual local-audio duration because Piper provides no
  word timestamps; the scale is persisted and still requires operator listening/watching.
- Lower-third, waveform, and popup-card overlays are scene-scoped; bookends remain clean except for
  the watermark.
- Manifest and `ffprobe` durations must agree within a bounded tolerance.

### Non-accepted renders are archived before reapproval

Reason: A strict forward-only state machine left operators with no safe recovery after a real draft
failed visual review. Manual `state.json` editing or silent overwrite would destroy evidence and
weaken approval meaning.

Constraints:

- `needs-revision` or `rejected` decisions allow `producer revise render` to archive the canonical
  draft, manifest, decision, evidence, and readiness under a versioned revision path.
- The previous render approval is invalidated and the run returns to `READY_FOR_MANUAL_PRODUCTION`;
  a fresh explicit approval is always required.
- Contract-upgrade recovery without a readable decision requires explicit reason/reviewer
  attribution and must still verify the persisted MP4 digest and active approval binding.
- Accepted drafts cannot use the revision path.

### Local model runtime is separate from model quality

Reason: Ollama/Qwen testing proved the safety guards work, but also showed inconsistent Turkish
draft quality, repeated ideas, malformed labels, and weak long-form scripts. More Qwen prompt tuning
should not be the only path forward.

Constraints:

- Keep mock mode as the default test path.
- Keep Ollama available for regression coverage and local experiments.
- Support local OpenAI-compatible `llama.cpp` servers so GGUF candidates can be evaluated without
  hosted credentials.
- Do not treat any local model as production-ready until it passes a controlled UykulukSciFi idea
  and script evaluation against the existing blockers and operator quality expectations.
- Keep Ollama and `llama.cpp` base URLs on credential-free loopback origins. LAN/hosted endpoints
  belong to a future explicit provider adapter and security review.

### Managed llama.cpp lifecycle reads ignored operator config

Reason: Repeated manual `llama-server` commands caused model alias, port, and context drift between
doctor, provider calls, and real runs.

Constraints:

- `pnpm model:start` reads ignored `producer.config.json`, validates the GGUF, serves the configured
  alias on the configured loopback endpoint, and uses one parallel slot by default.
- `pnpm model:stop` stops only the PID created by the managed helper.
- Downloaded models, PID files, and provider config remain ignored local state.
- Server lifecycle helpers never download models, change config, call hosted APIs, or weaken model
  mismatch checks.

### CLI/core remains the workflow source of truth

Reason: The first reliable surface is the strict state machine, ledger, artifact, and approval
model. A future web dashboard should make these contracts easier to operate, not become a second
runtime.

### Next.js is the operator Studio stack

Reason: The operator workflow is easier through a local browser UI with run lists, artifact
previews, approval dialogs, readiness panels, and evidence browsing. Next.js App Router now hosts
that surface while CLI/core remains authoritative.

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

### Studio observability is optional and never workflow authority

Reason: Runtime error capture helps diagnose the primary web control surface, but telemetry must not
become an approval, readiness, evidence, route-security, or availability dependency.

Constraints:

- Sentry stays disabled when no DSN is configured; local Studio operation remains complete.
- Capture only unexpected Next.js and guarded-route boundary failures. Do not attach request bodies,
  artifact contents, prompt text, provider output, credentials, or approval evidence.
- Source-map upload credentials are build-time secrets outside Git.
- Telemetry failure must never retry a mutation, alter producer state, or weaken CLI/core guards.

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

### TypeScript 7 compilation and TypeScript 6 tooling compatibility remain separate

Reason: The native TypeScript 7 compiler materially improves typecheck performance, while the
current parser ecosystem still depends on the TypeScript 6 JavaScript API and fails at runtime when
forced onto TypeScript 7.

Constraints:

- Root and Studio `tsc` commands use the official native TypeScript 7 package.
- The `typescript` package name resolves to the official TypeScript 6 compatibility package for
  ESLint, Prettier plugins, Next.js tooling, and other JavaScript API consumers.
- Keep `tsc6` compatibility checks and the compiler-major QA gate until parser tooling officially
  supports the TypeScript 7 API; peer-warning suppression is not a substitute for runtime support.
- Studio typechecks refresh generated route types and remove stale development validators before
  compiling; generated `.next` files are never patched as source.
