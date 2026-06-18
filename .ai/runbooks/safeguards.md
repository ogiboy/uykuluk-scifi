# Safeguards

- `ApprovalGuard` blocks stage execution unless required prior approval exists.
- `BudgetGuard` records local cost evidence and blocks budget overflow.
- `Readiness` consumes the persisted cost estimate decision; a blocked estimate prevents manual
  production readiness.
- `RunStore` rejects malformed or schema-invalid state and replaces JSON files atomically.
- `ContentGuard` provides heuristic warnings for script review, including excessive clickbait
  titles.
- `PublishGuard` keeps upload and publish disabled by default.
- `AssetGuard` inventories logo, watermark, overlays, intro, and outro inputs.

Passing readiness does not approve render, upload, or publish.
