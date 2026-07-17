# Studio Operator Workflow

Studio is the normal operator surface. CLI/core remains the owner of run state, transitions,
approvals, costs, artifacts, evidence, and readiness. Studio reads those contracts and submits
guarded typed actions; it does not maintain a second workflow state machine.

## Journey

```text
doctor
  -> idea generation and approval
  -> script generation, review, revision, and approval
  -> production package and render plan
  -> voice audition, selection, quote, approval, synthesis, and subtitle review
  -> visual planning, generation, review, and rejected-only regeneration
  -> exact render approval and FFmpeg MP4
  -> final review and manual channel handoff
```

Private-only YouTube upload and processing review are planned v1 work. Public and scheduled
publishing remain unavailable.

## Review Model

The normal view prioritizes:

- current workflow stage;
- one primary next safe action;
- the content needed for a decision;
- cost and readiness status;
- approve, revise, or reject controls.

Technical paths, digests, ledger entries, provider diagnostics, and CLI recovery commands belong in
progressive-disclosure or Advanced views. File existence is never treated as approval.

## Voice Audition

The v0.82 candidate implements the guarded `voice.candidates`, `voice.preview`, `voice.select`, and
`voice.reselect` actions. Production-build browser UAT covers the normal audition view, local A/B
selection, exact hosted confirmation identifiers, and validated local preview playback.

- Opening a run makes no ElevenLabs request.
- The operator explicitly fetches a bounded catalog of at most 24 persisted candidates.
- Cards show Turkish suitability, tier availability, production rights, metadata freshness, and
  production eligibility.
- Preview audio is played only from validated local run media. Provider URLs are never client input.
- A/B comparison uses at most two persisted previews.
- Selection records reviewer, notes, and production-rights confirmation when required.
- Reselection archives unspent selection and quote evidence; active or uncertain paid execution
  blocks it.
- Quote, budget, quota, approval, synthesis, and alignment status remain visible without exposing
  secrets or raw provider responses.

ElevenLabs v3 catalog, preview, selection, exact quote/reservation, synthesis adapter, settlement,
and recovery contracts are implemented. Commercial live production synthesis is still unverified and
must not be claimed until an approved paid smoke completes.

## Subtitles and Render

ElevenLabs original character alignment is the timing authority for hosted speech. Aligned Turkish
SRT and its metadata are bound to voice evidence and exact render approval. The rendered captions
route serves only validated evidence. Legacy ElevenLabs runs without aligned subtitle evidence do
not silently fall back.

Piper and deterministic-local keep explicit `linear-fallback` timing. Deterministic audio is a
pipeline/reference voice, not a production-quality claim.

## Scene Visuals

The static/manual provider remains the credential-free path. When FLUX.2 Pro is explicitly enabled,
Studio lets the operator select beats, persist one exact generation plan, review its quote and
approval, confirm the displayed paid-operation identity, and play the settled results into the same
contact sheet. Opening the run does not call the provider.

Rejected hosted beats are reopened as an attributable revision. The previous plan and quote are
archived, settled voice work is not quoted again, and only rejected scene indexes enter the next
batch. Pending/approved and rejected beats cannot be mixed in one regeneration plan. Provider result
URLs never become client input; Studio serves only persisted local image artifacts.

## Revision and Recovery

Use attributable Studio revision actions when available. CLI remains the recovery surface for
diagnostic cases that do not yet have a guarded typed form. Never repair `state.json` manually.

- Script revisions invalidate stale review and approval references.
- Package artifact revisions refresh package digests and invalidate downstream evidence.
- Rejected render revisions archive the MP4, manifest, decisions, and evidence before returning to
  exact render approval.
- Voice reselection archives the unspent selection and quote path before a new audition.

## External Boundaries

Studio routes require same-origin JSON, the expected action header, and a short-lived local session
proof. Upload and publishing actions remain disabled. Optional Sentry telemetry is never workflow
authority and excludes prompts, artifacts, request bodies, credentials, and approval evidence.
