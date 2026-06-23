type CostQuoteNextStep = {
  invalid?: boolean;
  approvalRequired: boolean;
  approved: boolean;
} | null;

/** Returns the next safe operator action represented by an evidence snapshot. */
export function evidenceNextCommand(
  state: string,
  costQuote: CostQuoteNextStep,
  hasUnresolvedCostReservation: boolean,
): string {
  if (hasUnresolvedCostReservation) {
    return "Internal cost reconciliation is required; no operator CLI is available.";
  }
  const commands: Record<string, string> = {
    NEW: "pnpm producer ideas",
    IDEAS_GENERATED: "pnpm producer approve idea --run <run_id> --idea <idea_id>",
    IDEA_APPROVED: "pnpm producer script --run <run_id>",
    SCRIPT_GENERATED: "pnpm producer review script --run <run_id>",
    SCRIPT_REVIEWED: "pnpm producer approve script --run <run_id>",
    SCRIPT_APPROVED: "pnpm producer package --run <run_id>",
    PRODUCTION_PACKAGE_GENERATED: "pnpm producer estimate --run <run_id>",
    COST_ESTIMATED: costQuote?.invalid
      ? "pnpm producer estimate --run <run_id> (cost quote is invalid and must be regenerated)"
      : costQuote?.approvalRequired && !costQuote.approved
        ? "pnpm producer approve cost --run <run_id>"
        : "pnpm producer readiness --run <run_id>",
    PAID_GENERATION_COST_APPROVED: "pnpm producer readiness --run <run_id>",
    READY_FOR_MANUAL_PRODUCTION: "Manual production review. Render/upload remain approval-gated.",
  };
  return commands[state] ?? "Review state and ledger before continuing.";
}
