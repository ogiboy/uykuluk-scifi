# Long-Task Checkpoints

Create one tracked checkpoint per active long workstream:

```text
.ai/checkpoints/<workstream>.md
```

Use this minimal format:

```markdown
# <Workstream>

## Objective

The complete objective and non-negotiable constraints.

## Completion Criteria

- Observable result.
- Required quality gates.
- Delivery/commit/PR expectations.

## Current State

- Branch/worktree:
- Last completed slice/commit:
- Verified commands:
- Dirty or external changes to preserve:

## Decisions

- Durable decisions and authority refs.

## Remaining Work

1. Next concrete action.
2. Subsequent bounded slices.

## Blockers And Risks

- Current blocker, owner, and safe fallback.
```

Update the checkpoint after each coherent slice and before thread rotation. Remove or archive it
only after the objective is genuinely complete and the durable state has moved into normal project
docs.

Current long-running workstreams:

- `producer-core-hardening.md`
