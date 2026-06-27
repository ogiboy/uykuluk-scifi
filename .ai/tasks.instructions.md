# Task Backlog

## Now

- Keep CLI/core contracts stable.
- Keep `.ai/` guidance aligned with the source tree without making `.ai/` part of runtime execution.
- Keep `pnpm qa:usage` passing after workflow changes.
- Keep visual asset inventory and the read-only Studio `/assets` page current.
- Keep content and asset guard coverage aligned with the operator checklist.
- Keep `apps/studio` thin until shared service contracts exist.
- Keep first-push repo hygiene files and GitHub workflows passing.
- Keep direct provider/publish guard coverage and CI dependency audit passing.
- Keep release planning, changelog, package version, and stable git tag automation passing on
  `main`; feature branches should not manually bump `package.json`.
- Keep roadmap priority focused on the real local production loop, not additional unused
  infrastructure abstractions.
- Keep script review, warning acknowledgement, approval, and packaging bound to one exact content
  digest.
- Keep script review Markdown approval guidance synchronized with the enforced warning/blocker
  gates.
- Keep script revision snapshots, attribution, state rollback, and approval invalidation passing.
- Keep provider-backed generation behind per-video, daily, and weekly budget preflight.
- Keep future paid-generation quotes bound to exact package/config/pricing digests and require an
  exact matching approval above the configured threshold.
- Keep production-package generation, cost estimation, readiness, and evidence bound to one strict
  manifest covering every derived package artifact and the approved script digest.
- Keep atomic reservation, one-time quote-line consumption, active-reservation budget accounting,
  recoverable settlement, and explicit reconciliation passing.
- Keep future nonzero provider callbacks behind adapter identity matching, durable execution claim,
  local at-most-once dispatch, bounded timeout, and fail-closed outcome classification.
- Keep live Ollama generation fail-closed when local models return malformed JSON, English
  operator-facing text, or incomplete scripts.
- Keep idea and script provider failure diagnostics safe, raw-output-free, and state-preserving.
- Keep chunked Ollama script diagnostics and receipts complete enough to diagnose which draft or
  expansion chunk failed.
- Keep readiness diagnostics, production-loop next actions, and evidence synchronized with persisted
  run state.
- Keep evidence next-command guidance synchronized with current approval gates and review blockers.
- Keep `producer status` operator-readable while preserving `--json` for automation; approval ledger
  and warning details should stay visible in the default operator output. Missing, malformed, or
  stale evidence must label production media rows as artifact-record fallback rather than review
  proof.
- Keep all run-root filesystem access behind canonical bounded run-ID validation.
- Keep run artifact reads, writes, and persisted lists behind canonical relative-path validation.
- Keep state, ledger, cost, reservation, lock, and artifact access behind canonical
  existing-component symlink containment.
- Keep final protected files fail-closed when their filesystem link count indicates another pathname
  shares the same inode.
- Keep the capability inventory current when plugin/MCP versions or project phases materially
  change.
- Keep long-running goals resumable from Git state and `.ai/checkpoints/`, not chat history alone.

## Next

- Harden the Render Plan + Contact Sheet MVP with operator review refinements only where real use
  exposes gaps; do not turn it into render execution.
- Harden local TTS with continued Piper voice-quality QA. Keep models and generated audio ignored;
  the current implemented foundation is deterministic reference WAV, operator audio review Markdown,
  optional configured `local-piper` shell-out, pinned Turkish model setup into ignored `models/`,
  provider model/config digest provenance, local smoke evidence, and `producer doctor`
  setup/remediation next actions.
- Harden FFmpeg draft render visual polish; the current foundation is exact-approval-gated local MP4
  with intro/outro source-card bookends or source-frame sequences, scene-timed background plates,
  subtitle burn-in, lower-third, popup-card, waveform, watermark overlays, render manifest evidence,
  fail-closed `ffprobe` media validation, and an operator-readable
  `production/render/draft_review.md` checklist.
- Harden the idea repair prompt and idea-quality constraints with live qwen3 feedback. The
  implemented two-attempt retry loop either recovers to `IDEAS_GENERATED` or fails closed without
  idea artifacts while persisting a safe diagnostic summary. Live qwen3 QA now rejects repeated fit
  frames, generic fit boilerplate, repeated uncertainty openers, generic unknown-species phrases,
  weak premise action frames, English scientific leftovers, and repeated weak inspection/clue verbs.
  Continue tightening prompt and quality checks before treating qwen3 ideas as production-ready.
