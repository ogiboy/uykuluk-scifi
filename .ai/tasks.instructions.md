# Task Backlog

## Now

- Keep CLI/core contracts stable.
- Keep `.ai/` guidance aligned with the source tree.
- Keep `pnpm qa:usage` passing after workflow changes.
- Keep visual asset inventory current.
- Keep `apps/studio` thin until shared service contracts exist.
- Keep first-push repo hygiene files and GitHub workflows passing.
- Keep direct provider/publish guard coverage and CI dependency audit passing.
- Keep script review, approval, and packaging bound to one exact content digest.
- Keep readiness diagnostics and evidence synchronized with persisted run state.

## Next

- Add read-only run index and run detail routes to `apps/studio`.
- Define typed read/write service contracts that both CLI and web can use.
- Define prompt template keys, prompt hash metadata, and local prompt override storage before adding
  a prompt editor.
- Define revision events for script, subtitles, scene prompts, popup cards, and YouTube metadata
  edits.
- Add a `producer doctor` command for provider and asset readiness.
- Move tracked prompt defaults into typed runtime templates before adding prompt editing.
- Add route security requirements before any web action routes exist.

## Later

- Real Ollama readiness checks.
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
