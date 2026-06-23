type CostQuoteNextStep = {
  invalid?: boolean;
  approvalRequired: boolean;
  approved: boolean;
} | null;

type ScriptReviewNextStep = {
  scriptReviewBlockerCount?: number;
  scriptReviewWarningCount?: number;
};

type RenderPlanNextStep = {
  status?: string;
} | null;

type VoiceoverNextStep = {
  status?: string;
} | null;

type DraftRenderNextStep = {
  status?: string;
} | null;

/** Returns the next safe operator action represented by an evidence snapshot. */
export function evidenceNextCommand(
  state: string,
  costQuote: CostQuoteNextStep,
  hasUnresolvedCostReservation: boolean,
  scriptReview: ScriptReviewNextStep = {},
  renderPlan: RenderPlanNextStep = null,
  voiceoverAudio: VoiceoverNextStep = null,
  draftRender: DraftRenderNextStep = null,
  ttsEnabled = false,
): string {
  if (hasUnresolvedCostReservation) {
    return "Internal cost reconciliation is required; no operator CLI is available.";
  }
  if (state === "SCRIPT_REVIEWED") {
    if ((scriptReview.scriptReviewBlockerCount ?? 0) > 0) {
      return "Resolve blocking script review findings before approval.";
    }
    if ((scriptReview.scriptReviewWarningCount ?? 0) > 0) {
      return "pnpm producer approve script --run <run_id> --acknowledge-warnings";
    }
    return "pnpm producer approve script --run <run_id>";
  }
  const commands: Record<string, string> = {
    NEW: "pnpm producer ideas",
    IDEAS_GENERATED: "pnpm producer approve idea --run <run_id> --idea <idea_id>",
    IDEA_APPROVED: "pnpm producer script --run <run_id>",
    SCRIPT_GENERATED: "pnpm producer review script --run <run_id>",
    SCRIPT_APPROVED: "pnpm producer package --run <run_id>",
    PRODUCTION_PACKAGE_GENERATED:
      renderPlan?.status === "pass"
        ? "pnpm producer estimate --run <run_id>"
        : "pnpm producer render-plan --run <run_id>",
    COST_ESTIMATED: costQuote?.invalid
      ? "pnpm producer estimate --run <run_id> (cost quote is invalid and must be regenerated)"
      : costQuote?.approvalRequired && !costQuote.approved
        ? "pnpm producer approve cost --run <run_id>"
        : "pnpm producer readiness --run <run_id>",
    PAID_GENERATION_COST_APPROVED: "pnpm producer readiness --run <run_id>",
    READY_FOR_MANUAL_PRODUCTION:
      voiceoverAudio?.status === "pass"
        ? "pnpm producer approve render --run <run_id>"
        : ttsEnabled
          ? "pnpm producer voice --run <run_id>"
          : "Manual production review. Enable local TTS before draft render.",
    RENDER_APPROVED:
      draftRender?.status === "pass"
        ? "Manual draft render review. Upload remains approval-gated."
        : "pnpm producer render --run <run_id>",
    RENDERED:
      draftRender?.status === "pass"
        ? "Manual final draft review. Upload remains approval-gated."
        : "Regenerate evidence; draft render artifacts are missing or blocked.",
  };
  return commands[state] ?? "Review state and ledger before continuing.";
}
