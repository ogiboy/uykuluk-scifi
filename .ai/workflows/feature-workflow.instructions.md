# Feature Workflow

Use for CLI, provider, stage, safeguard, asset, docs, or future dashboard changes.

## Sequence

1. State the operator outcome and non-goals.
2. Identify the owning contract: core, stage, safeguard, provider, costs, assets, QA, docs, or
   frontend.
3. Update schema/types before behavior when contracts change.
4. Implement the smallest coherent slice.
5. Persist evidence for important workflow steps.
6. Add focused tests.
7. Run broad checks when the change crosses contracts.
8. Update roadmap or `.ai` files for durable decisions.

## Acceptance Criteria

- No approval gate is weakened.
- No publish/upload path is enabled by default.
- Operator-visible errors are clear.
- Artifacts remain inspectable and resumable.
- Tests cover normal, blocked, and edge behavior.
