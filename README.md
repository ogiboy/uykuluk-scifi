# UykulukSciFi Producer

```text
  _   _       _          _       _     ____       _ _____ _
 | | | |_   _| | ___   _| |_   _| | __/ ___|  ___(_)  ___(_)
 | | | | | | | |/ / | | | | | | | |/ /\___ \ / __| | |_  | |
 | |_| | |_| |   <| |_| | | |_| |   <  ___) | (__| |  _| | |
  \___/ \__, |_|\_\\__,_|_|\__,_|_|\_\|____/ \___|_|_|   |_|
        |___/

Production desk for Turkish sci-fi YouTube episodes.
```

[![SonarQube Cloud](https://sonarcloud.io/images/project_badges/sonarcloud-light.svg)](https://sonarcloud.io/summary/new_code?id=ogiboy_uykuluk-scifi)
[![Quality gate](https://sonarcloud.io/api/project_badges/quality_gate?project=ogiboy_uykuluk-scifi)](https://sonarcloud.io/summary/new_code?id=ogiboy_uykuluk-scifi)
[![CI](https://github.com/ogiboy/uykuluk-scifi/actions/workflows/ci.yml/badge.svg)](https://github.com/ogiboy/uykuluk-scifi/actions/workflows/ci.yml)
[![CodeQL](https://github.com/ogiboy/uykuluk-scifi/actions/workflows/codeql.yml/badge.svg)](https://github.com/ogiboy/uykuluk-scifi/actions/workflows/codeql.yml)
[![License: LGPL-3.0](https://img.shields.io/badge/license-LGPL--3.0-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22-3c873a.svg)](package.json)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=ogiboy_uykuluk-scifi&metric=coverage)](https://sonarcloud.io/summary/new_code?id=ogiboy_uykuluk-scifi)
[![Lines of Code](https://sonarcloud.io/api/project_badges/measure?project=ogiboy_uykuluk-scifi&metric=ncloc)](https://sonarcloud.io/summary/new_code?id=ogiboy_uykuluk-scifi)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=ogiboy_uykuluk-scifi&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=ogiboy_uykuluk-scifi)
[![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=ogiboy_uykuluk-scifi&metric=sqale_rating)](https://sonarcloud.io/summary/new_code?id=ogiboy_uykuluk-scifi)
[![Technical Debt](https://sonarcloud.io/api/project_badges/measure?project=ogiboy_uykuluk-scifi&metric=sqale_index)](https://sonarcloud.io/summary/new_code?id=ogiboy_uykuluk-scifi)
[![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=ogiboy_uykuluk-scifi&metric=vulnerabilities)](https://sonarcloud.io/summary/new_code?id=ogiboy_uykuluk-scifi)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=ogiboy_uykuluk-scifi&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=ogiboy_uykuluk-scifi)

UykulukSciFi Producer is a local-first, approval-gated, cost-aware production desk for building
reviewable UykulukSciFi YouTube video draft packages. The TypeScript CLI is the source of truth; the
Next.js Producer Studio is an operator surface over the same local contracts, with guarded local
approval/review mutations only where route security and service contracts are implemented. The
system generates ideas, scripts, reviews, production packages, render plans, local voiceover, local
draft renders, cost estimates, evidence bundles, and readiness diagnostics. It does not upload or
publish to YouTube in the MVP.

## Product Direction

This product is not a generic AI video platform, a one-click publishing bot, or a content farm. It
is a channel-specific production loop for regularly producing original, scientifically careful, and
visually consistent UykulukSciFi drafts.

Near-term value is reliable draft production first: turn approved ideas into reviewable script,
metadata, subtitle, scene, render-plan, local voiceover, draft render, and evidence packages that
can become weekly videos. Private upload, analytics feedback, and public/scheduled publish remain
separate future phases with their own approval, cost, readiness, and evidence boundaries.

## Primary Journey

```text
doctor
  -> ideas
  -> approve idea
  -> script
  -> review script
  -> approve script
  -> package
  -> render-plan
  -> estimate / evidence / readiness
  -> optional local voiceover
  -> review voice
  -> approve render
  -> local FFmpeg draft render
  -> future private upload review
```

Every expensive, irreversible, or publishing-adjacent step stays blocked until the matching
configuration, approval, and evidence contracts exist. `.ai/` remains development guidance and
agent-tracking state only; runtime code must not require it.

## What Exists

- TypeScript CLI workflow under `src/`.
- Basic Next.js App Router Studio under `apps/studio/` with run index/detail, guarded local
  idea/script/cost/render approval actions, guarded render-decision and channel-handoff decision
  evidence writes, visual asset inventory, producer doctor diagnostics on the home page and
  `/doctor`, latest-run readiness visibility, local model evaluation summaries, manual analytics
  feedback summary on the home page, runtime prompt inventory, mutation-service status, and manual
  analytics feedback routes.
- Studio foundation with Tailwind CSS v4, shadcn-style primitives, Radix UI, lucide icons, GSAP, and
  `next/font`.
- Mock-first provider layer with Ollama and local `llama.cpp` adapters.
- Project-level `producer doctor` diagnostics for config, mock/Ollama/llama.cpp readiness, local
  TTS/Piper readiness, local FFmpeg/ffprobe toolchain availability, assets, and publish defaults.
- Local model evaluation command that exercises small idea/script parser contracts, writes ignored
  `diagnostics/local_model_eval.*` reports, and never persists raw provider output; Studio exposes
  these reports as read-only operator evidence without calling local models or changing config.
- Runtime prompt defaults under `prompts/defaults/`; `.ai/` is development and agent-tracking
  guidance, not a runtime dependency.
- Strict run state machine and explicit approval ledger.
- Versioned future paid-generation cost quote bundles (JSON plus operator Markdown) with exact
  digest approval, atomic one-time cost reservations, recoverable settlement/reconciliation, live
  hard-budget revalidation, adapter-bound local at-most-once execution claims, fail-closed
  timeout/unknown outcomes, cost ledger, content/clickbait review, full asset readiness, and
  evidence bundles.
- Render Plan + Contact Sheet MVP that maps generated scenes to tracked visual assets, summarizes
  scene/bookend timing, and records per-run asset provenance, including committed intro/outro
  source-frame sequences when present. Popup-card copy from the production package is bound to
  render-plan scenes for contact-sheet review and local draft-render burn-in.
- Production package generation derives `production/voiceover.txt` and `production/subtitles.srt`
  from `Anlatıcı:` lines only; `Görsel:` directions stay in scene visual prompts for render
  planning. Subtitles are wrapped into timed cues for local draft-review readability.
- Disabled-by-default local voiceover generation with deterministic reference WAV output,
  production-readiness warnings, operator review Markdown, and an optional Piper binary/model-path
  adapter.
- Approval-gated local FFmpeg draft render that writes a review MP4, manifest, operator review
  Markdown, YouTube chapter draft, and `ffprobe` media-validation evidence from the current render
  plan, intro/outro source cards or source-frame sequences, scene-timed background plates, voiceover
  audio, subtitles, lower-third, popup-card text, waveform, watermark overlays, source-frame
  counts/cadence, and voiceover mode/quality/candidate classification surfaced in evidence/readiness
  summaries, plus a stable read-only FFmpeg review command for the final draft artifact in the
  manifest, evidence JSON, and review Markdown.
- Local final review bundle generation that revalidates the render plan, voiceover, draft render,
  and any recorded render decision, then writes `production/review_bundle.json` and
  `production/review_bundle.md` as the operator's local handoff index. It does not approve upload or
  publish.
- Manual channel handoff package generation after an accepted local final review. It writes
  `production/thumbnail_candidates.*` plus `production/channel_handoff.*` with the local MP4,
  subtitles, YouTube metadata draft, chapter draft, thumbnail candidates, checklist, and
  final-review digest binding. It does not call YouTube APIs, upload, schedule, publish, or grant
  upload/publish approval.
- Manual analytics import/report commands for operator-provided CSV/JSON performance exports, plus a
  read-only Studio view over the ignored local analytics artifacts and import data-quality summary.
- Typed Studio route-security contract covering read-only routes, guarded local approval/review
  action routes, and disabled upload/publish action routes.
- Typed Studio mutation service contracts for guarded local approval/review decision actions and
  disabled upload/publish actions.
- Studio home visibility for guarded local actions, disabled upload/publish action routes,
  latest-run readiness, manual analytics feedback, CLI-ready action contracts, and upload/publish
  risk boundaries.
- Disabled private upload and public/scheduled publish placeholders.
- UykulukSciFi visual assets under `assets/`.
- `.ai/` operating contract for agents, workflows, design, QA, security, and roadmap state.
- Project-local capability routing so technical, product, design, marketing, data, security, QA, and
  multi-agent work loads only the tools relevant to the current task.
- CI, CodeQL, Dependabot, SonarQube, Prettier, ESLint, Vitest, Playwright, modularity, secret-scan,
  and changelog gates.
- `producer desk` uses Ink for the local terminal workbench when TTY streams are available, while
  preserving `--plain` output for scripts and CI.

## Repository Layout

```text
.
├── apps/studio/              # Next.js Producer Studio shell
├── assets/                   # Committed production visual assets and manifest docs
├── prompts/defaults/         # Runtime prompt defaults used by provider-backed stages
├── scripts/
│   ├── qa/                   # Usage smoke, modularity gate, Sonar scanner wrapper
│   ├── release/              # Changelog and conventional-commit checks
│   ├── security/             # Tracked-source secret scan
│   └── sonarqube/            # Local Docker SonarQube helpers
├── src/
│   ├── config/               # Config schema and loading
│   ├── core/                 # Run state, transitions, ledgers, artifacts
│   ├── costs/                # Token and cost estimation
│   ├── providers/            # Mock and local LLM adapters
│   ├── safeguards/           # Approval, budget, content, asset, publish guards
│   ├── stages/               # Workflow stages
│   ├── utils/                # Small shared helpers
│   └── youtube/              # Disabled upload/publish boundary
├── tests/                    # Vitest coverage for workflow and guards
├── .ai/                      # Development-only agent rules, workflows, QA, and decisions
└── .github/                  # CI, CodeQL, Dependabot, Sonar workflow
```

## Safe Operating Model

- Mock mode is the default.
- Script generation requires explicit idea approval.
- Script generation uses bounded section calls and can add up to three bounded continuation passes
  when a local model draft remains below the long-form review floor; continuation receipts are
  persisted with prompt/content hashes.
- If those bounded continuation passes still leave the assembled provider draft below the long-form
  floor, script generation fails closed without writing script artifacts and records safe
  diagnostics.
- Local model continuations are JSON-first, with a bounded raw Turkish fallback for models that
  ignore the JSON wrapper but still return complete, labeled continuation text.
- Script generation/review blocks malformed production labels, repeated sentence loops, model
  self-evaluation commentary, and literal escaped control text instead of allowing a long but
  low-quality local draft to advance.
- Script section and continuation content blockers get up to two bounded retries using only safe
  blocker summaries and already accepted context; rejected raw provider text is discarded, while
  hashes, token estimates, duration, and retry evidence are recorded on the accepted receipt.
- Known local-model production label variants such as `Anlatici:` and `Gorsel:` are repaired only at
  bounded label prefixes and recorded in section receipts; unrelated malformed labels still block.
- Script review and approval are bound to the exact `script.md` SHA-256 digest.
- Script approval requires `--acknowledge-warnings` when the review contains non-blocking warnings.
- Script review Markdown shows the next safe approval command or blocker remediation guidance.
- Evidence next-command guidance reflects script review blockers and warning acknowledgement needs;
  the operator Markdown renders the current run id while JSON keeps portable command templates.
- `producer status` shows an operator-readable run summary with current state, counts, approval
  ledger entries, warning details, evidence availability, readiness summary/attention checks,
  blocked-action details, production media evidence details, recent artifacts, and a concrete next
  safe action with the current run id filled in. Production media rows include the shared
  conservative `Review:` action used by evidence Markdown and Studio so operators can distinguish
  verified evidence from informational artifact records. Malformed or stale evidence points back to
  `producer evidence --run <run_id>`. Missing, malformed, or stale evidence labels production media
  rows as artifact-record fallback until evidence is regenerated, while missing, malformed, or stale
  readiness diagnostics point back to `producer readiness --run <run_id>`; use `--json` for the raw
  persisted state.
- `producer desk` opens a local Ink terminal workbench over the same run/status contracts. It is an
  operator review surface, not a second workflow engine. It shows next safe action, readiness
  attention, blocked actions, safe run diagnostics, copyable operator commands, production media,
  recent artifacts, render decision, and v1 workflow progress; use `--plain` for scriptable output
  or non-TTY shells.
- `producer decide render` records the human decision after local draft-render review as durable
  JSON/Markdown evidence. `producer status` and `producer desk` surface the recorded decision and
  next safe action. It does not approve upload or publish.
- Script edits use an attributable revision command with before/after snapshots; reviewed or
  approved scripts return to `SCRIPT_GENERATED` and require review/approval again.
- Production packaging requires explicit script approval for the unchanged reviewed content.
- Every run persists state, ledger events, costs, warnings, artifacts, and evidence under
  `runs/<run_id>/`.
- Persisted run records are schema-validated and JSON artifacts use atomic file replacement.
- Run identifiers are validated as one bounded safe path segment before state, ledger, artifact, or
  cost paths are constructed; persisted state must carry the same run id as its directory.
- Run artifact names are validated as bounded canonical relative paths before reads, writes, ledger
  events, or persistence; absolute paths, dot segments, backslashes, and malformed segments block.
- Generated ideas, scripts, and production packages render product runtime prompt defaults from
  `prompts/defaults/` and record prompt key, source path, and hash provenance.
- Idea generation retries up to two bounded repair attempts with parser validation feedback when a
  local provider returns a malformed or weak idea slate. Rejected raw outputs are not persisted;
  `ideas.json` records repair metadata and the ledger records each retry warning. A third invalid
  response still fails closed without idea artifacts.
- Idea slate validation rejects repeated local-model boilerplate in `fit` explanations, uncertainty
  openers, unknown-species phrases, weak premise action frames, English scientific leftovers, and
  repeated weak inspection/clue verbs before ideas can reach operator approval.
- Idea, script, and production-package generation re-check existing per-video, daily, and weekly
  budgets, using the stage pricing estimate, before calling a provider or writing generated
  artifacts.
- Readiness strictly parses the persisted cost quote, rechecks the production package, relevant
  config, pricing, and live hard budgets, and requires approval of the exact quote digest when the
  configured threshold is exceeded.
- The core can atomically reserve one approved nonzero quote line after readiness. Active,
  settlement-pending, and uncertain reservations consume per-video, daily, and weekly budget until
  they are settled or explicitly reconciled.
- Reservation caps and actual charges use integer USD micros. Settlement is journaled before the
  linked cost event so retries can recover without recording the same charge twice.
- Successful readiness diagnostics and evidence reflect the final transitioned run state.
- TTS is disabled by default and only runs after readiness with explicit local configuration, script
  approval, production-package integrity, and render-plan evidence.
  `production/audio/voiceover_review.md` gives the operator the local audio review checklist,
  required decision boundary, and next safe commands; audio file existence never grants render
  approval. Evidence, readiness, and status label deterministic-local WAVs as timing/reference
  artifacts until reviewed local Piper audio exists, and shared production-media review guidance in
  status, evidence Markdown, and Studio calls out reference audio before suggesting render approval
  for a local timing draft.
- Draft render runs only after explicit render approval for the exact current render-plan digest,
  voiceover digest, and voiceover mode/quality/candidate classification. The manifest records those
  input classifications, the exact render approval ID/reference that authorized the draft, the
  intro-to-outro timeline, composed overlay roles, intro/outro source-frame counts/cadence when
  available, placements used by FFmpeg, and `ffprobe`-validated media duration, video resolution,
  and audio stream evidence; `production/render/draft_review.md` labels deterministic audio renders
  as local timing drafts and gives the operator the final local review checklist and blocked-action
  boundary. Render output is local review media, not upload or publish authority.
- Upload and publish remain intentionally blocked scaffolds.
- Upload and public/scheduled publish require future explicit config and separate approval gates.
- Studio must call typed local service contracts; it must not duplicate workflow state.
- Guarded Studio local approval/review routes exist only for CLI/core-backed local evidence writes;
  they require same-origin JSON, action headers, and short-lived local session proof.

Paid generation providers are not implemented. `producer approve cost` approves one exact future
paid-production quote; it does not authorize or execute spending. The internal reservation and
execution services provide atomic one-time quote-line consumption, persist callback intent before
execution, and keep active or uncertain commitments inside hard budgets until settlement or explicit
reconciliation. Future adapters must expose only this boundary; direct budget-only or raw provider
execution is not allowed. No paid adapter, SDK, credential, or operator command is enabled.

## Install

```bash
pnpm install
pnpm producer init
pnpm producer doctor
pnpm producer doctor --json
```

If your shell cannot find `pnpm` or `node`, restore Node 22/Corepack first. The repository declares
`pnpm@11.9.0` and `node >=22`.

## CLI MVP Workflow

```bash
pnpm producer doctor
pnpm producer doctor --json
pnpm producer ideas
pnpm producer ideas --json
pnpm producer approve idea --run <run_id> --idea <idea_id>
pnpm producer approve idea --run <run_id> --idea <idea_id> --json
pnpm producer script --run <run_id>
pnpm producer script --run <run_id> --json
pnpm producer revise script --run <run_id> --file <path> --reason "<reason>" --editor <name> [--json]
pnpm producer review script --run <run_id>
pnpm producer review script --run <run_id> --json
pnpm producer approve script --run <run_id>
pnpm producer approve script --run <run_id> --acknowledge-warnings # when review warnings remain
pnpm producer approve script --run <run_id> --acknowledge-warnings --json
pnpm producer package --run <run_id>
pnpm producer package --run <run_id> --json
pnpm producer render-plan --run <run_id>
pnpm producer render-plan --run <run_id> --json
pnpm producer review render-plan --run <run_id>
pnpm producer review render-plan --run <run_id> --json
pnpm producer estimate --run <run_id>
pnpm producer estimate --run <run_id> --json
pnpm producer approve cost --run <run_id> # only when the quote requires it
pnpm producer approve cost --run <run_id> --json # only when the quote requires it
pnpm producer evidence --run <run_id>
pnpm producer evidence --run <run_id> --json
pnpm producer readiness --run <run_id>
pnpm producer readiness --run <run_id> --json
pnpm producer voice --run <run_id> # optional, only after local TTS is explicitly enabled
pnpm producer voice --run <run_id> --json
pnpm producer review voice --run <run_id>
pnpm producer review voice --run <run_id> --json
pnpm producer approve render --run <run_id>
pnpm producer approve render --run <run_id> --json
pnpm producer render --run <run_id>
pnpm producer render --run <run_id> --json
pnpm producer decide render --run <run_id> --decision accepted-for-local-review --notes "<operator notes>" --reviewed-by operator
pnpm producer decide render --run <run_id> --decision needs-revision --notes "<operator notes>" --reviewed-by operator
pnpm producer decide render --run <run_id> --decision rejected --notes "<operator notes>" --reviewed-by operator
pnpm producer review render-decision --run <run_id>
pnpm producer review render-decision --run <run_id> --json
pnpm producer review-bundle --run <run_id>
pnpm producer review-bundle --run <run_id> --json
pnpm producer channel-handoff --run <run_id>
pnpm producer channel-handoff --run <run_id> --json
pnpm producer decide channel-handoff --run <run_id> --decision accepted-for-manual-channel-prep --thumbnail-candidate <candidate_id> --notes "<operator notes>" --reviewed-by operator
pnpm producer decide channel-handoff --run <run_id> --decision needs-revision --notes "<operator notes>" --reviewed-by operator
pnpm producer decide channel-handoff --run <run_id> --decision rejected --notes "<operator notes>" --reviewed-by operator
```

Blocked readiness checks print and persist next-action guidance for common operator steps such as
generating the render plan, cost estimate, local voiceover, render approval, local draft render,
exact quote approval, or refreshed evidence bundle.

Inspection:

```bash
pnpm producer                 # open the local operator desk
pnpm producer status --run <run_id>
pnpm producer status --run <run_id> --json
pnpm producer status --run <run_id> --summary-json
pnpm producer status --latest
pnpm producer desk
pnpm producer desk --run <run_id>
pnpm producer desk --plain
pnpm producer list-runs
pnpm producer list-runs --json
pnpm producer review render-decision --run <run_id> [--json]
```

Local model evaluation:

```bash
pnpm producer eval local-model
pnpm producer eval local-model --json
pnpm --silent producer eval local-model --json
pnpm producer eval local-model --llm-mode llama.cpp --model <served-model.gguf>
pnpm producer eval local-model-candidates --llm-mode llama.cpp \
  --candidate <served-model-a.gguf> --candidate <served-model-b.gguf>
pnpm producer eval local-model-candidates --llm-mode llama.cpp --include-local-gguf
```

By default this uses the configured local provider and model, so keep `mock` for cheap
parser-contract checks. One-run overrides such as `--llm-mode`, `--model`, `--ollama-base-url`,
`--llama-cpp-base-url`, `--thinking-mode`, and `--request-timeout-ms` let operators compare local
Ollama/`llama.cpp` candidates without mutating `producer.config.json`. The report writes ignored
`diagnostics/local_model_eval.json` and `.md` with hashes, token/duration metadata, applied override
names, and parser results. Use `local-model-candidates` with repeated `--candidate` values or
`--include-local-gguf` for ignored `models/llm/*.gguf` files. The command writes one comparison
report at `diagnostics/local_model_candidates_eval.*`, including a deterministic recommended passing
candidate and next operator command when one exists. In `llama.cpp` mode, the candidate command
first checks `/v1/models`; a GGUF candidate that is not currently served is blocked without spending
time on generation. If at least one candidate passes while another blocks, the report exits
successfully and labels the decision as a recommended comparison with blockers plus a single-model
follow-up command. Raw provider text is intentionally not persisted. For automation that parses
`--json` output through pnpm, prefer `pnpm --silent producer ... --json`; blocked evaluations still
exit nonzero, but pnpm lifecycle text stays out of stdout.

Manual analytics feedback:

```bash
pnpm producer analytics import --file performance.csv
pnpm producer analytics import --file performance.csv --json
pnpm producer analytics report
pnpm producer analytics report --json
```

Analytics imports accept operator-provided CSV or JSON records with fields such as `run_id`,
`video_id`, `title`, `published_at`, `impressions`, `views`, `ctr`, `avg_view_duration_seconds`,
`avg_percentage_viewed`, `subscribers_gained`, `likes`, `comments`, and `notes`. The report includes
overall metrics, top videos, run-linked summaries, an unmapped-record table for videos that need a
future `run_id`, a fillable `analytics/run_link_template.csv`, and operator review prompts,
including non-causal repeat / avoid-without-revision / mixed-signal inspect / test-next
recommendations. The recommendations include simple confidence/missingness framing based on the
fields present in the import. The report also prints import data-quality counts for confidence
levels and missing run links, views, impressions, CTR, or retention fields. The importer writes
ignored local artifacts under `analytics/`; Studio can display the same read-only import
data-quality summary and run-link template path at `/analytics`. Neither path calls YouTube APIs,
uploads media, publishes content, mutates workflow state, or claims causality from performance
changes.

`producer analytics report` refreshes `analytics/performance_report.md` from the saved local dataset
and rewrites `analytics/run_link_template.csv` before printing it. Studio marks the report preview
as missing, stale, or current by checking it against the dataset timestamp and source digest.

Do not edit `runs/<run_id>/script.md` directly. Use `producer revise script` before production
packaging. Revisions are blocked after the production package exists. Each revision stores the old
and new script, attribution, reason, hashes, invalidated review/approval references, and a ledger
event under `revisions/script/<revision_id>/`.

After packaging, use `producer revise package-artifact` for bounded operator edits to generated
subtitles, scene prompts, popup-card package Markdown, or YouTube metadata before cost estimation or
render work starts:

```bash
pnpm producer revise package-artifact --run <run_id> --artifact subtitles --file subtitles.srt --reason "<reason>" --editor <name> [--json]
```

Package artifact revisions are blocked once the run leaves `PRODUCTION_PACKAGE_GENERATED`. Each
revision snapshots the previous and revised artifact, refreshes the production-package manifest
digests, removes stale evidence/readiness/render-plan artifacts, and records a ledger event under
`revisions/package/<revision_id>/`.

Blocked future actions:

```bash
pnpm producer upload private --run <run_id>
pnpm producer publish schedule --run <run_id>
```

## Producer Studio

The Studio is intentionally local-only. Most surfaces are read-only; guarded web mutations exist
only for explicit local approvals and local review evidence that already have shared CLI/core
contracts. They do not run generation, render media, upload, or publish.

```bash
pnpm studio
pnpm studio:build
```

Current Studio scope:

- production desk shell;
- read-only `/runs` index over persisted local run state with approval/warning/artifact counts,
  readiness/evidence status, stale or invalid artifact remediation, and next safe action visibility;
- `/runs/<run_id>` detail view with next action, readiness status, and review artifact availability
  plus approval ledger entries, warning lists, production media evidence details, shared v1 workflow
  progress, per-row review guidance, guarded idea/script/cost/render approval forms for eligible
  states, local render-decision command templates for rendered runs that have current draft-render
  evidence and no recorded decision, readiness check messages, and readiness next-action commands
  from CLI/core artifacts. Malformed or stale evidence artifacts stay read-only, are not used as
  proof for blocked actions, media readiness, or next-action guidance, and point back to the CLI
  evidence command; media rows fall back to persisted artifact-record visibility until evidence is
  current. Missing, malformed, or stale readiness artifacts stay read-only and point back to the CLI
  readiness command;
- read-only artifact preview excerpts for scripts, reviews, production packages, render plans,
  contact sheets, asset provenance, evidence, readiness, voiceover metadata, and render manifests,
  grouped by operator review phase, with binary media limited to metadata;
- run/workflow command overview;
- home-page doctor diagnostics summary showing the persisted doctor status and next safe action;
- read-only `/doctor` page over ignored `diagnostics/doctor.json` and `diagnostics/doctor.md`,
  showing local config/provider/TTS/asset/publish checks and next safe remediation without running
  doctor, editing config, starting providers, downloading models, or mutating workflow state;
- current asset inventory summary and read-only `/assets` detail page backed by configured asset
  guard checks;
- read-only runtime prompt inventory and `/prompts` detail page for tracked defaults and configured
  ignored `prompts/local/*.md` overrides, with source paths, hashes, and doctor remediation but no
  editing;
- guarded `POST /actions/approve-idea`, `/actions/approve-script`, `/actions/approve-cost`, and
  `/actions/approve-render` routes that require same-origin JSON, a Studio action header, a
  short-lived local session token/cookie pair, typed service-contract payloads, and the same
  CLI/core approval gates as `producer approve ...`;
- guarded `POST /actions/decide-render` route that requires same-origin JSON, a Studio action
  header, a short-lived local session token/cookie pair, the typed `render.decide` service contract,
  current draft-render evidence, and writes only local render-decision JSON/Markdown evidence;
- guarded `POST /actions/decide-channel-handoff` route that requires same-origin JSON, a Studio
  action header, a short-lived local session token/cookie pair, the typed `channel-handoff.decide`
  service contract, trusted manual channel-handoff evidence, and writes only local channel-handoff
  decision JSON/Markdown evidence;
- Radix module tabs for planned run, prompt, asset, and safety surfaces;
- type-safe `next-intl` request/provider foundation for English and Turkish locales;
- visible reminder that CLI/core remains the workflow source of truth.

Next Studio work should keep artifact, asset, and prompt visibility aligned with new production
artifacts, keep upload/publish mutations disabled, and add further guarded routes only after shared
service contracts, local-session route security, and negative tests exist.

## Visual Assets

Committed packs include:

- brand: square logo, watermark, banner, corner logo bug;
- overlays: subtitle panels, lower-third, name panel, popup info card;
- intro/outro: title card, end screen, source frames;
- thumbnails: three 1280x720 templates and matching text-safe overlays;
- backgrounds: six 1920x1080 sci-fi plates;
- transitions: soft glitch, heavy glitch, no-signal, cyan/orange scan overlays;
- icons: telescope, planet, warning, fact-check, signal;
- waveform overlays for narration-driven scenes.

See [assets/README.md](assets/README.md) for the full inventory. Remaining useful additions are
editable source files, render-ready intro/outro clips, and font/license notes.

## Quality Gates

Run the full local gate before push-ready handoff:

```bash
pnpm check
pnpm qa:usage
pnpm qa:product
pnpm version:plan
```

`pnpm qa:product` is the broader optional product UAT gate for PR-ready production-loop work. It
exercises local draft-render review, malicious/incorrect order attempts, stale/tampered evidence,
disabled upload/publish, manual analytics import/report feedback, operator desk command/diagnostic
visibility, and Studio read-only service visibility, including durable local render decisions, in an
isolated clean copy.

Focused gates:

```bash
pnpm lint
pnpm typecheck
pnpm build
pnpm build:smoke
pnpm test
pnpm studio:typecheck
pnpm studio:build
pnpm qa:product
pnpm qa:browser
pnpm qa:modularity
pnpm security:check
pnpm security:dependencies
pnpm changelog:check
pnpm release:check
pnpm format:check
```

## Agent Capability Routing

Agents start with `.ai/capabilities.instructions.md`. It routes tasks to a small selected set of
skills, plugins, MCPs, connectors, browser tools, or subagents and records long-goal state under
`.ai/checkpoints/`. The complete host catalog is not loaded into each thread.

SonarQube:

```bash
pnpm sonar:start
pnpm sonar:status
pnpm test:coverage
pnpm sonar
```

Local dashboard default:

```text
http://localhost:9000/dashboard?id=uykuluk-scifi
```

## Configuration

Create local config with:

```bash
pnpm producer init
```

Keep `producer.config.json` ignored. Keep `providers.llm.mode` as `mock` for normal local testing.
Use local provider modes only when the matching server and model are available. Qwen/Ollama remains
useful for regression coverage, but it is not the production-quality default for channel drafts.

Useful Ollama settings:

```json
{
  "providers": {
    "llm": {
      "mode": "ollama",
      "ollamaBaseUrl": "http://localhost:11434",
      "model": "qwen3:8b",
      "thinkingMode": "default",
      "maxOutputTokens": {
        "ideas": 3000,
        "script": 3200,
        "productionPackage": 2000
      }
    }
  }
}
```

Useful local `llama.cpp` settings for an OpenAI-compatible `llama-server`:

```json
{
  "providers": {
    "llm": {
      "mode": "llama.cpp",
      "llamaCppBaseUrl": "http://localhost:8080",
      "model": "Mistral-7B-Instruct-v0.3.Q4_K_M.gguf",
      "requestTimeoutMs": 120000,
      "maxOutputTokens": {
        "ideas": 3000,
        "script": 3200,
        "productionPackage": 2000
      }
    }
  }
}
```

Example local server command:

```bash
llama-server --model models/llm/Mistral-7B-Instruct-v0.3.Q4_K_M.gguf --ctx-size 8192 --port 8080
```

The adapter is local-only, uses `/v1/models` for doctor diagnostics and `/v1/chat/completions` for
generation, and does not require hosted API credentials. Model quality is still an evaluation
decision: prefer controlled local comparisons before spending more time on Qwen prompt tuning.

Useful local TTS settings:

```bash
uv tool install piper-tts
pnpm tts:piper:setup
```

```json
{
  "providers": {
    "tts": {
      "enabled": true,
      "mode": "deterministic-local"
    }
  }
}
```

`deterministic-local` writes a reference WAV for timing and pipeline validation; it is not a
production-quality voice. Evidence/readiness/status keep this distinction visible and add a
production-voice candidate warning until reviewed local Piper audio exists. `pnpm tts:piper:setup`
downloads the default pinned Turkish `speaches-ai/piper-tr_TR-fahrettin-medium` model into ignored
`models/` and prints the matching ignored `producer.config.json` override. The helper keeps Hugging
Face `config.json` and also writes the Piper-compatible `model.onnx.json` alias. `local-piper`
requires a local `piper` binary and ignored model files configured with `piperModelPath` and
`piperConfigPath`. Local Piper voiceover metadata and review Markdown record the model/config
SHA-256 digests used for the WAV. Do not commit downloaded voice models or generated audio.
`producer voice` also writes `production/audio/voiceover_review.md` so the operator can check
timing, pacing, pronunciation, source binding, and provider provenance before render approval. The
non-JSON `producer voice` output points directly at the run-scoped WAV playback path, that review
artifact, and the next safe `producer review voice --run <run_id>` command.
`producer review voice --run <run_id>` prints the same local audio review handoff from validated
voiceover evidence, including the explicit render approval command and whether that approval is only
for a local timing draft or for a reviewed production voice candidate. Studio production-media rows
show the same read-only playback path, review command, approval command, and approval scope without
adding a web mutation.

`producer review render-plan --run <run_id>` prints a read-only render-plan/contact-sheet handoff
from validated render-plan evidence. It points operators to `production/storyboard_contact_sheet.md`
and `production/asset_provenance.json`, summarizes scenes, assets, timing ranges, visual rhythm,
scene-to-asset mapping, intro/outro source-frame paths, background reuse, asset role counts, and
revision guidance, and keeps TTS, render, upload, publish, and paid/generative media work behind
their separate gates.

`producer render` requires `ffmpeg` on `PATH` unless called through a test harness with an explicit
binary. The draft render is a local review artifact and may be regenerated after approval; its
manifest records intro/outro source-card segments, scene timing, overlay roles, and the voiceover
mode/quality/candidate classification bound to the approval. It also stores the actual execution
arguments that used an atomic temporary output and a separate read-only FFmpeg review command that
decodes the final draft artifact to `null` for operator inspection; the same trusted command is
copied into draft-render evidence JSON. The non-JSON CLI output and read-only
`producer review render --run <run_id>` command point directly to the MP4, manifest, review
document, local-only next action, and copy-pasteable `producer decide render` command templates for
recording exactly one durable local operator decision. After that decision exists,
`producer review render-decision --run <run_id>` reopens the validated decision evidence without
mutating state. Status, evidence Markdown, and the read-only Studio production-media panel surface
that same safe review command when draft-render evidence is current, and rendered runs use the
read-only review command as their next safe action. `production/render/draft_review.md` summarizes
the final operator checklist, shows that review command, includes a timestamped review map and
decision command templates, links the bound `production/render/youtube_chapters.md` chapter draft,
and labels deterministic-reference audio renders as local timing drafts. It does not upload,
schedule, or publish anything.

`producer review-bundle --run <run_id>` creates a local final review handoff after a draft render
exists. The bundle revalidates the current render-plan, voiceover, draft-render, and render-decision
status; missing decisions are shown as `decision-pending`, while stale or invalid decision evidence
blocks bundle generation. The resulting `production/review_bundle.md` is an index for local channel
review only, points back to the timestamped draft-render review map, and still keeps upload and
public/scheduled publish disabled. `producer status` and `producer desk` validate and surface the
bundle after it exists so the operator does not loop back to the bundle command.

`producer channel-handoff --run <run_id>` creates a manual channel preparation package only after
the final review bundle is trusted and accepted for local review. It writes
`production/thumbnail_candidates.json`, `production/thumbnail_candidates.md`,
`production/channel_handoff.json`, and `production/channel_handoff.md` with the draft MP4 path,
subtitle path, copy-ready title/description/tags, YouTube metadata draft, YouTube chapter draft,
tracked thumbnail candidates, final-review digest binding, and manual checklist. It is not an upload
command and does not approve private upload, scheduled publish, or public publish.
`producer decide channel-handoff` then records the selected thumbnail candidate and channel-prep
decision as durable local evidence while keeping upload and publish disabled. `producer status`,
`producer desk`, and the read-only Studio run detail surface the recorded decision and its local
review artifact.

`thinkingMode` can be `default`, `think`, or `no_think`. Token caps are sent to Ollama as
`num_predict` so local generation cannot run unbounded. Script generation splits the approved idea
into bounded hook, context, development, and outro sections. Each section is drafted once and then
expanded through three smaller bounded JSON chunks so local models can finish valid payloads. The
run persists draft/expansion receipts before it can advance. If a local model returns malformed
JSON, English operator-facing text, duplicate/boilerplate ideas, or an incomplete script section,
the stage fails closed before writing the next review artifact; provider failure diagnostics are
persisted under the run when safe to record. Repeated sentence or label blockers get bounded
raw-output-free repair retries, and a later successful script run clears stale failure diagnostics
before advancing. `producer status` and the read-only Studio run detail surface safe idea/script
failure diagnostic summaries so the next blocker is visible without opening JSON artifacts by hand.

`producer eval local-model` is a lightweight manual bake-off surface for local model candidates. It
does not create a run, advance workflow state, or edit config; it calls only the configured local
LLM provider or the one-run CLI override, validates small idea/script samples through the production
parsers, and writes ignored diagnostic reports without raw model output. Eval requests use
temperature `0` so candidate comparisons are repeatable. A 2026-06-28 local qwen3:8b run remained
fail-closed at the idea-contract check because `fit` explanations were not slot-specific, while the
script-section contract parsed; this keeps Qwen as regression evidence rather than the recommended
production default. `producer eval local-model-candidates` runs the same checks for repeated
`--candidate` model names and produces a local comparison report so operators can compare served
Ollama or `llama.cpp` candidates without editing config between attempts. `--include-local-gguf`
adds ignored `models/llm/*.gguf` files as candidate ids, which is useful after downloading local
models. The comparison report recommends only candidates that pass all parser-contract checks. Mixed
comparisons that find a recommended passing candidate are treated as useful operator evidence even
when other candidates block; comparisons with no passing candidate still exit non-zero and tell the
operator to try more candidates. Studio shows these mixed reports as `recommended` instead of fully
blocked. `llama.cpp` candidate comparisons are one-loaded-server checks: start `llama-server` with
the GGUF under test, or the candidate is blocked as not served before generation.

Run `pnpm producer doctor` before starting production work. Mock mode passes without network access.
Ollama mode checks `/api/tags`; `llama.cpp` mode checks `/v1/models`. Both use bounded timeouts and
block when the local server is unavailable or the configured model is not served. Provider, local
render toolchain, TTS, and publish-default blockers print next-action guidance and persist the same
guidance so the operator can repair local config without treating unsafe defaults as approval.
Configured local prompt overrides are also checked for safe `prompts/local/*.md` paths, file
presence, and non-empty content before generation starts. The command writes ignored local evidence
to `diagnostics/doctor.json` and `diagnostics/doctor.md`; it does not create a run or grant
approval.

Tracked runtime prompt defaults:

- `prompts/defaults/planner-task.md`
- `prompts/defaults/scriptwriter-task.md`
- `prompts/defaults/production-package-task.md`

Editing a runtime default prompt changes future generation only. It does not rerun a stage, mutate
an existing artifact, or grant approval. Files under `.ai/` are for development guidance, QA
evidence, checkpoints, and agent coordination; the CLI must not require them to run.

Local prompt experiments belong under ignored `prompts/local/` and must be explicitly referenced
from `producer.config.json`:

```json
{
  "prompts": {
    "overrides": {
      "ideas": "prompts/local/planner-experiment.md"
    }
  }
}
```

Override paths are fail-closed to Markdown files under `prompts/local/`. Prompt provenance records
the override source path and hash so generated ideas, scripts, and production packages remain
auditable without making `.ai/` part of runtime.

## Run Artifacts

Each run can write:

- `state.json`;
- `ideas.json` and `ideas.md`;
- `script.md`, `script.sections.json`, and `script.meta.json`;
- `revisions/script/<revision_id>/before.md`, `after.md`, invalidated review snapshots, and
  `revision.json`;
- `revisions/package/<revision_id>/before/<artifact>`, `after/<artifact>`, and `revision.json`;
- `reviews/script_review.json` and `reviews/script_review.md`;
- `production/voiceover.txt`, `production/subtitles.srt`, `production/scenes.json`,
  `production/youtube_metadata.json`, `production/production_package.md`,
  `production/production_package.meta.json`;
- `production/render_plan.json`, `production/storyboard_contact_sheet.md`, and
  `production/asset_provenance.json`;
- `production/audio/voiceover.wav`, `production/audio/voiceover.meta.json`, and
  `production/audio/voiceover_review.md` when local TTS is explicitly enabled and run after
  readiness;
- `production/render/draft.mp4`, `production/render/render_manifest.json`,
  `production/render/draft_review.md`, `production/render/youtube_chapters.json`, and
  `production/render/youtube_chapters.md` after exact render approval and local FFmpeg execution;
- `production/review_bundle.json` and `production/review_bundle.md` after local draft-render
  evidence is current and the final review handoff is generated;
- `production/thumbnail_candidates.json`, `production/thumbnail_candidates.md`,
  `production/channel_handoff.json`, and `production/channel_handoff.md` after accepted local final
  review and manual channel handoff generation;
- `production/channel_handoff_decision.json` and `production/channel_handoff_decision.md` after a
  manual channel-prep decision is recorded;
- `costs/estimate.json` and `costs/estimate.md`;
- `costs/ledger.jsonl`;
- `costs/reservations.jsonl`;
- `evidence_bundle.json` and `evidence_bundle.md`;
- `diagnostics/ideas_generation_failure.json` when idea provider validation or transport fails;
- `diagnostics/script_generation_failure.json` when script provider parsing or transport fails;
- `diagnostics/readiness.json` and `diagnostics/readiness.md`;
- `ledger.jsonl`.

Generated run directories are ignored except `runs/.gitkeep`. Generated project diagnostics under
`diagnostics/` are also ignored. Manual analytics outputs under `analytics/` are ignored local
operator data.

## Branch And Release Policy

- Initial bootstrap may be committed on `main`.
- After the first push, use module-scoped branches such as `feat/studio-run-detail`,
  `fix/core-approval-ledger`, `ci/codeql-hardening`, or `docs/asset-inventory`.
- Use Conventional Commits.
- Keep `CHANGELOG.md` and the `<!-- version list -->` marker intact.
- Feature branches and PRs do not bump `package.json`; use `pnpm version:plan` to inspect the
  planned release instead.
- `pnpm version:plan` reports the next release version from the latest stable tag, the pending tag
  name, whether release notes will come from `CHANGELOG.md` Unreleased notes or commit-derived
  notes, and the main-only automation policy.
- `pnpm release:check` validates release-range commit subjects before publish.
- Pushes to `main` run the release workflow. When releaseable commits exist, it updates
  `package.json`, moves `CHANGELOG.md` Unreleased notes into a versioned section, creates
  `chore(release): vX.Y.Z`, and tags `vX.Y.Z`.
- Release workflow contract tests keep the main-only bot guard, high-severity dependency audit,
  release validation, `version:plan`, `release:apply`, changelog mutation, and atomic tag push wired
  together.
- The release publish step refreshes `origin/main` before planning and retries atomic push if main
  advances while earlier release jobs are running.
- Release phase `0.1.x` covers CLI MVP hardening, Studio foundation, browser QA, docs, and tooling.

## License

GNU Lesser General Public License v3.0. See [LICENSE](LICENSE).
