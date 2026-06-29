# Producer Core Hardening

## Objective

Complete the production-quality, local-first, approval-gated UykulukSciFi Producer core while
keeping paid generation, render, upload, and public/scheduled publish fail-closed. Continue in
coherent, tested slices until the safe core and its evidence contracts are genuinely complete.

## Completion Criteria

- Required CLI workflow, approvals, safeguards, persistence, provider diagnostics, evidence, and
  readiness contracts are implemented and documented.
- Prompt and artifact edits leave attributable durable evidence and invalidate stale approvals.
- `pnpm check`, `pnpm qa:usage`, `pnpm version:plan`, and relevant security/dependency gates pass.
- Changes are committed in coherent Conventional Commit slices.
- Remaining future work is explicitly roadmap-scoped rather than silently incomplete.

## Current State

- 2026-06-29 continuation branch/worktree: `feat/render-review-command` at
  `/Users/ogiboy/.codex/worktrees/894d/uykuluk-scifi`, pushed to
  `origin/feat/render-review-command`.
- Current branch scope is intentionally broader than a single micro-feature: group related
  render-operator production-loop improvements before opening one PR, to conserve CodeRabbit/CI
  review budget.
- Completed render-operator branch slices:
  - `2fb9cbf feat(render): add ffmpeg review command evidence`
  - `14f4323 test(studio): cover render review command preview`
  - `636f4ab feat(render): print draft review handoff`
  - `f828e2a feat(render): add read-only render review command`
  - `0546158 test(render): cover draft review handoff smoke`
  - `f7ca5db feat(render): surface draft review commands`
  - `cabdb55 feat(render): persist draft review command evidence`
- `producer render` now prints a local-only review handoff, the render manifest records a stable
  read-only FFmpeg review command for the final draft artifact separately from temp-output execution
  args, and `producer review render --run <run_id>` replays the validated handoff without mutating
  run state. CLI status, evidence Markdown, Studio production media summaries, and draft-render
  evidence JSON now retain review handoff details without enabling upload or publish.
- Active PR branch/worktree on 2026-06-25: `feat/local-production-workflow-hardening` at
  `/private/tmp/uykuluk-commit-work-20260624153047`.
- Active product slice moved from safe-core-only work into local production-loop hardening: bounded
  script continuation, local-provider fail-closed guards, Sonar/IDE quality cleanup, and live Ollama
  QA evidence.
- Base: `v0.2.1` / `origin/main`; PR #22 carries the local production workflow hardening commits.
- Earlier completed hardening includes content-addressed script approval and revisions,
  budget/readiness enforcement, atomic state writes, prompt provenance/runtime templates,
  provider/publish tests, dependency audit, diagnostics synchronization, and content/asset guards.
- Completed slice: `30986f8 feat(core): add paid generation cost approvals`.
- Completed slice: `e155b02 feat(core): add atomic cost reservations`.
- Completed slice: `f16e643 fix(core): validate run identifiers`.
- Completed slice: `3c04cdd fix(core): constrain artifact paths`.
- Completed slice: `66d2095 feat(core): verify production package integrity`.
- Completed slice: `2f9e34c refactor(core): modernize Zod schemas`.
- Completed slice: `a046523 fix(core): contain linked run paths`.
- Active slice: internal reserved-provider callback execution contract without enabling a paid
  provider or operator command.
- Worktree was clean before the reserved-provider execution slice.

## Verification Evidence

- Baseline on 2026-06-19: `pnpm test` passed 48/48 and `pnpm typecheck` passed before edits.
- Three independent read-only reviews agreed that approval must bind an exact persisted quote and
  that paid execution must remain disabled until atomic reservation/settlement exists.
- Current plan: `.ai/plans/2026-06-19-paid-generation-cost-approval.md`.
- Strict TDD added 7 paid-generation cost approval tests; focused cost/readiness/mock tests and
  typecheck pass.
- `pnpm check` passed with 56/56 tests, Studio production build, modularity, secret scan, changelog,
  and formatting.
- `pnpm qa:usage`, `pnpm version:plan`, and `pnpm security:dependencies` passed; the latest ignored
  smoke report is `.ai/qa/artifacts/usage-smoke-20260619-050114/qa-report.md`.
