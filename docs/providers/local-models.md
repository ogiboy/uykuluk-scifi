# Local Model Providers

The default `mock` provider supports a credential-free deterministic workflow. Ollama and
`llama.cpp` are replaceable local engines behind the same bounded parsers, budgets, receipts, and
failure diagnostics.

## Mock

Keep `providers.llm.mode` as `mock` for installation checks, parser-contract tests, and CI. Mock
mode requires no network access and cannot prove real episode quality.

## Ollama

Example ignored `producer.config.json` fragment:

```json
{
  "providers": {
    "llm": {
      "mode": "ollama",
      "ollamaBaseUrl": "http://localhost:11434",
      "model": "qwen3:8b",
      "thinkingMode": "default",
      "maxOutputTokens": { "ideas": 3000, "script": 3200, "productionPackage": 2000 }
    }
  }
}
```

Only credential-free loopback HTTP(S) origins are accepted. Doctor checks `/api/tags` and blocks
when the configured model is not served.

## llama.cpp

```json
{
  "providers": {
    "llm": {
      "mode": "llama.cpp",
      "llamaCppBaseUrl": "http://localhost:8080",
      "model": "Mistral-7B-Instruct-v0.3.Q4_K_M.gguf",
      "requestTimeoutMs": 120000,
      "maxOutputTokens": { "ideas": 3000, "script": 3200, "productionPackage": 2000 }
    }
  }
}
```

```bash
pnpm model:start
pnpm model:stop
```

The helper verifies the ignored GGUF, starts a loopback `llama-server`, preserves the configured
served alias, and writes an ignored PID. `LLAMA_CPP_SERVER_BINARY` and `LLAMA_CPP_CTX_SIZE` are
optional local overrides. Doctor checks `/v1/models`.

## Bounded Generation

Generation uses structured outputs, parser validation, token caps, timeouts, bounded repair retries,
and redacted receipts. Invalid JSON, repeated boilerplate, unsafe labels, incomplete scripts, reused
titles, or provider transport failures stop before the next canonical artifact is written.

`thinkingMode` may be `default`, `think`, or `no_think`. Local model quality remains an operator
evaluation decision; serving a model does not make it production-ready.

## Prompt Overrides

Tracked defaults live in:

- `prompts/defaults/planner-task.md`;
- `prompts/defaults/scriptwriter-task.md`;
- `prompts/defaults/production-package-task.md`.

Experiments belong under ignored `prompts/local/` and must be explicitly selected:

```json
{ "prompts": { "overrides": { "ideas": "prompts/local/planner-experiment.md" } } }
```

Overrides are restricted to non-empty Markdown files under `prompts/local/`. New work uses the
current prompt snapshot; existing artifacts and approvals do not change automatically.

## Candidate Evaluation

Use the commands in [CLI reference](../reference/cli.md#local-model-evaluation). Reports contain
hashes, token/duration metadata, applied override names, parser results, and a deterministic
recommendation when a candidate passes. Raw model output is not retained.

## Local MFLUX visual runtime

MFLUX is the curated credential-free local image-generation runtime. Studio owns the operator
lifecycle and rejects arbitrary model URLs, commands, paths, or runtime flags.

- Package: `mflux-flux2-klein-4b-q4` (`FLUX.2 Klein 4B`, q4)
- Runtime: MFLUX `0.18.0` on Python `3.12`
- Model: `mlx-community/flux2-klein-4b-4bit`, pinned revision
  `860e87183ceb29e39627c0612ebd66d8ea66e68c`
- Conservative disk estimate: 6.5 GB; initial duration estimate: 10 minutes; USD 0 cost

In Studio Settings, **Review install** or **Verify runtime** first persists an exact preflight. The
operator then confirms that digest, enters an approver identity, and explicitly queues the
operation. A detached local worker reports queued/running/progress/succeeded/failed/interrupted
state; interrupted work is recoverable by submitting a new intent. Setup and verification write a
fixed readiness marker only after the worker succeeds. Verification checks the offline install
manifest and does not download a model.

After readiness, **Review smoke** prepares a separate bounded 1024x576 smoke estimate. Real setup,
verification, and smoke execution are intentionally not run in CI or documented as completed; run
them only after the exact Studio preflight has been approved on the target machine.

When `mflux-local` is enabled and ready, Studio generates selected scenes sequentially. Each
revision records model/runtime revisions, quantization, deterministic seed, prompt/settings digests,
dimensions, operation ID, and measured generation duration. Generated revisions enter the existing
visual review flow; only an explicit operator action can activate the canonical revision.
Static/manual and BFL revisions remain compatible and retain their provenance.

### Python environment ownership

`tools/mflux/pyproject.toml` and `tools/mflux/uv.lock` are the committed source of truth for this
optional Python tool. They change together. `uv` owns the isolated `tools/mflux/.venv/`; do not add
packages with `pip`, share this environment with the Node workspace, or commit the environment
itself.

Studio is the normal operator path. It records the approved preflight before creating the
environment or downloading a model. The following commands are intentionally for local diagnosis or
recovery; none downloads the model by itself:

```bash
pnpm mflux:env:status
pnpm mflux:env:sync
pnpm mflux:env:check
eval "$(pnpm --silent mflux:env:activate)"
pnpm mflux:env:remove -- --yes
pnpm mflux:env:recreate -- --yes
```

`sync` verifies the committed lock and creates or updates only the isolated virtual environment.
`check` is locked, offline, and does not synchronize dependencies. `activate` prints a shell command
instead of changing the caller's shell. Removal and recreation require `--yes`; they delete only
`tools/mflux/.venv`, never the separately managed model weights under
`models/visual/mflux/flux2-klein-4b-q4` or the operation state under `.local-models/mflux`.

All durable local model weights follow the repository's shared `models/` convention: language models
live under `models/llm`, Piper voices under `models/piper`, and MFLUX image weights under
`models/visual`. The ignored `.local-models/` directory contains only app-managed queue, lock,
readiness, and recovery state. Older MFLUX installs are migrated from `.local-models/mflux/model` to
the canonical visual-model directory by the bounded worker before its next approved operation.

The committed VS Code workspace maps Python tooling only to `tools/mflux` and discovers its
project-local virtual environment. Pylance, Black, and isort are recommended for the worker source.
Python terminal `.env` injection stays disabled so root provider credentials are not copied into the
tool environment; the Node boundary passes only its explicit environment allowlist to the worker.
Python test discovery is intentionally not enabled because the executable contract is covered by the
Node integration tests that invoke the real command boundary.

For an intentional runtime dependency update, use `uv` against `tools/mflux`, review the package
name and lockfile diff, commit the updated `pyproject.toml` and `uv.lock` together, then validate
with `uv lock --check --project tools/mflux` and a locked sync. This dependency review is a
development-time supply-chain check, not a Studio runtime feature. CircleCI repeats the lock check
and compiles the worker in a small parallel Python-contract lane; it does not synchronize the
environment, download the model, or run a real generation.
