# Production Package Integrity

## Goal

Bind cost estimates, readiness, and evidence to the complete generated production package so any
missing, malformed, foreign, or modified derived artifact fails closed before manual-production
readiness.

## Architecture

- Add `src/stages/productionPackageIntegrity.ts` as the canonical owner for the versioned manifest,
  package artifact list, digest creation, and verification.
- Keep `production/production_package.meta.json` as the operator-readable manifest path.
- Generate the five derived package artifacts first, then write the manifest last.
- Make cost estimation and readiness consume the same verifier instead of maintaining independent
  existence or single-file digest rules.
- Surface manifest status and digest in the evidence bundle without treating evidence generation as
  approval authority.

## Tech Stack

TypeScript, Zod, Node filesystem APIs, Vitest, existing atomic artifact writers and SHA-256 helper.

## Baseline And Authority Refs

- `AGENTS.md`
- `.ai/architecture.instructions.md`
- `.ai/rules.instructions.md`
- `.ai/tasks.instructions.md`
- `.ai/runbooks/operator-workflow.md`
- `.ai/checkpoints/producer-core-hardening.md`
- `src/stages/productionPackage.ts`
- `src/costs/costEstimate.ts`
- `src/stages/readiness.ts`
- `src/stages/evidence.ts`

## Compatibility Boundary

- Existing CLI commands and state transitions do not change.
- Newly generated packages use manifest schema version 1.
- Packages without a valid manifest fail closed and must be regenerated; no silent legacy fallback
  is retained.
- Prompt provenance remains available at `production/production_package.meta.json`.
- Render, upload, and public/scheduled publishing remain disabled and outside this slice.

## TDD Route

- Mode: auto
- Decision: strict
- Reason: this changes a persisted security contract shared by generation, cost estimation,
  readiness, and evidence.
- Verification: focused manifest/tamper tests, cost/readiness/mock regressions, full project gates,
  usage smoke, dependency/release checks, and diff-scoped security review.

## Complexity Budget

- Artifact class: shared persistence and readiness contract.
- Target files: a new integrity owner plus narrow producer/consumer integrations.
- Current pressure: `productionPackage.ts`, `costEstimate.ts`, and `readiness.ts` already have clear
  responsibilities but must not each gain duplicate digest rules.
- Projected post-change pressure: within budget with one dedicated schema/verifier module.
- Planned governance: centralize the package artifact list, schema, canonical digest, and
  verification; consumers receive typed results or fail-closed errors.

## Architecture Integrity Lens

- Invariant: readiness and an approved cost quote describe the exact complete package on disk.
- Canonical owner: `productionPackageIntegrity.ts`.
- Responsibility overlap to retire: readiness existence-only package check and cost estimation's
  direct hash of only `production_package.md`.
- Higher-level simplification: one verified manifest digest is consumed by all downstream checks.
- Falsifier: changing any listed artifact without regenerating the package must block cost
  estimation/readiness and be reported by evidence.
- Verdict: proceed with a dedicated owner file.

## Tasks

### 1. Specify the manifest and tamper behavior under RED

- Add `tests/productionPackageIntegrity.test.ts`.
- Assert generation writes schema version 1 with the run ID, approved script digest, provenance, and
  exact digests for all five package outputs.
- Table-test modification and deletion of every listed output.
- Assert malformed/foreign manifests fail verification.
- Extend readiness and cost tests so tampering leaves state unchanged and blocks progression.
- Run focused tests and confirm failures are caused by the missing verifier contract.

### 2. Implement the canonical manifest owner

- Add a strict Zod schema and exported manifest/result types.
- Add manifest creation after all derived artifacts have been atomically written.
- Verify exact required paths, unique entries, run identity, approved script digest, and current
  file digests.
- Return a canonical manifest digest for downstream quote/evidence binding.
- Keep errors operator-readable and fail closed.

### 3. Integrate consumers and operator evidence

- Replace the single-Markdown cost fingerprint with the verified manifest digest.
- Add an explicit production-package integrity readiness check.
- Add package integrity status, manifest path, and digest to JSON/Markdown evidence.
- Update operator workflow, current-state/QA records, changelog, and the active checkpoint.

### 4. Verify and close the slice

- Run focused tests, `pnpm typecheck`, and `pnpm test`.
- Run `pnpm check`, `pnpm qa:usage`, `pnpm version:plan`, `pnpm security:dependencies`,
  `pnpm release:check`, and `git diff --check` sequentially.
- Run the routed diff-scoped security review and resolve validated findings.
- Commit only after all required gates pass.

## Risks And Retirement

- A manifest is integrity evidence, not a cryptographic signature; an attacker able to rewrite both
  artifacts and manifest can still replace the package. Tamper-evident ledgers/signatures remain
  separate roadmap work.
- Filesystem symlink containment remains a separate hardening slice.
- The old direct `production_package.md` hash helper is retired in this slice.
