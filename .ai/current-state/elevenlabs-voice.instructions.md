# ElevenLabs Voice Current State

The disabled ElevenLabs adapter is behind exact quote approval, reservation, one-shot dispatch,
settlement/reconciliation, and redacted diagnostics. The `eleven_v3` Turkish path supports bounded
long-form 24 kHz WAV/alignment stitching and provider-cost reconciliation.

`producer voice-candidates` persists a redacted voices/model/subscription snapshot without
synthesis; free-tier voices stay preview-only. `producer voice-preview` accepts only a persisted
candidate id, refetches exact metadata, and writes a bounded local MP3/WAV plus digest evidence
without raw URLs, headers, keys, or request ids. `producer voice-select` records an attributable
exact catalog/preview/model/pricing/settings selection, archives valid prior selections, and
requires explicit production-rights confirmation on paid tiers. Failed catalog or preview
refreshes remove stale active evidence.

Full synthesis cannot use an implicit voice: the exact selected snapshot is visible in the quote,
carried through reservation and a quote-bound operation id, revalidated with bounded metadata GETs,
and persisted with the final voice evidence. Discounted expected cost and a conservative per-chunk
maximum are distinct; settlement records provider-reported billable credits against the approved
base tariff. The operation spool digest is anchored in reservation and cost settlement evidence;
both a committed-pending result and a settled result can finish without a duplicate TTS request or
current credentials/catalog metadata. Successful chunks persist hashed request ids, text digests,
and provider-reported credits; partial uncertain execution retains redacted request evidence for
reconciliation.

`reviseVoiceSelection`, exposed as `producer voice-reselect`, reopens the pre-spend selection gate
under the reservation lock and also permits provider-proven `RELEASED` non-sends. It archives the
prior selection plus quote/estimate and readiness evidence in a registered revision, records the
invalidated cost approval, and requires a fresh selection, quote, and approval. Active, uncertain,
or settled execution remains fail-closed. Unit tests deny non-loopback network access, and no live
paid synthesis has run.
