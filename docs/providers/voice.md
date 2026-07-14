# Voice Providers

Voice mode is selected in ignored `producer.config.json`. All modes use the same run state, artifact
registration, review, evidence, and exact render-approval boundary.

## Deterministic Local

`deterministic-local` generates bounded reference WAV audio for timing and pipeline validation. It
is credential-free and deterministic, but it is not a production-quality voice claim. Subtitle
timing is recorded as `linear-fallback`.

```json
{ "providers": { "tts": { "enabled": true, "mode": "deterministic-local" } } }
```

## Piper

```bash
uv tool install piper-tts
pnpm tts:piper:setup
```

The setup helper downloads the pinned Turkish `speaches-ai/piper-tr_TR-fahrettin-medium` model into
ignored `models/` and prints the corresponding ignored config. `local-piper` requires the local
binary, `piperModelPath`, and `piperConfigPath`.

Piper execution is time-bounded. Normalized output is written atomically. Evidence records model and
config SHA-256 digests, source peak, target peak, and applied gain. Piper also uses explicit
`linear-fallback` subtitle timing.

## ElevenLabs v3

The adapter implements:

- bounded voice/model/subscription catalog retrieval;
- persisted candidate eligibility and Turkish-language evidence;
- bounded local preview download without exposing provider URLs;
- attributable voice selection and pre-spend reselection;
- exact quote, cost approval, reservation, operation identity, and metadata preflight;
- ElevenLabs v3 chunked synthesis with original and normalized alignment evidence;
- provider-credit settlement, redacted diagnostics, and digest-anchored recovery;
- original-alignment-derived Turkish SRT and exact render binding.

Set `ELEVENLABS_API_KEY` only in ignored server-side environment files. The provider key, raw
request bodies, raw preview URLs, headers, and request IDs must not enter Studio responses or
artifacts.

### Audition

Catalog retrieval is explicit; opening Studio makes no provider call. A candidate preview can be
requested only by persisted voice ID. Downloads are HTTPS-only, redirect-free, host-allowlisted,
size/time bounded, and verified by audio magic bytes. Studio plays the resulting local artifact.

Paid-tier selection requires explicit production-rights confirmation. Free-tier voices remain
preview-only when subscription evidence does not grant commercial production rights.

### Production

Hosted production requires the exact persisted binding digest, quote digest, approval ID, and
explicit paid-operation confirmation. Core revalidates the current selection, metadata, budget,
reservation, and eligibility. Missing or stale values fail closed.

The v3 request cap remains below the provider's 5,000-character model limit. Original alignment is
the timing authority; normalized alignment is retained only for diagnostics. Alignment text must
match prepared synthesis text before voice evidence can complete.

### Current Validation Status

Mock-backed production, settlement, recovery, and aligned-subtitle tests exist. A real commercial
production synthesis has not yet been approved and completed. Free-tier metadata/catalog/preview
smoke may be used only where the account permits it and does not prove production rights.

Until a bounded paid smoke verifies output, alignment, provider credits, and settlement evidence,
the product must report “live production voice validation pending.”
