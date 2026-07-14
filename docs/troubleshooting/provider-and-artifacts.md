# Provider and Artifact Troubleshooting

Start with observed state. Do not repair run JSON, copy files into canonical paths, or bypass an
approval because an artifact appears to exist.

## Doctor First

```bash
pnpm producer doctor
pnpm producer doctor --json
```

Doctor checks ignored config, local provider connectivity, served model identity, prompt overrides,
TTS, FFmpeg/ffprobe, assets, and safe upload/publish defaults. Its diagnostics are redacted and do
not create a run or grant approval.

## Provider Is Unavailable

- `mock`: verify config still selects mock mode.
- Ollama: start Ollama, confirm the loopback URL, and verify the configured model appears in
  `/api/tags`.
- llama.cpp: start the configured server, confirm the loopback URL, and verify the configured alias
  appears in `/v1/models`.
- Piper: verify the binary, model path, and config path; rerun `pnpm tts:piper:setup` if local model
  files are absent.
- ElevenLabs: verify only that the server-side key is configured. Never print it. A denied plan,
  missing production rights, metadata drift, or unavailable preview should remain a visible
  fail-closed result.

Local base URLs are restricted to credential-free loopback HTTP(S). LAN or hosted OpenAI-compatible
endpoints are not accepted by the local adapters.

## Catalog or Preview Is Stale

Refresh the catalog explicitly, then request a new preview by persisted voice ID. A failed refresh
supersedes preceding active evidence; archived bytes remain audit-only. Studio never accepts a
provider URL as input.

## Quote or Paid Execution Is Blocked

Regenerate the estimate after the current selection and package are stable. Approve the exact quote
digest when required. Hosted execution needs the exact binding digest, quote digest, approval ID,
and explicit paid-operation confirmation together.

Active, settlement-pending, and uncertain reservations continue consuming budget. Do not retry a
provider call blindly. Use persisted operation/spool/settlement evidence and the existing recovery
path. Reconcile only with explicit operator attribution and provider evidence.

## Evidence Is Missing or Invalid

```bash
pnpm producer evidence --run <run_id>
pnpm producer readiness --run <run_id>
pnpm producer status --run <run_id>
```

These commands re-read registered artifacts and show the next safe action. Missing, malformed,
tampered, stale, or unregistered files remain non-authoritative.

Common causes:

- a source artifact changed after review or approval;
- a config, pricing, selection, subtitle, or render-plan digest changed;
- a generated file exists but is not registered in `state.json`;
- the artifact belongs to another run;
- a path is non-canonical or escapes the run directory;
- legacy hosted voice evidence has no aligned subtitle descriptor.

## Revise Instead of Editing State

- Script: `producer revise script`.
- Package artifact: `producer revise package-artifact`.
- Voice selection before spend: `producer voice-reselect`.
- Rejected local render: record the decision, then `producer revise render`.

Revision commands archive old evidence, invalidate stale approvals, and return the run to the proper
guard. Never edit `state.json`, ledgers, reservations, or digests by hand.

## Studio Media Does Not Play

The media route serves only allowlisted, registered, contained artifacts. Preview audio must be
under `production/audio/voice-previews/<voice_id>/` and match persisted evidence. Caption delivery
requires validated active voice/subtitle evidence; legacy ElevenLabs output without aligned SRT
returns unavailable instead of using a silent fallback.

## FFmpeg Render Is Blocked

Verify `ffmpeg` and `ffprobe` are on `PATH`, then inspect readiness and exact render approval.
Render approval must match the current audio, voice evidence, subtitle descriptor, render plan, and
media digests. Re-approve after any revision.

## Safe Escalation

If the persisted provider outcome is uncertain, stop. Preserve redacted diagnostics, operation ID,
reservation state, and artifact digests. Resolve provider-side state before allowing another paid
attempt or external effect.
