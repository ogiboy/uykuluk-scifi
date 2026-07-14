# Run Artifacts and Evidence

Each run lives under `runs/<run_id>/`. Generated run directories are ignored except `runs/.gitkeep`.
Paths are bounded canonical relative paths; absolute paths, dot segments, backslashes, traversal,
and final symlink escape are rejected.

## Core State

- `state.json`: schema-validated run state, approvals, warnings, and registered artifact paths.
- `ledger.jsonl`: append-only workflow and guard events.
- `costs/ledger.jsonl`: settled cost events.
- `costs/reservations.jsonl`: reservations, execution identity, settlement, and reconciliation.
- `evidence_bundle.json` and `.md`: validated operator evidence summary.
- `diagnostics/readiness.json` and `.md`: fail-closed readiness results and next action.

File presence is not evidence. Consumers must validate registration, schema, identity, digests,
freshness, approval bindings, and relevant provider metadata.

## Ideas and Scripts

- `ideas.json` and `ideas.md`.
- `script.md`, `script.sections.json`, and `script.meta.json`.
- `reviews/script_review.json` and `.md`.
- `revisions/script/<revision_id>/`: before/after content, invalidated review snapshots,
  attribution, reason, and revision metadata.

Provider failures use redacted diagnostics such as `diagnostics/ideas_generation_failure.json` and
`diagnostics/script_generation_failure.json`; rejected raw provider text is not persisted.

## Production Package

- `production/voiceover.txt`: spoken narrator text only.
- `production/subtitles.srt`: package subtitle source and local fallback input.
- `production/scenes.json`: scene prompts and timing structure.
- `production/youtube_metadata.json`: title, description, tags, and chapter inputs.
- `production/production_package.md` and `.meta.json`: review package and bound artifact digests.
- `revisions/package/<revision_id>/`: bounded attributable artifact revisions.

## Voice and Subtitles

- `production/audio/voice-candidates/*.json`: append-only redacted candidate catalogs.
- `production/audio/voice-previews/<voice_id>/`: local preview audio and evidence.
- `production/audio/voice-selections/*.json`: attributable immutable selections.
- `revisions/voice-selection/<revision_id>/`: archived pre-spend selection and quote evidence.
- `production/audio/voiceover.wav`: active production or fallback audio.
- `production/audio/voiceover.meta.json`: provider, output, timing, digest, and paid-execution
  evidence.
- `production/audio/voiceover_review.md`: operator review handoff.
- `production/audio/subtitles.aligned.srt`: publish-readable subtitle cues derived from verified
  ElevenLabs original alignment.
- `production/audio/subtitles.aligned.meta.json`: timing mode, algorithm version, thresholds,
  alignment digest, audio digest, and source/prepared span evidence.

Piper and deterministic-local use explicit `linear-fallback` timing. Legacy ElevenLabs evidence
without aligned SRT is incomplete and cannot silently use the local fallback.

## Visual and Render

- `production/render_plan.json`.
- `production/storyboard_contact_sheet.md`.
- `production/asset_provenance.json`.
- `production/render/draft.mp4`.
- `production/render/render_manifest.json`.
- `production/render/draft_review.md`.
- `production/render/youtube_chapters.json` and `.md`.

Exact render approval binds the active voice audio, voice evidence, subtitle descriptor, render
plan, and approved media digests. FFmpeg uses only the validated active subtitle descriptor.

## Final Review and Manual Handoff

- `production/review_bundle.json` and `.md`.
- `production/thumbnail_candidates.json` and `.md`.
- `production/channel_handoff.json` and `.md`.
- `production/channel_handoff_decision.json` and `.md`.

These artifacts prepare a local manual channel handoff. They do not grant upload or publishing
authority.

## Project-Local Diagnostics

`diagnostics/`, `analytics/`, downloaded `models/`, generated audio/video, and local run directories
remain ignored. `.ai/` contains development guidance and checkpoints only and is never a runtime
dependency.