- A diff-scoped Codex Security scan reviewed all 12 executable/test worklist rows and reported no
  surviving findings after JSON-plus-Markdown quote binding was added.
- Current plan: `.ai/plans/2026-06-19-cost-reservation-lifecycle.md`.
- Focused reservation, recovery, budget, approval, and mock tests pass (25/25); typecheck and the
  156-file modularity gate pass.
- The reservation diff security review closed all 14 worklist rows, reproduced and fixed a
  live-owner stale-lock race, and produced validated Markdown/HTML reports with no surviving
  reportable findings.
- Final gates pass: `pnpm check` with 69/69 tests and Studio production build, `pnpm qa:usage`,
  `pnpm version:plan`, `pnpm security:dependencies`, `pnpm release:check`, and `git diff --check`.
- Latest ignored usage report: `.ai/qa/artifacts/usage-smoke-20260619-053319/qa-report.md`.
- Current plan: `.ai/plans/2026-06-19-run-id-path-validation.md`.
- Strict TDD captured 15 initial failures for malformed IDs and state-directory mismatch, then
  broadened to unrelated run-directory enumeration and CLI coverage.
- Final gates pass: `pnpm check` with 89/89 tests and Studio production build, `pnpm qa:usage`,
  `pnpm version:plan`, `pnpm security:dependencies`, `pnpm release:check`, and `git diff --check`.
- Latest ignored usage report: `.ai/qa/artifacts/usage-smoke-20260619-114340/qa-report.md`.
- Diff-scoped security review closed all 9 executable/test/supporting rows with validated
  Markdown/HTML reports and no surviving reportable findings.
- Current plan: `.ai/plans/2026-06-19-artifact-path-validation.md`.
- Strict TDD captured 20 initial failures for lexical paths, outside-write side effects, and
  persisted-state tampering; security review added 6 failing portable-name regressions.
- Final gates pass: `pnpm check` with 121/121 tests and Studio production build, `pnpm qa:usage`,
  `pnpm version:plan`, `pnpm security:dependencies`, `pnpm release:check`, modularity, secret scan,
  changelog, formatting, and security report validation.
- Latest ignored usage report: `.ai/qa/artifacts/usage-smoke-20260619-115623/qa-report.md`.
- Diff-scoped security review closed all 6 executable/test/supporting rows, reproduced and fixed
  Windows reserved-device/trailing-dot aliases, and produced validated Markdown/HTML reports with no
  surviving reportable findings.
- Current plan: `.ai/plans/2026-06-19-production-package-integrity.md`.
- Strict TDD added complete-package manifest coverage for generation, modification/deletion of every
  derived artifact, missing/foreign/changed manifests, approved-script drift, readiness state
  preservation, and evidence block reporting.
- Final gates pass: `pnpm check` with 143/143 tests and Studio production build, `pnpm qa:usage`,
  `pnpm version:plan`, `pnpm security:dependencies`, `pnpm release:check`, modularity, secret scan,
  changelog, formatting, and `git diff --check`.
- Latest ignored usage report: `.ai/qa/artifacts/usage-smoke-20260619-121222/qa-report.md`.
- Diff-scoped security review closed all 7 executable/test/supporting rows, reproduced and fixed a
  missing-manifest evidence projection gap, and produced validated Markdown/HTML reports with no
  surviving reportable findings:
  `/tmp/codex-security-scans/uykuluk-scifi/d4a7e61a4ecf_20260619T120922Z/report.html`.
- Zod 4 documentation and installed 4.4.3 declarations confirmed top-level string formats,
  `z.strictObject`, and `z.int` as current replacements for project v3-style APIs.
- Strict TDD first found 22 deprecated or legacy schema usages; the regression gate and 51 focused
  schema/workflow tests pass after migration.
- Final gates pass: `pnpm check` with 144/144 tests and Studio production build, `pnpm qa:usage`,
  `pnpm version:plan`, `pnpm security:dependencies`, `pnpm release:check`, and `git diff --check`.
- Latest ignored usage report: `.ai/qa/artifacts/usage-smoke-20260619-165149/qa-report.md`.
- Current plan: `.ai/plans/2026-06-19-symlink-containment.md`.
- Strict TDD captured failures for symbolic links at the runs root, run directory, state file,
  intermediate artifact directory, final artifact, core ledger, and reservation lock. Security
  review then reproduced hard-link bypasses for all three append-only ledgers.
