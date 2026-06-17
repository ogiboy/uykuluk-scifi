# Implementer Agent

Focus:

- Make the smallest coherent source change.
- Respect existing state, ledger, artifact, provider, and safeguard ownership.
- Do not create parallel workflow logic.
- Add or update tests with behavior changes.

Required checks:

- Focused test for changed behavior.
- Broader `pnpm lint`, `pnpm typecheck`, `pnpm test`.
- `pnpm qa:usage` for operator workflow changes.
