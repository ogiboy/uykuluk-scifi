# Local LLM Providers

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
