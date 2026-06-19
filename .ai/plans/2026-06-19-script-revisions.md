# Script Revision Evidence Plan

## Goal

Add an explicit `producer revise script` workflow that makes operator script edits attributable,
reviewable, and recoverable without bypassing review or approval gates.

## Architecture

- `src/revisions/scriptRevision.ts` owns script revision validation, snapshots, invalidation, and
  durable metadata.
- `src/core/transitions.ts` allows only `SCRIPT_REVIEWED` and `SCRIPT_APPROVED` to return to
  `SCRIPT_GENERATED` through the revision owner.
- `src/cli.ts` reads the requested content file and delegates to the revision owner.
- `src/stages/evidence.ts` lists revision metadata as first-class run evidence.
- Existing review files are retained on disk and snapshotted; they are removed from the active
  artifact index until review reruns.

## Tech Stack

TypeScript, Commander, file-backed JSON/Markdown artifacts, JSONL ledger, Vitest.

## Baseline / Authority Refs

- `AGENTS.md`
- `.ai/architecture.instructions.md`
- `.ai/runbooks/operator-workflow.md`
- `.ai/reviews/run-review-template.md`
- `ROADMAP.md` Phase 2 and Phase 2.1

## Compatibility Boundary

- Revisions are allowed only in `SCRIPT_GENERATED`, `SCRIPT_REVIEWED`, or `SCRIPT_APPROVED`.
- Revisions after production package generation are blocked.
- Revised content must be non-empty, materially different, and include a non-empty reason/editor.
- A revision invalidates script review warnings and script approval, then requires review and
  approval again.
- Idea approval and generated prompt provenance remain intact.
- No render, upload, publish, provider, or paid path is enabled.

## Verification

```bash
pnpm exec vitest run tests/scriptRevision.test.ts tests/approvalGate.test.ts tests/state.test.ts
pnpm check
pnpm qa:usage
pnpm build
pnpm version:plan
pnpm security:dependencies
```

## Tasks

1. Write failing tests for snapshots, attribution, state rollback, approval invalidation, evidence,
   re-review, and post-package blocking.
2. Add the revision ledger type, safe backward transitions, and script revision owner.
3. Add the CLI command and clean-copy usage smoke.
4. Update README, ROADMAP, `.ai` architecture/current-state/tasks/runbook/checklists/review
   template, assets documentation, and changelog.
5. Run focused/full verification, inspect complexity and lingering stale-review references, then
   commit only when green.

## Repair Track

- Root cause: direct file edits change the content hash without a supported state rollback or
  revision record.
- Canonical repair: additive revision snapshots plus explicit review/approval invalidation.
- Verification: revised approved scripts return to `SCRIPT_GENERATED`, cannot package, and can pass
  review/approval again.

## Retirement Track

- Retire the documented practice of editing `script.md` directly.
- Retain old review files only as inactive disk evidence and revision snapshots.
- Active review evidence is restored only by rerunning `producer review script`.
