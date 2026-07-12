# ElevenLabs Voice Audition And Exact Selection Binding

## Goal

Let an operator discover review-safe ElevenLabs voice candidates, audition existing provider
previews without generating speech, select one voice/model for a run, and bind that exact selection
and known pricing metadata into cost approval, reservation, synthesis, evidence, and Studio review.

## Architecture

- Add a small normalized voice-catalog boundary under `src/stages/voice/`; ElevenLabs is its only
  hosted implementation. It never exposes the API key or raw provider responses.
- Catalog, preview, and selection are explicit run-scoped operations after production-package
  generation. They do not synthesize speech, approve cost, render, upload, or publish.
- Persist `production/audio/voice_candidates.json`, bounded local preview audio/evidence, and
  `production/audio/voice_selection.json`. Production ElevenLabs cost estimation requires a current,
  untampered selection; deterministic-local and Piper do not.
- Extend the generic cost quote/reservation adapter identity with an optional binding digest so the
  selected voice/model/pricing/settings cannot race or drift behind a provider/model-only identity.
- Studio uses guarded CLI/core actions and the existing manifest-bound media route. It never accepts
  arbitrary preview URLs or arbitrary artifact paths.

## Tech Stack

TypeScript, Zod, `@elevenlabs/elevenlabs-js` 2.57.0, Node fetch/streams, current run artifact and
ledger utilities, Commander, Next.js App Router, Vitest, and Playwright. No new dependency.

## Baseline And Authority Refs

- active Production Quality & Controlled Distribution goal
- `.ai/checkpoints/production-quality-media.md`
- `.ai/runbooks/cost-controls.md`
- `src/stages/voice.ts`
- `src/stages/voice/providers/elevenLabsTtsProvider.ts`
- `src/costs/costEstimate.ts`, `src/costs/costQuoteStages.ts`, and
  `src/costs/reservedProviderExecution.ts`
- `src/studio/actionServiceContracts.ts` and current guarded Studio route contracts
- ElevenLabs official voices/models/subscription/pricing/authentication documentation current on
  2026-07-12

## Current Provider Facts

- Official read endpoints are `GET /v2/voices`, `GET /v1/voices/:voice_id`, `GET /v1/models`, and
  `GET /v1/user/subscription`.
- Existing `preview_url` or verified-language previews do not invoke TTS. Adding a shared voice is a
  separate provider mutation and is out of scope.
- `eleven_v3` reports Turkish support, TTS capability, no Speaker Boost, and a live 5,000-character
  request cap.
- The models response provides character-cost and discount multipliers. No exact TTS preflight
  quote endpoint or public custom-rate formula is documented; unknown/custom-rate pricing must
  block production selection.
- Free-tier output lacks the production commercial-rights basis required by this workflow. Free
  accounts may use catalog/preview, but production synthesis remains blocked until the current
  subscription snapshot is eligible.
- A 2026-07-12 read-only smoke returned 21 premade voices. The first 20 had no sample IDs, so V1
  must download provider preview URLs rather than depend on the sample-audio endpoint. Observed
  preview sources were `api.us.elevenlabs.io` and the `eleven-public-prod` bucket on
  `storage.googleapis.com`; one preview was an ID3 MP3 served as `text/plain`.

## Requirement Ready Check

- User journey: package → fetch candidates → audition local previews → select → estimate → approve
  cost → production voice.
- Acceptance: no synthesis during audition; exact selection digest in quote/reservation/audio;
  pricing or metadata drift blocks before paid dispatch; free/custom-rate uncertainty blocks;
  deterministic/Piper paths remain green; Studio completes the flow without arbitrary URLs.
- Open blocker questions: none for the bounded available-voices path. Shared Voice Library discovery
  and provider-side add/import are explicitly deferred.
- Decision: ready.

## Change Necessity And Owner Fit

- Config-only `voiceId` cannot prove audition, operator selection, preview digest, or run-specific
  quote binding.
- Existing `voice.ts` is already the stage orchestrator; catalog normalization, preview download,
  and selection persistence need focused owner files rather than more inline logic.
- Existing cost identity is provider/model only and cannot prevent same-model voice/settings drift;
  a generic optional `bindingDigest` is the minimum stable repair.
- Decision: code-change with new focused voice owner files and narrow cost-contract extension.

## Compatibility Boundary

- Local providers never require catalog/selection and keep their existing CLI behavior.
- ElevenLabs config may retain a default/candidate `voiceId`, but it is not production authority;
  full synthesis requires the run selection artifact.
- Existing cost quotes without binding digests remain readable for local/zero-cost stages; new
  ElevenLabs quotes require the digest.
- No paid synthesis runs in CI. Catalog GET retry may be bounded; TTS retry remains zero.
- Public/scheduled publish and provider-side shared-voice mutation remain unavailable.

