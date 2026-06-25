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
Next.js Producer Studio is a read-only operator surface over the same local contracts. The system
generates ideas, scripts, reviews, production packages, render plans, local voiceover, local draft
renders, cost estimates, evidence bundles, and readiness diagnostics. It does not upload or publish
to YouTube in the MVP.

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
  -> approve render
  -> local FFmpeg draft render
  -> future private upload review
```

Every expensive, irreversible, or publishing-adjacent step stays blocked until the matching
configuration, approval, and evidence contracts exist. `.ai/` remains development guidance and
agent-tracking state only; runtime code must not require it.

## What Exists

- TypeScript CLI workflow under `src/`.
- Basic Next.js App Router Studio under `apps/studio/` with read-only run index/detail, visual asset
  inventory, mutation-service status, and manual analytics feedback routes.
- Studio foundation with Tailwind CSS v4, shadcn-style primitives, Radix UI, lucide icons, GSAP, and
  `next/font`.
- Mock-first provider layer with Ollama adapter scaffold.
- Project-level `producer doctor` diagnostics for config, mock/Ollama readiness, local TTS/Piper
  readiness, assets, and publish defaults.
- Runtime prompt defaults under `prompts/defaults/`; `.ai/` is development and agent-tracking
  guidance, not a runtime dependency.
- Strict run state machine and explicit approval ledger.
- Versioned future paid-generation cost quote bundles (JSON plus operator Markdown) with exact
  digest approval, atomic one-time cost reservations, recoverable settlement/reconciliation, live
  hard-budget revalidation, adapter-bound local at-most-once execution claims, fail-closed
  timeout/unknown outcomes, cost ledger, content/clickbait review, full asset readiness, and
  evidence bundles.
- Render Plan + Contact Sheet MVP that maps generated scenes to tracked visual assets and records
  per-run asset provenance, including committed intro/outro source-frame sequences when present.
- Disabled-by-default local voiceover generation with deterministic reference WAV output, operator
  review Markdown, and an optional Piper binary/model-path adapter.
- Approval-gated local FFmpeg draft render that writes a review MP4, manifest, operator review
  Markdown, and `ffprobe` media-validation evidence from the current render plan, intro/outro source
  cards or source-frame sequences, scene-timed background plates, voiceover audio, subtitles,
  lower-third, popup, waveform, watermark overlays, and source-frame counts surfaced in
  evidence/readiness summaries.
- Manual analytics import/report commands for operator-provided CSV/JSON performance exports, plus a
  read-only Studio view over the ignored local analytics artifacts and import data-quality summary.
- Typed Studio route-security contract covering current read-only routes and disabled future action
  routes.
- Typed Studio mutation service contracts for future approval/upload/publish actions, including
  request validation and CLI/core binding metadata, without enabling web mutations.
- Read-only Studio home visibility for disabled future action routes, CLI-ready approval contracts,
  and upload/publish risk boundaries.
- Disabled private upload and public/scheduled publish placeholders.
- UykulukSciFi visual assets under `assets/`.
- `.ai/` operating contract for agents, workflows, design, QA, security, and roadmap state.
- Project-local capability routing so technical, product, design, marketing, data, security, QA, and
  multi-agent work loads only the tools relevant to the current task.
- CI, CodeQL, Dependabot, SonarQube, Prettier, ESLint, Vitest, Playwright, modularity, secret-scan,
  and changelog gates.
- Future Ink dependency is present for a richer CLI/TUI surface after the current commander CLI
  contracts stabilize.

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
- Script generation uses bounded section calls and can add up to two bounded continuation passes
  when a local model draft remains below the long-form review floor; continuation receipts are
  persisted with prompt/content hashes.
- If those bounded continuation passes still leave the assembled provider draft below the long-form
  floor, script generation fails closed without writing script artifacts and records safe
  diagnostics.
- Local model continuations are JSON-first, with a bounded raw Turkish fallback for models that
  ignore the JSON wrapper but still return complete, labeled continuation text.
- Script generation/review blocks malformed production labels and repeated sentence loops instead of
  allowing a long but low-quality local draft to advance.
- Script section and continuation content blockers get one bounded retry using only safe blocker
  summaries and already accepted context; rejected raw provider text is discarded, while hashes,
  token estimates, duration, and retry evidence are recorded on the accepted receipt.
- Known local-model production label variants such as `Anlatici:` and `Gorsel:` are repaired only at
  bounded label prefixes and recorded in section receipts; unrelated malformed labels still block.
- Script review and approval are bound to the exact `script.md` SHA-256 digest.
- Script approval requires `--acknowledge-warnings` when the review contains non-blocking warnings.
- Script review Markdown shows the next safe approval command or blocker remediation guidance.
- Evidence next-command guidance reflects script review blockers and warning acknowledgement needs.
- `producer status` shows an operator-readable run summary with current state, counts, evidence
  availability, recent artifacts, and next safe action; use `--json` for the raw persisted state.
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
  `production/audio/voiceover_review.md` gives the operator the local audio review checklist; audio
  file existence never grants render approval.
- Draft render runs only after explicit render approval for the exact current render-plan and
  voiceover digests. The manifest records the intro-to-outro timeline, composed overlay roles,
  intro/outro source-frame counts when available, placements used by FFmpeg, and `ffprobe`-validated
  media duration, video resolution, and audio stream evidence; `production/render/draft_review.md`
  gives the operator the final local review checklist. Render output is local review media, not
  upload or publish authority.
- Upload and publish remain intentionally blocked scaffolds.
- Upload and public/scheduled publish require future explicit config and separate approval gates.
- Studio must call typed local service contracts; it must not duplicate workflow state.
- Studio mutation service contracts exist for future guarded actions, but no Studio action route is
  enabled yet.

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
```

