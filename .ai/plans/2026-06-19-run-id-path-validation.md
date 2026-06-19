# Run ID Path Validation

## Goal

Reject malformed or path-like run identifiers at the canonical run-store boundary so CLI, services,
future Studio routes, and workers cannot address files outside `runs/`.

## Contract

- Existing generated identifiers such as `run_20260619053334_pkt3z1` remain valid.
- Run identifiers are one safe path segment, start with `run_`, and contain only ASCII letters,
  digits, underscores, or hyphens after that prefix.
- Empty IDs, dot segments, separators, absolute paths, whitespace, control characters, and IDs over
  128 characters fail closed with `SafeExitError`.
- `runDir`, `statePath`, artifact paths, cost paths, reservation paths, and ledger paths share the
  same validation boundary.
- `listRuns` ignores unrelated or malformed directories and continues returning valid runs.
- No workflow state, approval, provider, upload, or publish behavior changes.

## TDD Route

- Mode: auto
- Decision: strict
- Reason: this is a shared filesystem security boundary used by every workflow stage.
- Verification: focused run-store and CLI tests, affected core tests, full gates, usage smoke, and
  diff-scoped security review.

## Complexity Budget

- Artifact class: shared core filesystem boundary.
- Current pressure: `src/core/runStore.ts` is small and already owns run path construction.
- Projected post-change pressure: low.
- Planned governance: add one exported validator in `runStore`; route `ledgerPath` through `runDir`;
  avoid per-call-site duplicate regexes.

## Tasks

1. Add failing tests for traversal, absolute paths, malformed IDs, valid generated IDs, and
   `listRuns` compatibility.
2. Add a CLI regression proving `status --run ../...` fails before filesystem access.
3. Implement central validation and route every run-root path through it.
4. Update current-state, safeguards, QA, changelog, and checkpoint records.
5. Run focused, full, usage, version, dependency, release, and security gates.
6. Commit only when green.

## Non-Goals

- Artifact-relative path validation.
- Cryptographic ledger integrity.
- Studio routes or queue workers.
- Changing the generated run-ID format.
