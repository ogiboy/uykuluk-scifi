# UykulukSciFi Producer Roadmap

This roadmap keeps the product local-first and approval-gated while shifting the next delivery focus
from safety infrastructure to a real UykulukSciFi production loop.

## Product Direction

UykulukSciFi Producer is a channel-specific production desk, not a generic AI video platform or an
autonomous publishing machine. The product should help the channel regularly produce original,
scientifically careful, visually consistent YouTube draft packages.

The CLI/core state machine remains the source of truth for state, approvals, costs, evidence, and
disabled upload/publish controls. The Studio should make those contracts easier to review and
operate, not replace or weaken them.

Durable strategy:

- produce reliable local draft packages before adding broad integrations;
- prefer deterministic local assets, TTS, and FFmpeg before paid/generative video providers;
- learn from published performance through manual imports before YouTube Analytics API work;
- keep public/scheduled publish out of scope until a separate risk review.

## Current Milestone - Production Quality & Controlled Distribution

Status: active.

The deterministic production foundation is no longer only scaffold. A real local `llama.cpp`/Gemma 3
12B -> reviewed script -> production package -> Piper voice -> FFmpeg render -> operator decision ->
manual channel handoff run has completed without upload or publish. That run also proved the
revision loop by rejecting and archiving faulty drafts before fresh approval.

The next product question is operational, not architectural: can the same documented workflow
produce two publish-quality channel episodes without source edits, hidden state repair, or manual
assembly? Work in this milestone should prioritize:

- ElevenLabs voice catalog/previews, durable voice selection, exact cost approval, production
  synthesis, timing evidence, aligned subtitles, reconciliation, and redacted diagnostics while
  preserving deterministic-local and Piper fallbacks;
- 12-24 scene-specific still images behind one small provider boundary, static/manual fallback,
  contact-sheet review, per-scene regeneration, provenance, budget enforcement, and deterministic
  motion presets before short clips;
- exact render approval binding for selected voice, aligned subtitles, visual manifest, render plan,
  and approved media digests, followed by pacing/audio/subtitle/thumbnail polish;
- resumable private-only YouTube upload bound to the intended channel and exact metadata, thumbnail,
  caption, and media digests, with processing review; public and scheduled publishing remain
  unavailable;
- a concise minimum-publishable-episode scorecard, operator-curated source/claim provenance, and two
  repeatable real-episode runs;
- guarded Studio parity, persistent settings/prompt profiles, and one-command local onboarding so
  ordinary operation does not require source edits or hidden repair.

Do not add provider sprawl, queues, public publishing, or generic agent infrastructure. Add only the
approved ElevenLabs path, one hosted still-image provider after a bounded bake-off, and private
YouTube upload through the existing approval/evidence architecture.

Current voice checkpoint:

- Implemented in `v0.81.0`: ElevenLabs v3 catalog, bounded preview, attributable selection and
  reselection, exact quote/reservation, live preflight contracts, production synthesis adapter,
  provider-credit settlement, redacted evidence, and digest-anchored pending/settled recovery. Paid
  execution remains mock-backed in automated validation; recovery does not require a current API
  key, live metadata refresh, or a fresh catalog.
- Implemented on main after PR #149: publish-readable Turkish aligned SRT and metadata, exact
  voice/render/FFmpeg/caption binding, plus guarded Studio candidate, preview, selection,
  reselection, and exact hosted-execution confirmation. Required CI, Sonar, CodeQL, product/browser
  QA, and real Studio browser UAT passed before merge.
- Live production validation pending: no paid production synthesis has run. Free-tier access may be
  used only for provider-permitted metadata/catalog/preview smoke and does not establish production
  rights. Exact commercial eligibility, quote, persisted approval, and reservation remain mandatory.
- Offline fallback remains part of v1: deterministic-local keeps reference timing, Piper remains the
  production-capable local voice path, and both use an explicit linear subtitle timing mode rather
  than pretending to have provider alignment.

Current visual checkpoint:

- Implemented in `v0.83.0`: a minimal `VisualProvider` boundary with deterministic static and manual
  PNG/JPEG paths, duration-preserving 12–24 visual beats, revision history, contact-sheet review,
  rejected-only regeneration, and deterministic motion presets.