If your shell cannot find `pnpm` or `node`, restore Node 22/Corepack first. The repository declares
`pnpm@11.5.2` and `node >=22`.

## CLI MVP Workflow

```bash
pnpm producer doctor
pnpm producer ideas
pnpm producer approve idea --run <run_id> --idea <idea_id>
pnpm producer script --run <run_id>
pnpm producer revise script --run <run_id> --file <path> --reason "<reason>" --editor <name>
pnpm producer review script --run <run_id>
pnpm producer approve script --run <run_id>
pnpm producer approve script --run <run_id> --acknowledge-warnings # when review warnings remain
pnpm producer package --run <run_id>
pnpm producer render-plan --run <run_id>
pnpm producer estimate --run <run_id>
pnpm producer approve cost --run <run_id> # only when the quote requires it
pnpm producer evidence --run <run_id>
pnpm producer readiness --run <run_id>
pnpm producer voice --run <run_id> # optional, only after local TTS is explicitly enabled
pnpm producer approve render --run <run_id>
pnpm producer render --run <run_id>
```

Inspection:

```bash
pnpm producer status --run <run_id>
pnpm producer status --run <run_id> --json
pnpm producer list-runs
```

Manual analytics feedback:

```bash
pnpm producer analytics import --file performance.csv
pnpm producer analytics report
```

Analytics imports accept operator-provided CSV or JSON records with fields such as `run_id`,
`video_id`, `title`, `published_at`, `impressions`, `views`, `ctr`, `avg_view_duration_seconds`,
`avg_percentage_viewed`, `subscribers_gained`, `likes`, `comments`, and `notes`. The report includes
overall metrics, top videos, run-linked summaries, unmapped record counts, and operator review
prompts, including non-causal repeat / avoid-without-revision / test-next recommendations. The
recommendations include simple confidence/missingness framing based on the fields present in the
import. The importer writes ignored local artifacts under `analytics/`; Studio can display a
read-only overview and import data-quality summary at `/analytics`. Neither path calls YouTube APIs,
uploads media, publishes content, mutates workflow state, or claims causality from performance
changes.

`producer analytics report` refreshes `analytics/performance_report.md` from the saved local dataset
before printing it. Studio marks the report preview as missing, stale, or current by checking it
against the dataset timestamp and source digest.

Do not edit `runs/<run_id>/script.md` directly. Use `producer revise script` before production
packaging. Revisions are blocked after the production package exists. Each revision stores the old
and new script, attribution, reason, hashes, invalidated review/approval references, and a ledger
event under `revisions/script/<revision_id>/`.

Blocked future actions:

```bash
pnpm producer upload private --run <run_id>
pnpm producer publish schedule --run <run_id>
```

## Producer Studio

The Studio is intentionally local-only and read-only today:

```bash
pnpm studio
pnpm studio:build
```

Current Studio scope:

