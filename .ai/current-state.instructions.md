# Current State

## Implemented

- TypeScript CLI project.
- Mock-first provider layer with Ollama adapter scaffold.
- Typed runtime loading of tracked `.ai/prompts/` defaults for ideas, scripts, and production
  packages, with prompt key/source/hash provenance.
- Strict run state machine.
- Schema-validated run records with atomic JSON replacement.
- Canonical bounded run-ID validation before state, ledger, artifact, or cost path construction;
  persisted run IDs must match their containing directory.
- Canonical bounded artifact-relative path validation before run artifact reads, writes, ledger
  events, or state persistence.
- Approval ledger.
- Content-addressed script review and approval; packaging rejects changed script content.
- Attributable script revisions with before/after snapshots, stale review/approval invalidation, and
  evidence-bundle visibility.
- Cost ledger and budget guard, including provider-call preflight for ideas, scripts, and production
  packages using stage pricing estimates.
- Versioned future paid-generation cost quote bundles bound to the production package, relevant
  config, enabled stage pricing, budgets, and exact JSON-plus-Markdown digest; approval is explicit
  and content-addressed.
- Versioned production-package manifests bind the approved script and prompt/provider provenance to
  exact voiceover, subtitle, scene, YouTube metadata, and package-Markdown digests.
- Project-wide atomic cost reservations with one-time approved quote-line consumption, operation-id
  idempotency, active-reservation hard-budget accounting, integer USD micros, recoverable
  settlement, uncertain outcomes, and explicit reconciliation.
- Script content review heuristics, including clickbait title warnings.
- Brand, overlay, intro, and outro asset inventory checks.
- Production package generation with complete manifest creation after all derived artifacts are
  persisted.
- Evidence bundle generation with production-package integrity status and manifest digest.
- Readiness diagnostics that strictly parse and revalidate persisted cost quotes, live hard budgets,
  complete production-package integrity, and exact paid-generation cost approval when required.
- Final readiness diagnostics agree with the post-transition run state.
- Disabled voice, render, upload, and publish placeholders.
- Basic Next.js Producer Studio shell under `apps/studio`.
- Visual asset pack imported under `assets/`.
- Clean-copy usage smoke script.
- Direct mock/Ollama provider diagnostics and upload/publish safeguard tests.
- `producer doctor` project diagnostics with durable local JSON/Markdown evidence for config,
  provider/model availability, assets, and publish defaults.
- Project-local capability inventory and routing for engineering, product, design, marketing, data,
  security, testing, research, release, browser QA, and swarm orchestration.
- Explicit frontend taste routing for public pages, cinematic landing pages, Google Stitch design
  generation, and legacy compatibility, while keeping Producer Studio on its operator-focused design
  system.
- Durable long-task checkpoints and context-budget rules that avoid reloading the full host
  capability catalog or forking oversized threads.
- CI high-severity dependency audit.
- CodeRabbit, GitHub Actions, CodeQL, Dependabot, SonarQube, Prettier, ESLint,
  eslint-config-prettier, Vitest, Playwright, TypeScript, modularity, secret-scan, changelog, and
  release hygiene gates.
- Studio has Tailwind CSS v4, shadcn-style config/primitives, Radix Tabs, lucide icons, GSAP, and
  `next/font` wired for the initial shell.
- Studio has a type-safe `next-intl` request/provider foundation with English and Turkish locale
  selection through a local cookie. Existing operator copy has not been migrated yet.
- Roadmap and `.ai` guidance now include future Next.js Producer Studio, prompt editing, revision
  tracking, design direction, development preferences, versioning expectations, and Computer Use QA
  boundaries.
- CodeRabbit is configured to auto-suggest and auto-assign `ogiboy` for PR review.
- Local SonarQube configuration targets project `uykuluk-scifi`; manual SonarCloud scans target
  `ogiboy_uykuluk-scifi`.
- `pnpm sonar` has successfully uploaded at least one local analysis to
  `http://localhost:9000/dashboard?id=uykuluk-scifi`.

## Current Commands

```bash
pnpm producer init
pnpm producer doctor
pnpm producer ideas
pnpm producer approve idea --run <run_id> --idea <idea_id>
pnpm producer script --run <run_id>
pnpm producer revise script --run <run_id> --file <path> --reason "<reason>" --editor <name>
pnpm producer review script --run <run_id>
pnpm producer approve script --run <run_id>
pnpm producer package --run <run_id>
pnpm producer estimate --run <run_id>
pnpm producer approve cost --run <run_id>
pnpm producer evidence --run <run_id>
pnpm producer readiness --run <run_id>
pnpm producer status --run <run_id>
pnpm producer list-runs
pnpm producer voice --run <run_id>
pnpm producer render --run <run_id>
pnpm producer upload private --run <run_id>
pnpm producer publish schedule --run <run_id>
pnpm studio
pnpm qa:browser
```

## Validation

Use:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm qa:usage
pnpm qa:browser
```

If the shell does not expose `node` or `pnpm`, use the Codex bundled Node path or restore
Corepack/PATH before treating failures as product failures.

## Known Limits

- Ollama doctor checks server reachability and configured model inventory, but live local-model QA
  is environment-dependent and not part of CI.
- Paid provider execution is not implemented. Exact cost quote approval remains separate from spend
  authorization. The internal reservation lifecycle exists, but the first paid adapter must use it
  immediately before every provider request and settle or reconcile every outcome; no CLI mutation
  command exposes this internal boundary yet.
- Current Next.js Studio is a basic shell only; read-only run detail routes and service contracts
  are not implemented yet.
- Locale infrastructure is ready, but full translation catalogs and a language selector are
  intentionally deferred.
- Prompt editing UI is planned but not implemented.
- Local prompt overrides and revision history are not implemented; tracked defaults are read-only
  runtime inputs.
- Revision contracts for subtitles, scenes, popup cards, and YouTube metadata are not implemented.
- TTS, render, upload, and publish are intentionally disabled scaffolds.
- Brand, overlay, thumbnail, background, transition, icon, waveform, intro-frame, and outro-frame
  assets are present. Editable source files, rendered intro/outro clips, and font licensing notes
  remain useful additions.
- Sonar scan upload requires a local or cloud token through `SONAR_TOKEN` or Keychain; tokens must
  never be tracked.
