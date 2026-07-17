# Hosted Visual Provider — Checkpoint

## TodoCheckpointDraft

- Completed: PR #151 merged static/manual `VisualProvider`, 12–24 visual beats, contact-sheet
  review, rejected-only static regeneration, deterministic motion, and exact render binding.
- Completed: official BFL contract review selected the stable `POST /v1/flux-2-pro` endpoint and
  returned `polling_url` flow; FLUX.2 Pro is the sole hosted adapter, remains experimental, and is
  disabled by default.
- Completed: exact hosted plan/binding, configuration, quote/approval/reservation, BFL async
  execution, credit settlement, local result spool, manifest promotion, and crash recovery.
- Completed: Studio typed plan/generate controls, exact paid confirmation, rejected-only revision
  reopening, immutable quote history, and accepted-scene preservation.
- Completed: two-round hosted regeneration plus combined ElevenLabs voice recovery reaches final
  readiness without repeating the settled voice provider call.
- Completed: settled TTS/image costs replace quoted maxima during quote validation; Studio
  distinguishes fresh and settled/applied plans; sequential partial regeneration retains exact
  per-scene source evidence.
- Completed: Studio product language is provider-neutral while exact BFL/FLUX.2 Pro identity remains
  visible in plan, quote, evidence, and diagnostics.
- Completed: `pnpm model:start` now resolves absolute paths, explicit repository-relative paths, and
  bare `models/llm` names with an optional `.gguf` suffix while preserving `config.model` as the
  served alias and listing attempted paths on failure.
- Completed final local verification: `pnpm check` passed 252 files/1,139 tests, both supported
  TypeScript toolchains, the Webpack Studio production build, modularity, secret, release, and
  formatting gates; coverage passed the same 1,139 tests. Usage and product UAT passed with reports
  `.ai/qa/artifacts/usage-smoke-20260717-194304/qa-report.md` and
  `.ai/qa/artifacts/product-uat-20260717-194440/qa-report.md`; the production Chromium suite passed
  9/9 routes after separating compact action-rail layout from Sheet close context. Dependency audit
  found no known high-severity vulnerability and the release plan remains minor (`v0.84.0`).
- Completed: current remote PR plus local closure union remains within the 150-file review limit.
- Active: push the final review fixes, then use hosted PR Sonar/CI because the local SonarCloud
  Keychain credential is unavailable.
- External proof deferred from this PR: the current ElevenLabs Free API plan lists 10,000 included
  Multilingual v2/v3 characters, so a later short diagnostic-only v3 timestamps smoke may run after
  subscription inspection; it grants no commercial rights. BFL credit/entitlement remains
  unverified. Credential configuration means key presence only, never production readiness.

## BaselineUsageDraft

- Required: current visual manifest/revision owners, cost quote/reservation/settlement owners,
  render consumers, Studio typed visual actions, official BFL OpenAPI/pricing/integration docs.
- Acknowledged: implementation branch started from merged PR #151 and is now based on the `v0.83.0`
  release commit (`f3af9f99`).
- Acknowledged: static/manual fallback is the compatibility baseline and must remain unchanged.
- Acknowledged: Eleven Creative image/video has no integrated public generation API and therefore
  enters only through attributable `manual-import`.
- Acknowledged: local MFLUX is the next visual-provider slice behind the current
  plan/review/evidence boundary; it does not add another hosted adapter.
- Acknowledged: BFL returns an async task id, polling URL, and provider-reported credit cost; result
  URLs expire after ten minutes and must be downloaded immediately.
- Present: mocked request/poll/download/recovery/settlement and combined workflow evidence.
- Decision: continue.

## ResumeStateHint

Continue on `codex/hosted-visual-provider`. Do not repeat the static/manual slice or perform a live
paid request; current credentials do not imply provider entitlement or available credit. Run the
remaining verification and delivery gates; preserve the combined voice-plus-two-round-visual
workflow as the end-to-end acceptance proof for this slice.

## DriftCheckDraft

- Goal alignment: hosted still-image generation is the next ordered v1 media slice.
- Scope: one hosted provider only; Studio language stays provider-neutral and there is no
  clips/upload/settings expansion.
- Compatibility: static/manual fallback remains the baseline.
- New owners: generation plan, provider client, and operation spool are intentional paid-boundary
  responsibilities and should remain modular.
- Decision: continue.
