# Studio Audit And Remediation

## Objective

Reconcile the current Studio branch with the last 50 requested task decisions and the latest ten
repository pull requests, preserve compatible local changes, finish the incomplete Sentry setup,
close still-valid review findings, and keep Studio a guarded local operator surface over CLI/core.

## Completion Criteria

- Sentry is optional, privacy-safe, build-safe without credentials, and used only for diagnostics.
- Studio session and mutation routes remain local, same-origin, typed, bounded, and fail-closed.
- Valid PR #132/#133 findings are fixed or explicitly rejected with current-code evidence.
- shadcn/Tailwind primitives and responsive operator flows remain coherent.
- README, ROADMAP, `.ai` architecture/current-state/tasks/decisions, and this checkpoint match code.
- Targeted tests pass, then `pnpm check`, `pnpm qa:usage`, `pnpm version:plan`, relevant Sonar, and
  rendered Studio browser QA pass before push-ready handoff.

## Audit-Start State

- Branch/worktree: `feat/studio-control-surface-polish` at this worktree.
- Audited base commit: `65001df7f4ffffe9477714e5fa8b5755da5b5747`.
- Audit/remediation evidence finalized at `2026-07-11T02:56:58+03:00` before the final Git commit.
- Branch relation at audit start: 69 commits ahead and 14 commits behind `origin/main`.
- Existing local changes cover dependency updates, Studio session hardening, bounded CLI output,
  typed action metadata, idea-history Tailwind cleanup, security-skill routing, and UAT helpers.
- The accidental untracked `apps/ios/` experiment was removed with operator approval.
- The Sentry wizard did not complete: no SDK/config/instrumentation existed; its ignored credential
  file was moved outside the workspace without being read.
- Baseline evidence at audit start: Studio typecheck passed; five targeted Studio suites passed
  20/20; root typecheck exposed two UAT callers that still invoked the session route without a
  `Request`. Those callers are now repaired.

## Decisions

- CLI/core remains the only workflow/state/approval/cost/evidence authority.
- Studio may run guarded local CLI/core-backed actions, including doctor and local model evaluation;
  affected read-only-only documentation must be corrected instead of removing intentional web
  actions.
- Sentry is append-only observability. It must never gate progression, inspect artifact bodies, or
  become required for local operation.
- `.ai`, security skills, and their review evidence remain development-only.
- Keep the project-local security skill lock and ignore installed skill bodies; do not package them.
- Preserve grounded fail-safe behavior; remove masking fallbacks and broad error suppression.

## Completed Remediation

1. Repaired local session enforcement, UAT route calls, and CLI timeout/output classification.
2. Closed valid PR #132/#133 findings and aligned the shadcn Button/Sheet composition.
3. Installed optional Sentry runtime capture at Next/Studio boundaries with no-DSN no-op behavior.
4. Aligned durable docs, environment examples, and development-only security-skill routing.
5. Remediated the side-task findings for declared Host trust, prompt-history boundaries, local-only
   provider URLs, browser security headers, and the development-only `diff` advisory.

## Verification Evidence

- Full quality chain completed through 171 test files / 762 tests and Studio production build; the
  only first-pass failure was a three-line documentation modularity excess, corrected before the
  standalone modularity/security/release/format remainder passed.
- `pnpm qa:usage` report: `.ai/qa/artifacts/usage-smoke-20260710-233927/qa-report.md`.
- `pnpm qa:product` report: `.ai/qa/artifacts/product-uat-20260710-234014/qa-report.md`.
- `pnpm qa:browser` passed all nine browser scenarios; settled visual evidence is under
  `.ai/qa/artifacts/studio-audit/`.
- Local Sonar scan log: `.ai/qa/artifacts/sonar/sonar-npm.log`; the post-remediation quality gate
  reported OK with zero open issues.
- Final uncommitted review command: `coderabbit review --agent --type uncommitted`; valid findings
  were either remediated or covered by focused regression tests.
- The final remediation commit SHA is intentionally recorded by Git and the pull request rather than
  embedded into this pre-commit checkpoint.

## Remaining Work

1. Re-run focused checks after the final review patches.
2. Reconcile `origin/main`, commit the coherent branch bundle, and prepare the broad PR handoff.

## Blockers And Risks

- `origin/main` changed dependency versions after this branch diverged; merge conflicts are
  possible.
- Open Dependabot PRs #140/#141 currently fail quality gates and should not be folded in blindly.
- Local Sentry source-map upload still requires operator-owned credentials outside the workspace.
- Real provider/model execution is intentionally outside this audit unless a regression requires it.
