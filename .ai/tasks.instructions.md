# Task Backlog

## Now

- Keep CLI/core contracts stable.
- Keep `.ai/` guidance aligned with the source tree without making `.ai/` part of runtime execution.
- Keep `pnpm qa:usage` passing after workflow changes.
- Keep visual asset inventory current.
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
- Keep script provider failure diagnostics safe, raw-output-free, and state-preserving.
- Keep chunked Ollama script receipts complete enough to diagnose which draft or expansion chunk
  failed.
- Keep readiness diagnostics and evidence synchronized with persisted run state.
- Keep evidence next-command guidance synchronized with current approval gates and review blockers.
- Keep `producer status` operator-readable while preserving `--json` for automation.
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
- Harden local TTS with real Piper voice-quality QA and operator guidance. Keep models and generated
  audio ignored; the current implemented foundation is deterministic reference WAV, optional
  configured `local-piper` shell-out, and pinned Turkish model setup into ignored `models/`.
- Harden FFmpeg draft render composition with scene timing, popup cards, waveform overlays,
  intro/outro usage, and operator preview checks; the current foundation is exact-approval-gated
  local MP4 plus render manifest.
- Add a bounded long-form continuation or quality-improvement pass so qwen3:8b drafts satisfy
  long-form and hook quality expectations instead of only producing safe short reviewable drafts.
- Prefer continuation/retry designs over simply raising local section chunk caps; live local QA
  showed larger chunks can destabilize JSON parse reliability.
- Keep `producer doctor` config/provider/model/TTS/asset/publish diagnostics and evidence passing.
- Harden Studio read-only artifact previews with better grouping, media-specific metadata, and
  operator review wording while keeping the surface non-mutating.
- Harden manual analytics feedback with import edge cases, run-link summaries, and future Studio
  read-only views while keeping data operator-provided and local-only.
- Define typed read/write service contracts that both CLI and web can use before adding Studio
  mutations.
- Define local prompt override storage and revision events before adding a prompt editor; typed
  keys, tracked `prompts/defaults/` runtime defaults, source paths, and prompt hashes are
  implemented.
- Define revision events for subtitles, scene prompts, popup cards, and YouTube metadata edits;
  script revision evidence is implemented.
- Add route security requirements before any web action routes exist.
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
