# Frontend Dashboard Workflow

Use before implementing any Next.js Producer Studio work.

## Design Direction

- Build an operator production desk, not a landing page.
- Prioritize runs, state, approvals, warnings, costs, artifacts, and next safe action.
- Use compact panels, tables, tabs, dialogs, and clear status badges.
- Avoid decorative hero sections, stock-like imagery, and oversized marketing layout.
- Use committed UykulukSciFi assets where visual context helps the operator.

## Architecture Rules

- CLI/core remains the source of truth.
- Web routes call typed local service contracts.
- Do not shell out to arbitrary user-provided commands.
- Do not duplicate the state machine in React code.
- Do not infer approval from files.
- Do not implement upload or publish controls until the CLI has the same gate.

## Expected First Increment

1. Read-only run index.
2. Read-only run detail with artifacts and evidence.
3. Read-only asset inventory.
4. Readiness panel.
5. Browser QA screenshots and route tests.

Approval mutations should come after read-only truth is stable.

## QA

- `pnpm lint`
- `pnpm typecheck`
- frontend build
- route handler tests
- browser screenshot checks for desktop and mobile
- `pnpm qa:usage` remains green
