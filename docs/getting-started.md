# Getting Started

UykulukSciFi Producer is local-first. A fresh clone can run the mock-backed workflow without paid
credentials. Hosted providers remain optional and fail closed when configuration, approval, budget,
or evidence is incomplete.

## Requirements

- macOS or Linux development environment.
- Node.js 22 or newer.
- Corepack and the repository-pinned `pnpm@11.9.0`.
- Git.
- FFmpeg and `ffprobe` for draft rendering.
- Optional: Ollama or a local `llama-server` for local generation.
- Optional: Python `uv` and Piper for local Turkish speech.

## Install

```bash
git clone https://github.com/ogiboy/uykuluk-scifi.git
cd uykuluk-scifi
corepack enable
pnpm install
pnpm producer init
```

`producer init` creates ignored `producer.config.json` when it is absent. Keep provider mode `mock`
for the credential-free first run. Do not commit local config, `.env`, tokens, generated runs,
downloaded models, or diagnostic artifacts.

## Environment

Copy only the environment templates required by your setup:

```bash
cp .env.example .env
cp apps/studio/.env.example apps/studio/.env.local
```

Blank optional values are valid. `ELEVENLABS_API_KEY` is required only for explicitly requested
ElevenLabs operations. Sentry remains disabled when its DSN is blank. Secrets stay server-side and
must never use a `NEXT_PUBLIC_` name unless the value is intentionally public.

## Verify the Local Setup

```bash
pnpm producer doctor
pnpm producer doctor --json
```

Doctor checks config, local LLM connectivity, TTS, FFmpeg/ffprobe, assets, prompt overrides, and
safe publish defaults. It writes ignored redacted diagnostics and grants no approval.

## Start Studio

```bash
pnpm studio
```

Open the loopback URL printed by Next.js. Studio reads the same run state and typed services as the
CLI/core. It is not a separate workflow engine.

For a production build:

```bash
pnpm studio:build
pnpm studio:start
```

## First Run

1. Confirm the Doctor page is healthy or read its repair guidance.
2. Create an idea run in Studio.
3. Review and approve one idea.
4. Generate, review, and approve the script.
5. Generate the production package and render plan.
6. Use local voice fallback or explicitly configure and audition ElevenLabs.
7. Review subtitles, visual plan, evidence, cost, and readiness before render approval.
8. Render and review the local MP4.

Private YouTube upload is a pending v1 deliverable. Public and scheduled publishing are unavailable.

## Next Reading

- [Studio workflow](operator-guide/studio-workflow.md)
- [Voice providers](providers/voice.md)
- [Troubleshooting](troubleshooting/provider-and-artifacts.md)
- [Security model](security/operating-model.md)
