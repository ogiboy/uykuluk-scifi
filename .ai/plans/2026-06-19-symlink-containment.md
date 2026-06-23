# Run Filesystem Symlink Containment

## Goal

Reject existing symbolic links anywhere beneath the project `runs/` root before state, ledger, cost,
reservation, or artifact access can follow them outside the intended local run tree.

## Contract

- Existing lexical run-ID and artifact-relative-path validation remains unchanged.
- `runs/`, run directories, intermediate directories, and final files fail closed when an existing
  path component is a symbolic link.
- Existing final regular files with multiple hard links fail closed so append-only ledgers cannot
  mutate another pathname's inode outside the run tree.
- Missing path suffixes remain valid for creation.
- State, core ledger, cost ledger, reservation ledger, reservation lock, and artifact paths use one
  canonical containment owner.
- Text and JSON artifact writes use atomic temporary-file replacement.
- No filesystem or ledger mutation occurs after a symlink containment failure.
- This protects against pre-existing symlinks. Node filesystem APIs do not expose a portable
  directory-handle `openat` workflow, so hostile concurrent path replacement remains a documented
  local TOCTOU limitation.

## TDD Route

- Mode: auto
- Decision: strict
- Reason: this is a shared filesystem authority boundary for persisted state, approvals, costs, and
  evidence.
- Verification: focused symlink regressions, persistence/workflow tests, full project gates,
  clean-copy usage smoke, and diff-scoped security review.

## Complexity Budget

- Artifact class: shared core filesystem boundary.
- Canonical owner: `src/core/runPaths.ts`.
- Current pressure: path construction is distributed across core and cost modules.
- Planned governance: add `runsPath` and `runPath`, route internal paths through them, retain
  `artifactPath` as the validated public artifact wrapper, and avoid caller-side checks.

## Tasks

1. Add failing tests for symlinked runs root, run directory, intermediate artifact directory, final
   artifact file, internal ledger path, and hard-linked append-only ledgers.
2. Implement synchronous existing-component checks in the canonical run path owner.
3. Route state, ledger, cost ledger, reservation ledger, reservation lock, and artifact paths
   through the canonical owner.
4. Make text writes atomic and verify failures occur before ledger mutation.
5. Update decisions, runbook/current-state, QA, changelog, and the active checkpoint.
6. Run focused tests, full quality gates, usage/version/dependency/release gates, and security
   review.