- production desk shell;
- read-only `/runs` index over persisted local run state;
- read-only `/runs/<run_id>` detail view with next action, readiness status, and review artifact
  availability;
- read-only artifact preview excerpts for scripts, reviews, production packages, render plans,
  contact sheets, asset provenance, evidence, readiness, voiceover metadata, and render manifests,
  grouped by operator review phase, with binary media limited to metadata;
- run/workflow command overview;
- current asset inventory summary and read-only `/assets` detail page backed by configured asset
  guard checks;
- Radix module tabs for planned run, prompt, asset, and safety surfaces;
- type-safe `next-intl` request/provider foundation for English and Turkish locales;
- visible reminder that CLI/core remains the workflow source of truth.

Next Studio work should keep artifact and asset previews aligned with new production artifacts, add
shared read/write service contracts, and define route security requirements before any mutating
route handlers.

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
pnpm version:plan
```

Focused gates:

```bash
pnpm lint
pnpm typecheck
pnpm build
pnpm build:smoke
pnpm test
pnpm studio:typecheck
pnpm studio:build
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
Use `ollama` only when a local Ollama server and model are available.

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
production-quality voice. `pnpm tts:piper:setup` downloads the default pinned Turkish
`speaches-ai/piper-tr_TR-fahrettin-medium` model into ignored `models/` and prints the matching
ignored `producer.config.json` override. The helper keeps Hugging Face `config.json` and also writes
the Piper-compatible `model.onnx.json` alias. `local-piper` requires a local `piper` binary and
ignored model files configured with `piperModelPath` and `piperConfigPath`. Local Piper voiceover
metadata and review Markdown record the model/config SHA-256 digests used for the WAV. Do not commit
downloaded voice models or generated audio. `producer voice` also writes
`production/audio/voiceover_review.md` so the operator can check timing, pacing, pronunciation,
source binding, and provider provenance before render approval.

`producer render` requires `ffmpeg` on `PATH` unless called through a test harness with an explicit
binary. The draft render is a local review artifact and may be regenerated after approval; its
manifest records intro/outro source-card segments, scene timing, and overlay roles, while
`production/render/draft_review.md` summarizes the final operator checklist. It does not upload,
schedule, or publish anything.

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

Run `pnpm producer doctor` before starting production work. Mock mode passes without network access.
Ollama mode checks `/api/tags` with a bounded timeout and blocks when the server is unavailable or
the configured model is not installed. TTS diagnostics include next-action guidance for disabled
TTS, deterministic reference audio, and local Piper setup/remediation. The command writes ignored
local evidence to `diagnostics/doctor.json` and `diagnostics/doctor.md`; it does not create a run or
grant approval.

Tracked runtime prompt defaults:

- `prompts/defaults/planner-task.md`
- `prompts/defaults/scriptwriter-task.md`
- `prompts/defaults/production-package-task.md`

Editing a runtime default prompt changes future generation only. It does not rerun a stage, mutate
an existing artifact, or grant approval. Files under `.ai/` are for development guidance, QA
evidence, checkpoints, and agent coordination; the CLI must not require them to run.

## Run Artifacts

Each run can write:

- `state.json`;
- `ideas.json` and `ideas.md`;
- `script.md`, `script.sections.json`, and `script.meta.json`;
- `revisions/script/<revision_id>/before.md`, `after.md`, invalidated review snapshots, and
  `revision.json`;
- `reviews/script_review.json` and `reviews/script_review.md`;
- `production/voiceover.txt`, `production/subtitles.srt`, `production/scenes.json`,
  `production/youtube_metadata.json`, `production/production_package.md`,
  `production/production_package.meta.json`;
- `production/render_plan.json`, `production/storyboard_contact_sheet.md`, and
  `production/asset_provenance.json`;
- `production/audio/voiceover.wav`, `production/audio/voiceover.meta.json`, and
  `production/audio/voiceover_review.md` when local TTS is explicitly enabled and run after
  readiness;
- `production/render/draft.mp4`, `production/render/render_manifest.json`, and
  `production/render/draft_review.md` after exact render approval and local FFmpeg execution;
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
- The release publish step refreshes `origin/main` before planning and retries atomic push if main
  advances while earlier release jobs are running.
- Release phase `0.1.x` covers CLI MVP hardening, Studio foundation, browser QA, docs, and tooling.

## License

GNU Lesser General Public License v3.0. See [LICENSE](LICENSE).