- Final gates pass: `pnpm check` with 156/156 tests and Studio production build, `pnpm qa:usage`,
  `pnpm version:plan`, `pnpm security:dependencies`, `pnpm release:check`, and `git diff --check`.
- Latest ignored usage report: `.ai/qa/artifacts/usage-smoke-20260619-171824/qa-report.md`.
- Diff-scoped security review closed all 10 executable/test/supporting rows, reproduced and fixed
  hard-linked core, cost, and reservation ledger access, and produced validated Markdown/HTML
  reports with no surviving reportable findings:
  `/tmp/codex-security-scans/uykuluk-scifi/bd00db439703_20260619T171338Z/report.html`.
- Current plan: `.ai/plans/2026-06-23-reserved-provider-execution.md`.
- Three independent read-only reviews converged on a durable `EXECUTION_STARTED` reservation state,
  adapter provider/model quote matching, and local at-most-once callback dispatch.
- Strict TDD first failed because the composed execution owner did not exist. Focused execution,
  reservation, recovery, budget, cost-approval, mock-workflow, and readiness coverage now passes
  48/48; typecheck and the 176-file modularity gate pass.
- Independent post-implementation review found and fixed timeout/abort outcome ordering, overly
  broad release authority after callback claim, settled receipt-hash mismatch acceptance, raw
  provider request-id persistence, and low-level provider/stage import pressure.
- Current full gates pass: `pnpm check` with 175/175 tests and Studio production build,
  `pnpm qa:usage`, `pnpm version:plan`, `pnpm security:dependencies`, `pnpm release:check`, and
  `git diff --check`.
- Latest ignored usage report: `.ai/qa/artifacts/usage-smoke-20260623-131633/qa-report.md`.
- Current full gates on 2026-06-24 pass: `pnpm check` with 235/235 tests and Studio production
  build, `pnpm qa:usage`, `pnpm version:plan`, `pnpm security:dependencies`, and local `pnpm sonar`
  with Quality Gate `OK` (`new_coverage=81.8`, `new_violations=0`).
- Live Ollama qwen3:8b `think` QA in `/private/tmp/uykuluk-live-ollama-think-Ye7tTz` passed
  `producer doctor`, then exposed duplicated idea premises. The duplicate-idea parser guard was
  added by strict TDD and the repeat live `ideas` run failed closed before artifact advancement with
  `Invalid ideas provider response: ideas.6.premise: Ideas must be meaningfully distinct.`
- Follow-up live idea QA after prompt tuning: `/private/tmp/uykuluk-live-ollama-ideas-smq4GF`
  produced eight ideas but remained weak; `/private/tmp/uykuluk-live-ollama-ideas3-BHWNsi` failed
  closed on a common `UykulukSciFi` typo; after deterministic brand typo normalization,
  `/private/tmp/uykuluk-live-ollama-ideas4-b02dQ6` failed closed on duplicate titles. New guards
  cover common brand typo normalization, repeated generic title motifs, and repeated premise frames.
- Latest ignored usage report: `.ai/qa/artifacts/usage-smoke-20260624-090515/qa-report.md`.
- Current targeted verification after bounded idea retry/repair: `pnpm lint`, `pnpm typecheck`,
  `pnpm format:check`, focused provider/workflow tests, full `pnpm test` with 41/41 files and
  241/241 tests, and `pnpm qa:modularity` all pass. The new regression coverage proves one repair
  retry can recover from invalid local-model ideas, records repair evidence, and still fails closed
  without artifacts if the repair response remains invalid.
- Live Ollama qwen3:8b `think` retry smoke in `/private/tmp/uykuluk-live-ollama-repair-chgzu4`
  passed `producer doctor` and exercised the new retry path. The first response failed on
  `ideas.3.premise: Ideas reuse a repeated premise frame`; the repair response failed on
  `ideas.3.title: Repeated title motif "yıldız" weakens idea diversity`; the run remained `NEW`,
  `ideas.json` was not written, and the ideas ledger contains one retry warning plus the final
  error.
