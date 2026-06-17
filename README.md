# UykulukSciFi Producer

```text
 _   _       _        _       _       _     ____       _ _____ _
| | | |_   _| | ___  | |_   _| | __  | |   / ___|  ___(_)  ___(_)
| | | | | | | |/ / | | | | | | |/ /  | |   \___ \ / __| | |_  | |
| |_| | |_| |   <| |_| | |_| |   <   | |___ ___) | (__| |  _| | |
 \___/ \__,_|_|\_\\__,_|\__,_|_|\_\  |_____|____/ \___|_|_|   |_|

Local-first, approval-gated production desk for Turkish sci-fi YouTube episodes.
```

[![CI](https://github.com/ogiboy/uykuluk-scifi/actions/workflows/ci.yml/badge.svg)](https://github.com/ogiboy/uykuluk-scifi/actions/workflows/ci.yml)
[![CodeQL](https://github.com/ogiboy/uykuluk-scifi/actions/workflows/codeql.yml/badge.svg)](https://github.com/ogiboy/uykuluk-scifi/actions/workflows/codeql.yml)
[![License: LGPL-3.0](https://img.shields.io/badge/license-LGPL--3.0-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22-3c873a.svg)](package.json)

UykulukSciFi Producer is a local production system for building reviewable YouTube video drafts. The
current product has a TypeScript CLI as the source of truth and a basic Next.js Producer Studio
shell prepared for the future web interface. It generates ideas, scripts, reviews, production
packages, cost estimates, evidence bundles, and readiness diagnostics. It does not upload or publish
to YouTube in the MVP.

## What Exists

- TypeScript CLI workflow under `src/`.
- Basic Next.js App Router Studio under `apps/studio/`.
- Studio foundation with Tailwind CSS v4, shadcn-style primitives, Radix UI, lucide icons, GSAP, and
  `next/font`.
- Mock-first provider layer with Ollama adapter scaffold.
- Strict run state machine and explicit approval ledger.
- Cost ledger, budget guard, content review, asset readiness, and evidence bundle generation.
- Disabled voice, render, private upload, and public/scheduled publish placeholders.
- UykulukSciFi visual assets under `assets/`.
- `.ai/` operating contract for agents, workflows, design, QA, security, and roadmap state.
- CI, CodeQL, Dependabot, SonarQube, Prettier, ESLint, Vitest, Playwright, modularity, secret-scan,
  and changelog gates.
- Future Ink dependency is present for a richer CLI/TUI surface after the current commander CLI
  contracts stabilize.

## Repository Layout

```text
.
├── apps/studio/              # Next.js Producer Studio shell
├── assets/                   # Committed production visual assets and manifest docs
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
├── .ai/                      # Durable project rules, workflows, QA, and decisions
└── .github/                  # CI, CodeQL, Dependabot, Sonar workflow
```

## Safe Operating Model

- Mock mode is the default.
- Script generation requires explicit idea approval.
- Production packaging requires explicit script approval.
- Every run persists state, ledger events, costs, warnings, artifacts, and evidence under
  `runs/<run_id>/`.
- TTS, render, upload, and publish are intentionally blocked scaffolds.
- Upload and public/scheduled publish require future explicit config and separate approval gates.
- Studio must call typed local service contracts; it must not duplicate workflow state.

## Install

```bash
pnpm install
pnpm producer init
```

If your shell cannot find `pnpm` or `node`, restore Node 22/Corepack first. The repository declares
`pnpm@11.0.9` and `node >=22`.

## CLI MVP Workflow

```bash
pnpm producer ideas
pnpm producer approve idea --run <run_id> --idea <idea_id>
pnpm producer script --run <run_id>
pnpm producer review script --run <run_id>
pnpm producer approve script --run <run_id>
pnpm producer package --run <run_id>
pnpm producer estimate --run <run_id>
pnpm producer evidence --run <run_id>
pnpm producer readiness --run <run_id>
```

Inspection:

```bash
pnpm producer status --run <run_id>
pnpm producer list-runs
```

Blocked future actions:

```bash
pnpm producer voice --run <run_id>
pnpm producer render --run <run_id>
pnpm producer upload private --run <run_id>
pnpm producer publish schedule --run <run_id>
```

## Producer Studio

The first Studio shell is intentionally basic and local-only:

```bash
pnpm studio
pnpm studio:build
```

Current Studio scope:

- production desk shell;
- run/workflow command overview;
- current asset inventory summary;
- Radix module tabs for planned run, prompt, asset, and safety surfaces;
- type-safe `next-intl` request/provider foundation for English and Turkish locales;
- visible reminder that CLI/core remains the workflow source of truth.

Next Studio work should add read-only run views before any mutating route handlers.

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
pnpm test
pnpm studio:typecheck
pnpm studio:build
pnpm qa:browser
pnpm qa:modularity
pnpm security:check
pnpm changelog:check
pnpm format:check
```

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

## Run Artifacts

Each run can write:

- `ideas.json` and `ideas.md`;
- `script.md` and `script.meta.json`;
- `reviews/script_review.json` and `reviews/script_review.md`;
- `production/voiceover.txt`, `production/subtitles.srt`, `production/scenes.json`,
  `production/youtube_metadata.json`;
- `costs/estimate.json` and `costs/estimate.md`;
- `evidence_bundle.json` and `evidence_bundle.md`;
- `diagnostics/readiness.json` and `diagnostics/readiness.md`;
- `ledger.jsonl`.

Generated run directories are ignored except `runs/.gitkeep`.

## Branch And Release Policy

- Initial bootstrap may be committed on `main`.
- After the first push, use module-scoped branches such as `feat/studio-run-detail`,
  `fix/core-approval-ledger`, `ci/codeql-hardening`, or `docs/asset-inventory`.
- Use Conventional Commits.
- Keep `CHANGELOG.md` and the `<!-- version list -->` marker intact.
- Release phase `0.1.x` covers CLI MVP hardening, Studio foundation, browser QA, docs, and tooling.

## License

GNU Lesser General Public License v3.0. See [LICENSE](LICENSE).
