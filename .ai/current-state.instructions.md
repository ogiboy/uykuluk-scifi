# Current State

## Implemented

- TypeScript CLI project.
- Mock-first provider layer with Ollama adapter scaffold.
- Typed runtime loading of tracked `prompts/defaults/` product prompt defaults for ideas, scripts,
  and production packages, with prompt key/source/hash provenance.
- Strict run state machine.
- Schema-validated run records with atomic JSON replacement.
- Zod 4-native runtime schemas with strict persisted objects, ISO timestamp validation, current
  top-level format validators, and a regression test rejecting deprecated or legacy Zod 3 APIs.
- Canonical bounded run-ID validation before state, ledger, artifact, or cost path construction;
  persisted run IDs must match their containing directory.
- Canonical bounded artifact-relative path validation before run artifact reads, writes, ledger
  events, or state persistence.
- Canonical existing-component symlink containment for the `runs/` root, run directories, internal
  directories, state, ledgers, reservation lock, and artifacts before filesystem access.
- Final regular files with multiple hard links are rejected before reads, writes, or append-only
  ledger mutation.
- Atomic temporary-file replacement for JSON and text artifact writes.
- Approval ledger.
- Content-addressed script review and approval; non-blocking review warnings require explicit
  acknowledgement before script approval, and packaging rejects changed script content.
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
- Internal adapter-bound reserved-provider execution with a durable `EXECUTION_STARTED` claim,
  provider/model quote matching, local at-most-once callback dispatch, bounded timeout/abort,
  fail-closed unknown outcomes, exact settlement, and hashed request-id evidence.
- Script content review heuristics, including clickbait title warnings, long-form shortfall
  warnings, and blockers for incomplete or English-labeled provider output.
- Script review Markdown shows the next safe approval command or blocker remediation guidance.
- Brand, overlay, intro, and outro asset inventory checks.
- Production package generation with complete manifest creation after all derived artifacts are
  persisted.
- Provider-backed idea and production-package stages schema-validate and normalize common Ollama
  JSON variants before artifact writes, while rejecting malformed or English operator-facing
  payloads fail-closed.
- Ollama provider config supports `thinkingMode` (`default`, `think`, `no_think`) and stage-specific
  `maxOutputTokens` caps that are passed to Ollama as `num_predict`.
- Script generation uses bounded hook/context/development/outro provider calls, writes
  `script.sections.json` draft and expansion-chunk receipts, and assembles `script.md` only after
  all sections pass blocking quality checks.
- Live local Ollama qwen3:8b smoke tests on 2026-06-23 verified safe idea generation, explicit idea
  approval, chunked section script generation, receipt persistence, and script review in both
  `no_think` and `think` modes without upload, render, or publish actions.
- Evidence bundle generation with production-package integrity status and manifest digest.
- Evidence next-command guidance reflects script review blockers and required warning
  acknowledgement before script approval.
- Readiness diagnostics that strictly parse and revalidate persisted cost quotes, live hard budgets,
  complete production-package integrity, and exact paid-generation cost approval when required.
- Final readiness diagnostics agree with the post-transition run state.
- Disabled voice, render, upload, and publish placeholders.
- Basic Next.js Producer Studio shell under `apps/studio`.
- Visual asset pack imported under `assets/`.
- Clean-copy usage smoke script.
- Production build emits a Node-runnable `dist/cli.js` and `pnpm build:smoke` verifies the built CLI
  starts and can initialize a fresh project from an arbitrary working directory.
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
pnpm producer approve script --run <run_id> --acknowledge-warnings # when review warnings remain
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
  is environment-dependent and not part of CI. Live qwen3:8b QA on 2026-06-23 verified that
  `no_think` reached `SCRIPT_REVIEWED` with 966 words and `think` reached `SCRIPT_REVIEWED` with 715
  words. Current qwen3:8b drafts remain short and may carry content-review warnings such as
  long-form shortfall, fact-check needs, or weak intro hooks; further prompt tuning or a long-form
  continuation pass is still needed before treating local model scripts as production quality.
- No paid provider adapter is implemented. Exact cost quote approval remains separate from spend
  authorization. The internal execution boundary is ready for a future approved adapter, but no SDK,
  credential, network integration, or CLI mutation command exposes it.
- Current Next.js Studio is a basic shell only; read-only run detail routes and service contracts
  are not implemented yet.
- Locale infrastructure is ready, but full translation catalogs and a language selector are
  intentionally deferred.
- Prompt editing UI is planned but not implemented.
- Local prompt overrides and revision history are not implemented; tracked defaults are read-only
  runtime inputs.
- Revision contracts for subtitles, scenes, popup cards, and YouTube metadata are not implemented.
- TTS, render, upload, and publish are intentionally disabled scaffolds.
- Run-path containment blocks pre-existing symbolic links. Hostile concurrent path replacement
  remains a local TOCTOU limitation because portable Node APIs do not expose directory-handle
  `openat` semantics.
- Brand, overlay, thumbnail, background, transition, icon, waveform, intro-frame, and outro-frame
  assets are present. Editable source files, rendered intro/outro clips, and font licensing notes
  remain useful additions.
- Sonar scan upload requires a local or cloud token through `SONAR_TOKEN` or Keychain; tokens must
  never be tracked.
