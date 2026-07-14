# Architecture Overview

UykulukSciFi Producer is a focused production desk, not a generic agent runtime or cloud video
platform. It is local-first but allows replaceable hosted engines behind the same approval, budget,
evidence, and review boundaries.

## Ownership

- `src/core/` owns run state, transitions, ledgers, canonical artifact registration, approvals, and
  atomic persistence.
- `src/stages/` owns workflow stages and stage-specific evidence.
- `src/providers/` and stage provider modules implement replaceable LLM, TTS, and media engines.
- `src/costs/` owns quotes, reservations, settlement, reconciliation, and hard-budget accounting.
- `src/safeguards/` owns content, asset, approval, budget, and publishing guards.
- `src/studio/` exposes typed action metadata and shared service contracts.
- `apps/studio/` is a guarded operator UI over those contracts.
- `src/youtube/` currently keeps upload/publish boundaries disabled.

Studio must not infer transitions, approvals, or provider authority from browser state. Every
mutation reaches a typed local action and core revalidates current persisted truth.

## Workflow State

The run state machine makes expensive and review-sensitive transitions explicit. Idea approval
precedes script generation; exact script review/approval precedes packaging; selection and quote
evidence precede hosted voice; exact media evidence precedes render approval.

In-flight work uses immutable snapshots. Later settings or prompt changes affect the next operation,
not the operation already executing.

## Evidence

Artifacts carry identity, schema versions, SHA-256 digests, provenance, timestamps, provider/model
metadata, and operator attribution as relevant. Consumers validate the complete relationship, not
just one file. Evidence Markdown is an operator projection; canonical JSON and registered bytes
remain the machine-verifiable sources.

Paid calls add exact quote, approval, reservation, operation ID, bounded execution, settlement,
redacted diagnostics, and recovery evidence. Unknown provider outcomes do not become success.

## Repository Layout

```text
.
├── apps/studio/          # Next.js operator surface
├── assets/               # committed production inputs and inventory
├── docs/                 # versioned operator and engineering documentation
├── prompts/defaults/     # tracked runtime prompt defaults
├── scripts/              # QA, security, release, model, and local tooling
├── src/
│   ├── config/           # configuration schema and loading
│   ├── core/             # state, approvals, ledgers, artifacts
│   ├── costs/            # quote, reservation, settlement
│   ├── providers/        # LLM provider boundary
│   ├── safeguards/       # fail-closed guards
│   ├── stages/           # workflow stages and domain helpers
│   ├── studio/           # typed Studio action contracts
│   └── youtube/          # disabled/current future distribution boundary
├── tests/                # Vitest contracts and regressions
├── .ai/                  # development-only guidance and checkpoints
└── .github/              # CI, CodeQL, Dependabot, Sonar, release
```

## Runtime and Development Separation

Runtime prompts live under `prompts/`; production assets live under `assets/`; generated run data
lives under ignored `runs/`. `.ai/` and installed agent skills are development guidance only and
must never be imported, packaged, or required by the product runtime.

## Scope Discipline

V1 favors coherent vertical slices and one provider per proven need. Generic queues, team SaaS,
autonomous publishing, provider proliferation, ComfyUI requirements, and public/scheduled publish
are outside the current architecture.