- Studio supports prepare, digest/revision-bound media review, batch approve/reject, manual import,
  and rejected-scene regeneration without normal CLI use. Stale browser snapshots cannot mutate a
  newer manifest.
- Render-plan v2, render approval v3, and draft manifest v10 bind the approved visual manifest;
  legacy evidence remains readable but cannot be newly approved or rendered without the binding.
- Targeted for `v0.84.0`: one FLUX.2 Pro adapter with exact scene-plan quote/approval/reservation,
  bounded asynchronous execution, provider-credit settlement, durable local image spools, Studio
  confirmation, and rejected-only re-quote/regeneration. Mocked request/poll/recovery and combined
  ElevenLabs-plus-visual workflow validation are implemented; live BFL production proof remains
  pending explicit approval and credentials.

After this hosted visual candidate closes, delivery order is: exact render/media polish; script
audition and editorial provenance; resumable private-only upload; then persistent settings, prompt
profiles, onboarding, documentation productization, and real-episode acceptance.

## Phase A - Safe Core Stabilization

Status: mostly implemented; maintain and simplify.

The current CLI/core already covers the safe production foundation:

- mock/Ollama/llama.cpp idea, script, review, package, estimate, evidence, and readiness stages;
- explicit idea, script, and cost approvals;
- content-addressed script review/approval and attributable script revisions;
- provider budget preflight, cost quote approval, reservation/settlement foundations, and hard
  budget accounting;
- provider failure diagnostics, local-model receipts, prompt provenance, production-package
  integrity, and durable evidence;
- lightweight local model evaluation reports for configured mock/Ollama/llama.cpp providers without
  persisting raw provider output;
- disabled-by-default local TTS, approval-gated local draft render, and disabled upload and
  public/scheduled publish scaffolds;
- CI, CodeQL, Sonar, formatting, modularity, secret scan, usage smoke, and release hygiene gates.

Ongoing work in this phase should improve operator clarity instead of adding more unused
infrastructure:

- make `status`, evidence, readiness, and docs answer the next safe action clearly;
- keep `.ai/` aligned with the source tree without becoming runtime state;
- keep provider failures, approval blockers, and cost blockers visible in durable artifacts;
- evaluate local LLM runtime/model quality through controlled comparisons before more Qwen-specific
  tuning;
- keep bounded long-form continuation evidence aligned with script receipts and prompt provenance;
- keep paid-provider internals isolated behind reservation/execution contracts; ElevenLabs is the
  single approved production TTS adapter and all other hosted media providers remain deferred until
  their explicit roadmap slice and bake-off.
- add one idempotent local bootstrap command that verifies Node/pnpm, installs the lockfile, builds,
  initializes config/assets, runs doctor, and starts Studio with honest sequential progress; Docker
  and hidden/global package installation remain out of scope.

## Phase B - Real Production Loop

Status: implemented foundation; active real-episode validation and polish.

Goal: turn an approved script/package into a complete local video draft package that can be reviewed
without upload or public publish.

First completed concrete slice: **Render Plan + Contact Sheet MVP**.

Status: implemented for deterministic CLI artifact generation; keep hardening evidence/readiness and
operator review wording as later polish.

Implemented artifacts:

- `production/render_plan.json` - deterministic mapping from approved production package, scenes,
  subtitles, popup cards, and existing visual assets to an FFmpeg-ready draft plan;
- `production/storyboard_contact_sheet.md` - operator-readable scene/contact-sheet preview for
  reviewing visual rhythm before render;
- `production/asset_provenance.json` - exact asset paths, roles, and provenance used by the render
  plan.

Constraints:

- render planning consumes existing production-package and asset contracts;
- render planning does not create a second workflow engine;
- no upload, paid provider, or public publish is introduced in this slice;
- evidence/readiness should surface render-plan presence and blockers only after the artifact
  contract exists.

Remaining Real Production Loop work:

- harden local TTS with continued Piper voice QA and better operator guidance; current foundation
  writes deterministic reference WAV metadata and an operator audio review checklist, can call a
  configured local Piper binary/model path, records model/config digest provenance, and surfaces
  Piper setup/remediation next actions through `producer doctor`;
