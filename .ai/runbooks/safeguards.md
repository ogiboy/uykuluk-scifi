# Safeguards

- `ApprovalGuard` blocks stage execution unless required prior approval exists.
- `BudgetGuard` records local cost evidence and blocks budget overflow.
- `Readiness` consumes the persisted cost estimate decision; a blocked estimate prevents manual
  production readiness.
- `ContentGuard` provides heuristic warnings for script review.
- `PublishGuard` keeps upload and publish disabled by default.
- `AssetGuard` warns when brand assets are missing.

Passing readiness does not approve render, upload, or publish.