## Artifact Contracts

`voice_candidates.json` records a normalized, bounded snapshot:

- run/provider/generated time and request-id hashes;
- subscription tier/status/quota digest and commercial-use eligibility classification;
- selected model capability/language/request-cap/rate metadata and digest;
- base unit price source, known multipliers, effective maximum quote rate, and exactness status;
- up to 24 candidates with voice ID/name/category, bounded labels/description, Turkish verification,
  sharing/legacy/availability flags, metadata digest, preview availability/source, and URL hash only;
- no raw preview URL, API key, provider body, invoice detail, or unbounded labels.

Preview evidence records candidate/catalog/model metadata digests, local path, byte count, SHA-256,
detected MP3/WAV type, provider URL hash, source-host classification, fetch time, and request-id hash
when present. It never records the raw URL or headers.

`voice_selection.json` records operator/reason, catalog and preview digests, exact voice/model,
language/output/settings/chunk-plan inputs, pricing/subscription eligibility, and a canonical
selection digest. Selection is permitted only from a valid local preview and current candidate
snapshot.

## Task 1 - Catalog Provider And Durable Candidates

Files:

- create normalized schemas/paths/provider boundary below `src/stages/voice/catalog/`;
- add `src/stages/voice/providers/elevenLabsVoiceCatalogProvider.ts`;
- add a stage entrypoint and CLI command registration;
- add `tests/elevenLabsVoiceCatalogProvider.test.ts`, `tests/voiceCandidates.test.ts`, and CLI tests.

Steps:

1. Implement bounded SDK calls with 30-second timeout, at most two GET retries, `hasMore` plus
   `nextPageToken` pagination, and request-id hashing.
2. Fetch only account-available voices, selected model metadata, and the narrow subscription
   endpoint. Do not call shared-voice add/import or TTS.
3. Normalize and bound all provider fields, classify Turkish verification and preview availability,
   rank verified Turkish candidates first, and cap persisted candidates at 24.
4. Reject missing TTS capability, missing Turkish model support, absent/invalid rate multipliers,
   custom-rate/live-moderated/disabled voices, unsafe model request caps, and malformed provider
   output.
5. Persist candidates only while the run is `PRODUCTION_PACKAGE_GENERATED`; write redacted failure
   diagnostics and ledger events without raw response data.
6. Expose `producer voice-candidates --run <run_id> [--json]`.

Verification:

```bash
pnpm vitest run tests/elevenLabsVoiceCatalogProvider.test.ts tests/voiceCandidates.test.ts tests/voiceCli.test.ts tests/elevenLabsConfig.test.ts
pnpm typecheck
pnpm typecheck:compat
pnpm lint -- src/stages/voice tests/elevenLabsVoiceCatalogProvider.test.ts tests/voiceCandidates.test.ts
pnpm security:secrets
```

Commit: `feat(voice): add redacted ElevenLabs candidate catalog`

## Task 2 - Bounded Preview Download And Durable Selection

Files:

- create preview downloader/evidence and selection owners below `src/stages/voice/`;
- extend CLI commands and artifact review helpers;
- add `tests/voicePreview.test.ts`, `tests/voiceSelection.test.ts`, and CLI tests.

Steps:

1. Resolve a preview only by persisted candidate ID, then refetch that voice's metadata to obtain a
   current URL in memory. Never accept a URL from CLI/Studio input.
2. Permit HTTPS ElevenLabs hosts and only `storage.googleapis.com/eleven-public-prod/...`; reject
   credentials, fragments, unexpected ports, unapproved hosts/buckets, and redirects.
3. Enforce timeout and a 5 MiB streamed byte cap. Detect ID3/MP3 frame or RIFF/WAVE magic instead of
   trusting provider content type; persist `.mp3` or `.wav` atomically.
4. Require the current catalog/voice metadata digest and write redacted preview evidence.
5. Add `producer voice-preview --run <id> --voice <id>` and `producer voice-select --run <id>
   --voice <id> --reviewed-by <name> --notes <text>`; bind selection to a valid local preview.
6. Archive earlier pre-quote selections for audit while keeping one canonical selection pointer.

Verification:

```bash
pnpm vitest run tests/voicePreview.test.ts tests/voiceSelection.test.ts tests/voiceCli.test.ts tests/artifactPath.test.ts
pnpm typecheck
pnpm typecheck:compat
pnpm security:secrets
```

Commit: `feat(voice): add audition previews and selection evidence`

## Task 3 - Exact Quote, Reservation, And Synthesis Binding

Files:

- modify `src/costs/costQuoteStages.ts`, `src/costs/costEstimate.ts`, reservation schemas/store,
  `src/costs/reservedProviderExecution.ts`, `src/stages/voice.ts`, provider construction, and
  voiceover evidence;