- harden FFmpeg draft render quality and visual composition. Current foundation renders local review
  MP4 from the current render plan, intro/outro source cards or committed source-frame sequences,
  scene-timed background plates, voiceover audio, subtitles, lower-third, popup, waveform, and
  watermark overlays, then writes a render manifest with the exact timeline, source-frame cadence,
  an operator-readable draft review checklist, and a manifest-bound YouTube chapter draft. Local
  final review bundle generation now ties the script, package, render plan, voiceover, draft render,
  evidence, readiness, and any recorded render decision into one operator handoff index without
  approving upload or publish. A manual channel handoff package can then bind the accepted final
  review, draft MP4, subtitles, YouTube metadata draft, chapter draft, and tracked thumbnail
  candidates into a local checklist without calling YouTube APIs or approving upload/publish.
  Current manifest v8 keeps bookends outside the voiceover/subtitle window, records linear
  source-SRT-to-Piper timing, scopes overlays to scene windows, validates total duration with
  `ffprobe`, and supports durable rejected-draft archival plus fresh exact render approval;
  `producer doctor` also warns when local FFmpeg/ffprobe tools are unavailable before operators
  reach render execution;
- repeat the complete production loop on additional real episodes and fix only reproducible operator
  or media-quality blockers. A run is not validated merely because mock UAT passes;
- keep the implemented guarded Studio route for normal rejected-draft revision aligned with
  CLI/core; add attributed invalid-evidence recovery and stronger final handoff review UX only
  through the same route-security contracts;
- improve the tracked visual pack so 8-12 minute drafts use more than a small rotating background
  set, and replace sample/template overlay text with editable production sources where practical;
- define separate private-upload approval only after local final review is reliable.

## Phase C - Operator Studio

Status: run review, artifact preview, asset inventory, home-page latest-run readiness, home-page
manual analytics feedback summary, home-page and `/doctor` producer doctor diagnostics, runtime
prompt inventory, mutation-service status, manual analytics overview, route-security contract
foundations, shared mutation service contract foundations, guarded local approval routes, guarded
idea-run and workflow-stage/review routes, the local mutation session route, and the guarded local
render-decision and channel-handoff decision routes exist. Upload and publish route implementations
remain deferred. Optional privacy-minimal Sentry capture now covers unexpected Next.js and guarded
mutation-boundary failures without becoming a workflow dependency.

The Studio should be a local operator surface over CLI/core contracts.

Priority order:

- maintain the read-only run index with state, warnings, approvals, readiness, and next action;
- maintain the run detail with evidence, readiness, warning counts, approvals, review artifact
  availability, guarded local approval forms, and guarded workflow-stage actions only where CLI/core
  contracts are enabled;
- maintain the read-only home latest-run readiness panel over existing run summaries without
  triggering CLI work;
- maintain the read-only home manual analytics summary over existing local analytics artifacts
  without calling YouTube APIs;
- maintain artifact previews for scripts, production packages, render plans, contact sheets, audio,
  render evidence, and readiness artifacts;
- maintain the read-only visual asset inventory page backed by configured guard checks;
- maintain the read-only producer doctor diagnostics page backed by ignored local doctor artifacts;
- maintain the explicit guarded doctor refresh action as a canonical workflow-read-only CLI
  diagnostic that may write ignored diagnostics but is not a configuration or workflow mutation;
- evolve the existing `/prompts` inventory into a guarded prompt-profile editor: show tracked and
  local content/diffs, require an operator note and expected revision/hash, persist immutable local
  revisions through CLI/core, support rollback, and keep save separate from generation/approval;
- add a guarded settings surface over canonical CLI/core config commands for safe provider/model,
  TTS, budget, asset, and channel settings. Saves are persistent, visible immediately, and effective
  for the next command while in-flight work remains pinned to its starting snapshot;
- label Studio listener ports, `NEXT_PUBLIC_*`, Sentry source-map settings, and other build-time or
  listener settings as restart-required instead of claiming live application;
