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
- Keep provider-backed generation behind per-video, daily, and weekly budget preflight.
- Keep readiness diagnostics and evidence synchronized with persisted run state.

## Next

- Add read-only run index and run detail routes to `apps/studio`.
- Define typed read/write service contracts that both CLI and web can use.
- Define local prompt override storage and revision events before adding a prompt editor; typed
  keys, tracked runtime defaults, source paths, and prompt hashes are implemented.
- Define revision events for script, subtitles, scene prompts, popup cards, and YouTube metadata
  edits.
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