- Current full gates on 2026-06-24 after SonarLint cleanup and the second bounded idea-repair
  attempt pass: targeted Vitest 86/86, `pnpm check` with 41/41 test files and 243/243 tests, Studio
  production build, `pnpm qa:usage`, `pnpm version:plan`, `pnpm security:dependencies`,
  `git diff --check`, and local `pnpm sonar:local`. Local Sonar Quality Gate is `OK`
  (`new_coverage=82.1`, `new_duplicated_lines_density=0.48799`, `new_violations=0`,
  `OPEN_ISSUES=0`). The scan log is the ignored local artifact
  `.ai/qa/artifacts/sonar/sonar-npm.log`.
- Live Ollama qwen3:8b QA after forced repair slots:
  `/private/tmp/uykuluk-live-ollama-two-repair-wqJuwT` proved the two-attempt loop fails closed
  without ideas when all repairs remain invalid;
  `/private/tmp/uykuluk-live-ollama-forced-slots-BpoQih` proved one repair can recover to
  `IDEAS_GENERATED`; subsequent manual review found repeated sentences, malformed brand fragments,
  copied English lane terms, and duplicated `fit` copy, so new idea-quality guards were added.
- Latest live Ollama qwen3:8b QA path: `/private/tmp/uykuluk-live-ollama-fit-guard-e5QSfl`.
  `producer doctor` passed, ideas generated after two repair warnings, and a temp QA approval of
  `idea_003` exercised script generation in both `no_think` and `think`. Both script attempts failed
  closed without `script.md`. `no_think` hit `repeated_sentence_loop`; the first `think` attempt
  reached continuation and hit `Invalid script continuation provider response: expected JSON`. After
  adding bounded malformed `"text"` wrapper recovery for local-model continuation payloads, the
  latest `think` retry no longer stopped at `expected JSON` and failed closed on
  `repeated_sentence_loop`. The run stayed at `IDEA_APPROVED`, and
  `diagnostics/script_generation_failure.json` contains safe provider/mode/state diagnostics.

## Decisions

- Fewer, broader PRs are preferred for related product slices. Continue slice-by-slice commits, but
  delay PR creation until a coherent feature group is implemented and risk-based local validation is
  complete.
- Treat time as an engineering budget: run targeted checks after small slices, and reserve full
  `pnpm check` / `pnpm qa:usage` / browser-heavy checks for PR-readiness or merge-adjacent points.
- Current product focus is the real local production loop and operator handoff quality, not more
  standalone security/code-quality cleanup unless it blocks active product work.
- `src/costs/` owns cost quote shape and fingerprints; core state/ledger owns approval authority.
- Cost approval covers future paid production stages after package generation only.
- Cost approval does not authorize or execute a provider call.
- Hard budgets remain non-overridable and must be rechecked at readiness and future execution.
- Paid execution remains disabled until the first adapter uses reservation as its only provider-call
  path and proves failure/timeout behavior.

## Latest Verification

