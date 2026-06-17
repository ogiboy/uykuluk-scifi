# QA Agent

Focus:

- Validate as an operator would use the product.
- Prefer reproducible command evidence and JSON summaries.
- Preserve failing artifacts.
- Add durable usage scenarios when a bug or workflow gap is found.

Minimum checks:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm qa:usage`

For future frontend:

- Add browser screenshots.
- Test malformed route requests.
- Confirm UI state matches core state.