- Tune idea and script prompts so qwen3 avoids near-duplicate ideas, English style text, unsupported
  science framing, malformed labels, and repeated sentence loops. The parser now rejects exact
  duplicate idea titles/premises, duplicate `fit` explanations, repeated generic title motifs,
  repeated premise frames, repeated fit frames, repeated idea sentence loops, malformed brand
  fragments, copied English lane terms, repeated local-model boilerplate, English scientific
  leftovers such as `anomaly’sı`, and weak verbs such as `inceleyerek`/`yansıtmakta`; script
  expansion prompts now show previous chunks from the same section to reduce repeated sentence
  loops; prompt quality still needs to produce a consistently reviewable idea list.
- Harden script continuation and expansion quality for live qwen3. Malformed local-model `"text"`
  wrappers now have regression coverage for raw text, fences, trailing commas, missing closing
  quotes, and short external notes. Section and continuation blockers now get up to two bounded
  retries with raw-output-free receipt evidence. Live qwen3 `no_think` QA recovered from repeated
  section loops to `SCRIPT_GENERATED`, but the resulting 1015-word draft exposed a missing final
  word-floor check. Underfilled drafts now fail closed after bounded continuation passes; the next
  work is repeat live qwen QA and prompt/content-quality tuning rather than weakening blockers.
- Repeat live qwen3 script QA after prompt/label tuning. Known production-label variants now repair
  with section-receipt evidence; unrelated malformed labels must still fail closed without raw
  output persistence. Malformed-label and repeated-loop diagnostics now report safe category
  details, not raw labels or repeated sentences. Do not broaden label repair by guessing at raw
  output; add a variant only when it is safe, bounded, and regression-tested.
- Preserve the continuation design over simply raising local section chunk caps; live local QA
  showed larger chunks can destabilize JSON parse reliability.
- Keep continuation request schemas compatible with Ollama grammar limits; large accepted-text
  bounds belong in parser validation, not provider grammar schemas.
- Keep `producer doctor` config/provider/model/TTS/asset/publish diagnostics and evidence passing.
- Keep Studio read-only artifact previews useful as new artifact types are added. Current previews
  include operator-phase grouping, media-specific metadata, and per-artifact review wording while
  keeping the surface non-mutating.
- Keep Studio evidence panels conservative: missing, malformed, or stale evidence must point back to
  `producer evidence --run <run_id>` and must not imply blocked actions are absent or media is
  review-proof.
- Keep CLI status evidence panels equally conservative: production media rows may fall back to
  artifact records for visibility, but the text must say they are not current evidence proof.
- Keep the read-only Studio mutation-service status panel aligned with route-security and service
  contract changes; it must not become an approval form or route handler.
- Harden manual analytics feedback with import edge cases and richer comparisons while keeping data
  operator-provided and local-only. Run-linked summaries, unmapped-record visibility, non-causal
  repeat / avoid-without-revision / test-next prompts, simple confidence/missingness framing, and
  the basic read-only Studio analytics overview with import data-quality and report freshness
  summaries are implemented.
- Maintain typed Studio mutation service contracts that both CLI and web can use before adding
  Studio mutations. Current contracts cover future idea/script/cost/render approvals plus disabled
  upload/publish actions; concrete CSRF/session handling and route implementations remain deferred.
- Define local prompt override storage and revision events before adding a prompt editor; typed
  keys, tracked `prompts/defaults/` runtime defaults, source paths, and prompt hashes are
  implemented.
- Define revision events for subtitles, scene prompts, popup cards, and YouTube metadata edits;
  script revision evidence is implemented.
- Maintain route security requirements before any web action routes exist; current tests cover
  read-only page routes, disabled future action routes, and absence of App Router `route.ts`
  handlers, and bind each disabled action route to a shared service contract.
- Keep the internal reserved-provider execution contract ready for a separately approved real
  adapter without adding paid SDKs, credentials, or operator execution commands.

## Later

- Repeat live Ollama generation QA after provider, prompt, or model-setting changes.
- YouTube Analytics API only after manual analytics import/reporting proves useful.
- Private YouTube upload behind upload approval and explicit config.
- Public/scheduled publish only after separate risk review.

## Do Not Do Yet

- Do not implement Studio mutations before shared service contracts, route security requirements,
  and negative tests exist.
- Do not add paid APIs.
- Do not add paid/generative media providers before deterministic local planning, TTS, and render
  flows are useful.
- Do not implement upload or publish.
- Do not create a second state machine in frontend code.
- Do not infer approvals from files or readiness output.
