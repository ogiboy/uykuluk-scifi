# Safeguards

- `ApprovalGuard` blocks stage execution unless required prior approval exists.
- `BudgetGuard` records local cost evidence and blocks budget overflow, including active and
  uncertain reservations across runs.
- Provider-backed generation runs a stage-pricing ledger preflight before invoking the provider,
  then enforces the recorded usage decision again before writing generated artifacts.
- Estimates above the approval threshold require an exact content-addressed paid-generation cost
  approval before readiness.
- `CostReservationService` atomically consumes an approved quote line once and journals release,
  pending settlement, settlement, uncertainty, and reconciliation without calling a provider.
- `Readiness` consumes the persisted cost estimate decision; a blocked estimate prevents manual
  production readiness.
- `RunStore` rejects malformed or schema-invalid state and replaces JSON files atomically.
- `RunPaths` rejects traversal-shaped, absolute, whitespace-bearing, or oversized run identifiers
  before constructing any run-root path.
- `ArtifactPaths` rejects absolute, traversal-shaped, separator-ambiguous, malformed, or oversized
  artifact names before reads, writes, ledger events, or state persistence.
- `ContentGuard` provides heuristic warnings for script review, including excessive clickbait
  titles.
- `PublishGuard` keeps upload and publish disabled by default.
- `AssetGuard` inventories logo, watermark, overlays, intro, and outro inputs.

Passing readiness does not approve render, upload, or publish.
