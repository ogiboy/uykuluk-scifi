# Artifact Path Validation

## Goal

Constrain every run artifact to one canonical relative path beneath its validated run directory so
future Studio services and workers cannot turn an artifact name into an arbitrary filesystem read or
write.

## Contract

- Existing artifact paths and revision paths remain valid.
- Artifact paths are 1-512 characters, use forward-slash-separated segments, and contain only ASCII
  letters, digits, dots, underscores, or hyphens.
- Each segment begins with an ASCII letter or digit.
- Windows reserved device basenames and segments ending in dots are rejected to preserve portable
  canonical naming.
- Empty paths, absolute paths, Windows paths, backslashes, dot segments, duplicate/trailing
  separators, whitespace, control characters, and oversized paths fail closed.
- `artifactPath`, `writeRunJson`, and `writeRunText` reject invalid paths before filesystem or
  ledger mutation.
- Persisted run state rejects invalid artifact entries.
- Symlink containment remains a separate filesystem-integrity slice.

## TDD Route

- Mode: auto
- Decision: strict
- Reason: shared artifact reads/writes are a filesystem authority boundary and persisted evidence
  contract.
- Verification: focused path/write/state tests, mock and revision regressions, full gates, usage
  smoke, and diff-scoped security review.

## Complexity Budget

- Artifact class: shared core filesystem and persistence boundary.
- Current pressure: `src/core/artifacts.ts` is small; `runStore.ts` already validates run identity.
- Projected post-change pressure: low.
- Planned governance: add a dedicated `artifactPaths.ts` owner, re-export compatibility from
  `artifacts.ts`, and validate persisted artifact lists from `runStore`.

## Tasks

1. Add failing lexical path, outside-write, current-artifact compatibility, and persisted-state
   tests.
2. Implement the canonical artifact path owner and route all artifact helpers through it.
3. Update product, safeguard, QA, decision, changelog, and checkpoint records.
4. Run focused, full, usage, release, dependency, and security gates.
5. Commit only when green.

## Non-Goals

- Following or rejecting filesystem symlinks.
- User-facing artifact rename/edit commands.
- Studio routes, queue workers, render, upload, or publish.