- 2026-06-29 render-operator branch targeted verification:
  - Verified render handoff and read-only render review command changes with
    `pnpm test tests/renderCli.test.ts tests/render.test.ts tests/renderApprovalGate.test.ts`.
  - Confirmed pre-commit gates with
    `pnpm lint && pnpm typecheck && pnpm qa:modularity && pnpm changelog:check && pnpm release:check && pnpm format:check`
    before committing `feat(render): print draft review handoff` and
    `feat(render): add read-only render review command`.
  - Added usage-smoke coverage for `producer review render`, then ran
    `pnpm lint && pnpm qa:modularity && pnpm format:check`.
  - Confirmed final-artifact FFmpeg review command persistence with
    `pnpm test tests/render.test.ts tests/evidenceMarkdown.test.ts tests/statusOutput.test.ts tests/studioRuns.test.ts tests/renderCli.test.ts`.
  - `pnpm qa:usage` passed; latest ignored report:
    `.ai/qa/artifacts/usage-smoke-20260628-223132/qa-report.md`.
  - Re-ran
    `pnpm lint && pnpm typecheck && pnpm qa:modularity && pnpm changelog:check && pnpm release:check && pnpm format:check`
    for the same slice.
  - Confirmed rendered-run next actions use `pnpm producer review render --run <run_id>` with
    `pnpm test tests/evidenceNextCommand.test.ts tests/statusOutput.test.ts tests/studioRuns.test.ts tests/renderCli.test.ts tests/evidenceMarkdown.test.ts`.
  - `pnpm qa:usage` passed again; latest ignored report:
    `.ai/qa/artifacts/usage-smoke-20260628-223649/qa-report.md`.
  - `pnpm qa:modularity && pnpm format:check` and `pnpm changelog:check && pnpm release:check`
    passed for the same next-action slice; the broader lint/typecheck chain had already passed
    before the modularity-only line-count failure was corrected.
  - PR-ready verification for `feat/render-review-command` passed on 2026-06-29: `pnpm check` (102
    test files, 474 tests, Studio build included), `pnpm qa:usage`
    (`.ai/qa/artifacts/usage-smoke-20260628-224007/qa-report.md`), `pnpm version:plan`
    (`nextVersion: 0.48.0`), and `pnpm security:dependencies`.
  - PR #95 review/quality follow-up fixed the draft-render review command boundary: rendered-run
    next actions are executable-only, the FFmpeg review handoff reads the final MP4 with `-f null`
    instead of reusing temp-output render args, persisted review command/args are recomputed and
    tamper-checked before evidence or `producer review render` can pass, and legacy pass evidence
    without `ffmpegReviewCommand` is invalid.
  - Follow-up verification passed: targeted render/review/status/Studio/shell tests (43 tests), full
    `pnpm test` (104 files, 480 tests), `pnpm test:coverage`, `pnpm check`, `pnpm qa:usage`
    (`.ai/qa/artifacts/usage-smoke-20260628-232140/qa-report.md`), `pnpm version:plan`
    (`nextVersion: 0.48.0`), and `pnpm security:dependencies`.
  - Browser smoke and remote CI are intentionally left to PR/CI review; do not wait on them in this
    thread unless a failure is reported.
- `pnpm check` passes with 44 test files and 261 tests.
- `pnpm qa:usage`, `pnpm version:plan`, and `pnpm security:dependencies` pass; latest usage smoke
  report is `.ai/qa/artifacts/usage-smoke-20260624-120510/qa-report.md`.
- `pnpm sonar:local` submits successfully; local Quality Gate is `OK` with `new_violations=0`,
  `new_coverage=83.0`, `new_duplicated_lines_density=0.4661`, and unresolved issue count `0`.
- Script expansion prompts now pass previous chunks from the same section into the next expansion
  call; targeted regression coverage verifies the prompt includes an "already written" section so
  local models have explicit anti-repetition context.
- Script blocker diagnostics now include section/pass/chunk context for provider text that fails
  content review, while continuing to omit raw provider output.
- Live qwen3:8b `think` retry after these diagnostics stayed fail-closed without `script.md`, and
  now reports
  `Invalid script section expansion chunk 1 provider response for development: blocking findings: malformed_production_label.`
- Exact production-label discipline is now stricter: prompts include a checklist that permits only
  `Anlatıcı:` and `Görsel:`, and content guards reject unaccented labels such as `Anlatici:` and
  `Gorsel:`.
- Live qwen3:8b `think` retry after exact-label tightening stayed fail-closed without `script.md`
  and reported
  `Invalid script section expansion chunk 1 provider response for context: blocking findings: malformed_production_label.`
  Prompt-only label discipline is therefore insufficient for this model; the next design choice is
  strict regeneration versus an auditable bounded label-repair step.
- Bounded label repair is now implemented for known local-model variants and records count/variant
  evidence in `script.sections.json` receipts without persisting raw provider output. Unrelated
  malformed labels remain blockers.
- Live Ollama qwen3:8b `no_think` QA on 2026-06-24 in
  `/private/tmp/uykuluk-live-ollama-current-nFMiuN` passed `producer doctor`, generated eight ideas,
  recorded explicit approval for `idea_001`, and then exercised repeated script retries against the
  same `IDEA_APPROVED` run. The first retry failed closed at
  `Invalid script continuation chunk 1 provider response: expected JSON`; broader bounded malformed
  `"text"` wrapper recovery fixed that class in targeted regression coverage and moved the live
  failure to content quality blockers. The next retry failed on `outro` expansion chunk 3 with
  `repeated_sentence_loop`; after stricter anti-loop prompt context, the latest retry failed closed
  on `development` expansion chunk 1 with `malformed_production_label`. The run stayed
  `IDEA_APPROVED`, no `script.md` was written, and `diagnostics/script_generation_failure.json`
  contains safe provider/mode/state diagnostics.