- add genre/profile selection and an editable run-scoped idea brief before `ideas.run`; preserve
  UykulukSciFi scientific-sci-fi as the default and bind the exact preset/prompt/brief digests into
  the run without turning the desk into a generic content farm;
- maintain mutation-service status so operators can see which local approval/review actions are
  guarded and which upload/publish actions remain disabled;
- maintain guarded local model evaluation refresh actions without starting/downloading models or
  changing provider configuration;
- maintain the read-only manual analytics overview and import data-quality summary backed by ignored
  local CLI analytics artifacts;
- maintain shared service contracts for any Studio read/write operation;
- maintain route security requirements and negative tests for current read-only routes, the local
  session route, guarded local approval/review routes, and disabled upload/publish action routes;
- add additional guarded mutations beyond local approvals/review evidence only after they have
  shared contracts, local-session checks, evidence writes, and negative route tests.

Frontend constraints:

- no second state machine;
- no arbitrary shell execution;
- no hidden provider calls;
- no generation, render execution, upload, or publish bypasses;
- no additional mutating routes before route security requirements and negative tests.

## Phase D - Monetization Feedback Loop

Status: local CLI import/report foundation, guarded Studio import/report actions, and Studio
overview implemented; API integrations remain deferred.

The product should eventually learn from channel performance, but manual import comes before API
integrations.

Minimum loop:

- import operator-provided CSV/JSON performance data - implemented locally through
  `producer analytics import`;
- map performance records back to runs/videos with run-linked summaries and unmapped-record
  visibility plus a fillable run-link CSV template;
- summarize CTR, views, average view duration, retention notes, subscriber deltas, and qualitative
  comments where provided - implemented in `analytics/performance_report.md`;
- import and review the local dataset/report preview in Studio without YouTube API calls, run
  workflow mutation, upload, publish, or causal claims, including stale/missing report visibility;
- produce “repeat / avoid / mixed-signal inspect / test next” recommendations for future ideas,
  titles, formats, and thumbnail directions - implemented as non-causal operator planning prompts
  with confidence/missingness framing in `analytics/performance_report.md`.

This phase must not invent metrics or claim causality from weak data. YouTube Analytics API work is
optional later and requires its own credentials, privacy, cost, and approval design.

## Phase E - Controlled Distribution And Later Integrations

Status: private-only upload is a v1 deliverable and is not implemented; other integrations remain
deferred.

Required for v1 after exact local media review is reliable:

- resumable private-only YouTube upload with server-side OAuth/session state, exact target-channel,
  MP4, metadata, thumbnail, and caption digest binding, durable operation/offset evidence, and
  processing review;

Optional only after the controlled production loop proves useful:

- YouTube Analytics API;
- idea-only scheduler;
- richer prompt-profile organization after the guarded V1 editor proves useful;
- richer late-stage subtitle, scene, popup-card, thumbnail, and metadata editing/revision UX; the
  initial attributable package-artifact and render-revision contracts already exist;
- thumbnail A/B planning;
- additional paid image/video/TTS providers through the existing approved reservation/execution
  boundary;
- Shorts repurposing.

Explicitly out of scope for v1:

- public/scheduled publish automation;
- generic SaaS dashboard, hosted auth, team workspaces, billing, cloud database, or queue workers;
- autonomous multi-agent runtime that bypasses operator approval;
- paid/generative video providers before deterministic local render works.

## Visual Asset Status

The current asset packs cover logo, watermark, banner, lower-third, name panel, popup info card,
subtitle panels, title card, end screen, thumbnail templates, text-safe thumbnail overlays,
background plates, glitch/no-signal transition overlays, popup icons, waveform overlays, and
intro/outro render source frames.

Useful additions before render work focus on editability and licensing:

- editable source files for thumbnail and overlay variants;
- render-ready intro/outro MP4 clips generated from committed source frames for reuse outside the
  draft renderer; source-frame sequences are already consumed by local draft render planning when
  present;
- font files and license notes for recurring title, thumbnail, lower-third, and subtitle typography;
- additional series-specific background plates once recurring episode categories are defined;
- storyboard/contact-sheet template refinements after the MVP render-plan artifact exists.
