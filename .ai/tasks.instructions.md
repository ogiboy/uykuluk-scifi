# Task Backlog

## Now

- Keep CLI/core contracts stable.
- Keep `.ai/` guidance aligned with the source tree.
- Keep `pnpm qa:usage` passing after workflow changes.
- Keep visual asset inventory current.
- Keep content and asset guard coverage aligned with the operator checklist.
- Keep `apps/studio` thin until shared service contracts exist.
- Keep first-push repo hygiene files and GitHub workflows passing.
- Keep direct provider/publish guard coverage and CI dependency audit passing.
- Keep script review, approval, and packaging bound to one exact content digest.
- Keep script revision snapshots, attribution, state rollback, and approval invalidation passing.
- Keep provider-backed generation behind per-video, daily, and weekly budget preflight.
- Keep future paid-generation quotes bound to exact package/config/pricing digests and require an
  exact matching approval above the configured threshold.
- Keep production-package generation, cost estimation, readiness, and evidence bound to one strict
  manifest covering every derived package artifact and the approved script digest.
- Keep atomic reservation, one-time quote-line consumption, active-reservation budget accounting,
  recoverable settlement, and explicit reconciliation passing.
- Keep readiness diagnostics and evidence synchronized with persisted run state.
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

- Define the first paid-provider adapter contract around `reserveApprovedCost` as the only allowed
  pre-call path, including timeout/failure reconciliation and negative bypass tests.
- Add read-only run index and run detail routes to `apps/studio`.
- Define typed read/write service contracts that both CLI and web can use.
- Define local prompt override storage and revision events before adding a prompt editor; typed
  keys, tracked runtime defaults, source paths, and prompt hashes are implemented.
- Define revision events for subtitles, scene prompts, popup cards, and YouTube metadata edits;
  script revision evidence is implemented.
- Keep `producer doctor` config/provider/model/asset/publish diagnostics and evidence passing.
- Add route security requirements before any web action routes exist.

## Later

- Live Ollama generation QA on an operator machine with the configured model installed.
- Local TTS behind script approval and cost estimate.
- FFmpeg render behind render approval.
- Private YouTube upload behind upload approval and explicit config.
- Public/scheduled publish only after separate risk review.

## Do Not Do Yet

- Do not implement Next.js routes or components before the dashboard plan is accepted.
- Do not add paid APIs.
- Do not implement upload or publish.
- Do not create a second state machine in frontend code.
- Do not infer approvals from files or readiness output.
