# Hosted Visual Provider — Checkpoint

## TodoCheckpointDraft

- Completed: PR #151 merged static/manual `VisualProvider`, 12–24 visual beats, contact-sheet
  review, rejected-only static regeneration, deterministic motion, and exact render binding.
- Completed: official BFL contract review selected the stable `POST /v1/flux-2-pro` endpoint and
  returned `polling_url` flow; FLUX.2 Pro remains the sole hosted adapter candidate.
- Completed: exact hosted plan/binding, configuration, quote/approval/reservation, BFL async
  execution, credit settlement, local result spool, manifest promotion, and crash recovery.
- Completed: Studio typed plan/generate controls, exact paid confirmation, rejected-only revision
  reopening, immutable quote history, and accepted-scene preservation.
- Completed: two-round hosted regeneration plus combined ElevenLabs voice recovery reaches final
  readiness without repeating the settled voice provider call.
- Completed: settled TTS/image costs replace quoted maxima during quote validation; Studio
  distinguishes fresh and settled/applied plans; sequential partial regeneration retains exact
  per-scene source evidence.
- Completed: rebased onto `v0.83.0`; full check passes 251 files/1,094 tests plus Studio production
  build, and usage/product/browser/coverage/dependency/version gates are green.
- Completed: final independent review found no remaining P1/P2 blocker; the PR diff remains within
  the 150-file review limit.
- Active: commit and push the final review fixes, then use hosted PR Sonar/CI because the local
  SonarCloud Keychain credential is unavailable.

## BaselineUsageDraft

- Required: current visual manifest/revision owners, cost quote/reservation/settlement owners,
  render consumers, Studio typed visual actions, official BFL OpenAPI/pricing/integration docs.
- Acknowledged: implementation branch started from merged PR #151 and is now based on the `v0.83.0`
  release commit (`f3af9f99`).
- Acknowledged: static/manual fallback is the compatibility baseline and must remain unchanged.
- Acknowledged: BFL returns an async task id, polling URL, and provider-reported credit cost; result
  URLs expire after ten minutes and must be downloaded immediately.
- Present: mocked request/poll/download/recovery/settlement and combined workflow evidence.
- Decision: continue.

## ResumeStateHint

Continue on `codex/hosted-visual-provider`. Do not repeat the static/manual slice or perform a live
paid request. Run the remaining verification and delivery gates; preserve the combined
voice-plus-two-round-visual workflow as the end-to-end acceptance proof for this slice.

## DriftCheckDraft

- Goal alignment: hosted still-image generation is the next ordered v1 media slice.
- Scope: one provider only; no clips/upload/settings expansion.
- Compatibility: static/manual fallback remains the baseline.
- New owners: generation plan, provider client, and operation spool are intentional paid-boundary
  responsibilities and should remain modular.
- Decision: continue.