- add/extend cost, reservation, ElevenLabs workflow, evidence, readiness, and tamper tests.

Steps:

1. Add optional canonical `bindingDigest` to quoted stages, approved quote context, adapter identity,
   reservation events/summaries, and execution claims; include it in mismatch and idempotency checks.
2. Require current selection for an enabled ElevenLabs TTS quote. Quote prepared text and chunk plan
   using selection model limits, known model/discount multipliers, base unit price, and a documented
   conservative maximum; include selection digest in pricing/config validation.
3. Block estimate/production when subscription is free/non-commercial, the catalog is stale,
   current quota is insufficient, or pricing/custom-rate status is uncertain.
4. Before reservation, re-read current voice/model/subscription metadata with bounded GET behavior.
   Any capability, availability, rate, tier, or selection digest change makes approval stale and
   prevents TTS dispatch.
5. Construct the TTS provider from the persisted selection, not mutable global `voiceId`; include
   selection/model/settings/output/chunk-plan digests in operation ID and adapter binding.
6. Persist selection digest and current metadata digests in voiceover evidence. Keep final
   settlement based on allowlisted `character-cost`; keep TTS retries at zero.
7. Add a safe pre-spend reselection recovery that archives stale quote/approval evidence and returns
   to the package/selection boundary. It must be unavailable after reservation or synthesis starts.

Verification:

```bash
pnpm vitest run tests/costApproval.test.ts tests/costReservation.test.ts tests/reservedProviderExecution.test.ts tests/elevenLabsVoiceWorkflow.test.ts tests/voiceSelection.test.ts tests/voiceoverEvidenceValidation.test.ts tests/readiness.test.ts tests/voice.test.ts
pnpm typecheck
pnpm typecheck:compat
pnpm qa:modularity
pnpm security:secrets
```

Commit: `feat(voice): bind selection into paid synthesis`

## Task 4 - Guarded Studio Audition And Selection UX

Files:

- extend shared Studio action metadata/contracts and CLI argument allowlist;
- add guarded catalog/preview/select/reselect routes;
- add a run voice-audition read model and focused components below the production-media area;
- extend manifest-bound media serving for preview artifacts;
- add contract, negative route, media, component, and Playwright tests.

Steps:

1. Add strict bounded payloads for run-only catalog, candidate-ID preview, and attributed selection;
   reject unknown properties, arbitrary URLs/paths, oversized notes, and malformed IDs.
2. Call canonical CLI commands through the current same-origin, action-header, and short-lived
   session boundary. Minimize responses and keep provider diagnostics redacted.
3. Render candidate cards with Turkish/model evidence, license/tier warnings, preview availability,
   local audio controls, current selection, exact next action, and visible quote invalidation rules.
4. Serve preview audio only after validating it against current candidates/preview evidence; keep
   range support, `nosniff`, `no-store`, and path containment.
5. Correct existing Studio copy so `voice.run` is visibly an approval-gated hosted call when
   ElevenLabs is selected, not always described as local execution.
6. Exercise catalog failure, preview failure, selection conflict/tamper, free-tier blocker, local
   fallback, and happy-path mocked audition in the real Studio.

Verification:

```bash
pnpm vitest run tests/studioActionServiceContracts.test.ts tests/studioStageActionRoutes.test.ts tests/studioMediaArtifacts.test.ts tests/studioProductionMediaPanel.test.ts tests/studioVoiceAudition.test.ts
pnpm studio:typecheck
pnpm studio:typecheck:compat
pnpm studio:lint
pnpm studio:build
pnpm studio:test:e2e
pnpm security:secrets
```

Commit: `feat(studio): add guarded voice audition and selection`

## Verification And Stop Condition

- Focused tests and TS7/TS6 checks run after each commit; heavy Studio/build/browser work stays
  sequential.
- No CI or automated test performs a live provider call.
- One explicitly approved read-only live catalog/preview smoke may verify current metadata and local
  playback; a production TTS smoke remains separately cost-approved and blocked on free-tier
  licensing.
- The slice stops only when Studio can fetch mocked candidates, download/play a bounded preview,
  record one exact run selection, show why free-tier production is blocked, and prove that any
  selection/model/pricing/settings drift invalidates quote/reservation before synthesis.

## Risks And Deferred Work

- Provider preview hosts may evolve. Add hosts only from official/current provider evidence and keep
  URL input provider-owned, never operator-supplied.
- Shared Voice Library browse/add, custom rates, live moderation, voice cloning, and voice design are
  deferred.
- Default/premade provider voices may change or retire; selection revalidation must remain current.
- Production alignment-to-SRT is the next voice slice after selection binding; this plan preserves
  the existing character alignment artifact but does not claim subtitle completion.
- A settled call followed by process crash before audio persistence still needs a recovery/spool
  design; this plan keeps blind retry fail-closed.
