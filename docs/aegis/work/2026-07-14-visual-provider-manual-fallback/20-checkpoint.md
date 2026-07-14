# Visual Provider Manual Fallback — Checkpoint

## TodoCheckpointDraft

- Completed: PR #149 voice/aligned-subtitle slice merged with green required CI and zero Sonar
  issues.
- Completed: core visual workflow now owns deterministic 12–24 beats, static/manual revisions,
  rejected-only regeneration, exact manifest/revision mutation snapshots, decoded PNG/JPEG
  validation, and render-plan/render-approval visual digest binding.
- Completed: Studio now exposes guarded visual prepare/import/batch decision/rejected-only
  regeneration, digest-bound local media, and progressive disclosure for technical evidence.
- Verified: independent core and Studio reviews approved; 233 test files / 1,037 tests, all four
  root/Studio TypeScript lanes, and the focused cleanup regressions passed before main
  reconciliation.
- Completed: rebased onto `v0.82.0`/current `origin/main`; PR diff is 117 files.
- Verified: `pnpm check`, usage/product/browser QA, dependency audit, coverage, version plan, and a
  production-build browser run with 18 visual beats all passed.
- Active: push the clean candidate and open the PR.
- Pending: hosted CI, SonarCloud, CodeQL, and review completion.
- Next: let hosted checks supply the Sonar token unavailable to the local Keychain session.

## BaselineUsageDraft

- Required refs: parent checkpoint, task ordering, current dirty diff, visual/render/Studio owners
  and tests.
- Acknowledged: parent checkpoint and live Git/worktree state.
- Acknowledged: independent core spec review approved the final contract after removing the last new
  v2 render-approval generation path.
- Acknowledged: independent Studio specification and code-quality reviewers approved the repaired
  guarded mutation and review flow.
- Acknowledged: real Studio UAT selected and approved all 18 beats; the UI refreshed to `18/18`
  without browser console warnings/errors.
- Missing: hosted CI evidence. Local SonarCloud upload stopped before scanning because its Keychain
  token was unavailable; coverage generation itself passed.
- Decision: candidate is PR-ready, not merge-complete until hosted checks are green.

## ResumeStateHint

The branch is clean and rebased on `origin/main`. Preserve the worktree until PR checks and any
review follow-ups complete.

## DriftCheckDraft

- Scope: aligned with the visual-production slice.
- Compatibility: legacy v9 render evidence remains readable, but cannot be newly approved or
  rendered without the v10 visual binding.
- New owners: `src/stages/visuals/**` is intentional and within the approved boundary.
- Decision: core and Studio specs remain aligned after modularity repair; hosted PR verification
  remains.
