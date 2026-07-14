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
- Active: safely commit and reconcile the candidate with current `origin/main`.
- Pending: full post-rebase checks, browser/operator UAT, PR gates, push, and CI.
- Next: rebase the committed candidate, resolve overlap with merged voice work, then run PR-ready
  verification.

## BaselineUsageDraft

- Required refs: parent checkpoint, task ordering, current dirty diff, visual/render/Studio owners
  and tests.
- Acknowledged: parent checkpoint and live Git/worktree state.
- Acknowledged: independent core spec review approved the final contract after removing the last new
  v2 render-approval generation path.
- Acknowledged: independent Studio specification and code-quality reviewers approved the repaired
  guarded mutation and review flow.
- Missing: post-rebase browser/operator and hosted CI evidence.
- Decision: commit the green candidate and reconcile main; the slice is not PR-ready until the
  remaining evidence is green.

## ResumeStateHint

Preserve every current tracked and untracked visual-slice file. Do not reset, stash, or rebase the
dirty worktree. `origin/main` is four commits ahead through merged PR #149; reconcile only after the
visual candidate is internally green and safely committed.

## DriftCheckDraft

- Scope: aligned with the visual-production slice.
- Compatibility: legacy v9 render evidence remains readable, but cannot be newly approved or
  rendered without the v10 visual binding.
- New owners: `src/stages/visuals/**` is intentional and within the approved boundary.
- Decision: core and Studio specs are aligned; post-rebase end-to-end verification remains.
