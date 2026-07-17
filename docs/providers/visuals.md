# Visual Providers

Scene visuals share one revisioned manifest, contact-sheet review, and exact render binding. The
provider boundary does not approve media; every active revision still needs an attributable Studio
decision before render approval. Studio describes the operator action as hosted generation rather
than naming a vendor in primary product copy; exact provider/model identity remains visible in plan,
quote, evidence, and diagnostics.

## Static and Manual Fallback

`static-manual` is the default credential-free mode. It prepares 12–24 duration-preserving scene
beats from documented project assets. Operators can import local PNG/JPEG revisions and regenerate
only rejected beats without any hosted request.

```json
{ "providers": { "imageGeneration": { "enabled": false, "mode": "static-manual" } } }
```

## Black Forest Labs FLUX.2 Pro

Black Forest Labs FLUX.2 Pro is the sole hosted visual adapter. It is experimental and disabled by
default. When explicitly configured and approved, it uses the FLUX.2 Pro endpoint as an asynchronous
operation:

1. Studio persists an exact scene plan containing prompts, source revisions, seeds, dimensions,
   output format, pricing snapshot, and maximum cost.
2. The normal estimate and cost approval bind the plan digest.
3. An explicit operator confirmation reserves the approved line and starts the batch.
4. Each provider task is polled with a bounded timeout; signed result URLs are downloaded only by
   the server and immediately persisted as local run artifacts.
5. Provider-reported credits are reconciled against the approved tariff and reservation cap before
   the generated revisions enter review.

Set `BFL_API_KEY` only in an ignored server-side environment file. Provider task URLs, signed image
URLs, raw keys, request bodies, and request IDs must not enter Studio responses or committed
artifacts. A configured key means only that a credential is present; it does not prove account
entitlement, available credit, or readiness for a paid production call.

```json
{
  "providers": {
    "imageGeneration": { "enabled": true, "requiresApproval": true, "mode": "black-forest-labs" }
  }
}
```

The tracked config example pins the current model, dimensions, output format, timeout, polling, and
pricing snapshot. Change those values only by creating a new quote; an in-flight operation remains
bound to its persisted plan.

## Rejected-Only Regeneration

After hosted results settle, reject weak scene revisions in the contact sheet. A new hosted plan can
target only rejected active revisions. Core archives the previous exact plan and JSON/Markdown
quote, retains approvals, reservations, spools, images, and accepted scenes as history, and quotes
only the new scene indexes. Already-settled TTS is represented as a zero-cost completed stage rather
than being purchased again.

## Manual-Only External Creative Media

Eleven Creative image/video generation is not an integrated provider because this product has no
public generation API contract for it. Any externally created Eleven Creative image or video must be
reviewed and added through the existing attributable `manual-import` workflow. It receives no hosted
execution, quote, credential, or entitlement status inside Producer.

## Next Local Slice

Local MFLUX is the next visual-provider slice. It must reuse the existing deterministic plan,
revision review, provenance, and exact render-binding contracts. It is a local adapter candidate,
not a second hosted provider, and remains unavailable until that focused slice is implemented and
verified.

## Validation Status

Request, polling, download, billing, settlement, crash recovery, two-round rejected regeneration,
and combined ElevenLabs-plus-FLUX workflow tests are mock-backed. No live BFL generation smoke has
run; its available credit and entitlement remain unverified. Do not describe hosted visual
production as live-verified until entitlement, credit, exact approval, and a bounded
operator-triggered smoke are all proven.