- Script continuation parsing now has regression coverage for raw Turkish continuation text, fenced
  raw text, malformed `"text"` wrappers, trailing commas, missing closing quotes, and short external
  notes. Script section expansion prompts now explicitly prohibit repeated sentence skeletons,
  metaphors, and visual directions across draft and previous chunks.
- Malformed production-label blockers now carry safe diagnostic categories (`labelFamily`,
  `labelIssue`) in warning details and formatted script failure messages without persisting raw
  provider labels. Regression coverage proves unknown related labels are classified without leaking
  the original label text.
- A later live retry against the same `/private/tmp/uykuluk-live-ollama-current-nFMiuN` run after
  this diagnostics change again stayed fail-closed without `script.md`; the failure moved to
  assembled-script review with `repeated_sentence_loop`, confirming qwen3 output remains
  nondeterministic and production quality still needs prompt/label/repetition tuning.
- Repeated sentence-loop blockers now also carry safe diagnostic categories (`repeatCount`,
  `sentenceFingerprint`) in warning details and formatted script failure messages without persisting
  repeated provider text. A follow-up live retry against the same run stayed fail-closed and
  reported `repeated_sentence_loop(repeatCount=3;sentenceFingerprint=d425f4180b4005fa)` while
  remaining `IDEA_APPROVED` with no `script.md`.
- Script section and continuation content blockers now get one bounded retry. The retry prompt uses
  only the safe blocker summary and accepted context, not the rejected raw provider output. Accepted
  receipts persist `blockerRetry` evidence with rejected-attempt prompt/content hashes, token
  estimates, and duration; repeated invalid output still fails closed without `script.md`.
- Live qwen3:8b `no_think` QA after this retry slice used
  `/private/tmp/uykuluk-live-ollama-current-nFMiuN` and still failed closed without `script.md`. The
  latest retry reached `outro` expansion chunk 3 and reported
  `repeated_sentence_loop(repeatCount=3;sentenceFingerprint=be3048d09737d3ab) after 1 retry`. State
  stayed `IDEA_APPROVED`; diagnostics and ledger did not contain raw provider text.
- Commit is still blocked by sandbox git-index permissions:
  `/Users/ogiboy/Documents/uykuluk-scifi/.git/worktrees/uykuluk-scifi1/index.lock` cannot be created
  from this worktree.

## Remaining Work

1. Continue the current `feat/render-review-command` branch with one or two more product-facing
   render-operator production-loop slices if they materially improve reviewable draft production.
2. Before opening the grouped PR, refresh from `origin/main`, run broader gates in proportion to
   accumulated scope (`pnpm check`, `pnpm qa:usage`, `pnpm version:plan`), then open a single PR.
3. After the PR opens, review CodeRabbit/GitHub comments and fix still-valid findings in the same PR
   instead of opening follow-up micro PRs.
4. Continue qwen3 prompt/label/repetition hardening only when model/runtime evaluation work is
   explicitly resumed. Current live ideas can pass parser after repair but remain weak for
   production approval, and real `no_think` script retries still fail closed on malformed production
   labels or assembled repeated sentence loops.

## Blockers And Risks

- No real paid adapter, SDK, credential policy, or operator command exists. The internal callback
  contract covers local dispatch and failure semantics, but external provider idempotency and charge
  confirmation remain adapter-specific future work.
- Reservation writes are serialized locally, but JSONL ledgers are not cryptographically
  tamper-evident and the lock is not a distributed lease.
- Existing-component symlink containment cannot prevent a hostile local process from racing path
  replacement between validation and access; portable Node APIs do not expose directory-handle
  `openat` semantics.
- Production-package manifests provide consistency, not authenticity; cryptographic tamper evidence
  remains separate roadmap work.
- Current sandbox cannot stage or commit because the common worktree git index is outside the
  writable root. Safe fallback is to preserve the dirty worktree and avoid claiming a committed
  slice until the user or host grants git write access.
- qwen3:8b remains useful for fail-closed local QA but is not yet producing production-ready ideas
  reliably; prompt tuning is still required before approving another live idea.
