# Local Development

```sh
pnpm install
pnpm producer init
pnpm producer doctor
pnpm test
pnpm lint
pnpm typecheck
```

Mock mode is the default and should remain the default for tests.

`producer doctor` writes ignored project evidence under `diagnostics/`. In Ollama mode it checks
server reachability and model inventory only; it does not generate content.
