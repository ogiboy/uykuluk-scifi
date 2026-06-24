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

type EvidenceNextCommandInput = {
  costQuote: CostQuoteNextStep;
  draftRender?: DraftRenderNextStep;
  hasUnresolvedCostReservation: boolean;
  renderPlan?: RenderPlanNextStep;
  scriptReview?: ScriptReviewNextStep;
  state: string;
  ttsEnabled?: boolean;
  voiceoverAudio?: VoiceoverNextStep;
};

const STATIC_NEXT_COMMANDS: Record<string, string> = {
  IDEA_APPROVED: "pnpm producer script --run <run_id>",
  IDEAS_GENERATED: "pnpm producer approve idea --run <run_id> --idea <idea_id>",
  NEW: "pnpm producer ideas",
  PAID_GENERATION_COST_APPROVED: "pnpm producer readiness --run <run_id>",
  SCRIPT_APPROVED: "pnpm producer package --run <run_id>",
  SCRIPT_GENERATED: "pnpm producer review script --run <run_id>",
};

/** Returns the next safe operator action represented by an evidence snapshot. */
export function evidenceNextCommand(input: EvidenceNextCommandInput): string {
  const {
    costQuote,
    draftRender = null,
    hasUnresolvedCostReservation,
    renderPlan = null,
    scriptReview = {},
    state,
    ttsEnabled = false,
    voiceoverAudio = null,
  } = input;
  if (hasUnresolvedCostReservation) {
    return "Internal cost reconciliation is required; no operator CLI is available.";
  }
  if (state === "SCRIPT_REVIEWED") {
    return scriptReviewNextCommand(scriptReview);
  }
  return (
    dynamicNextCommand({ costQuote, draftRender, renderPlan, state, ttsEnabled, voiceoverAudio }) ??
    STATIC_NEXT_COMMANDS[state] ??
    "Review state and ledger before continuing."
  );
}

function scriptReviewNextCommand(scriptReview: ScriptReviewNextStep): string {
  if ((scriptReview.scriptReviewBlockerCount ?? 0) > 0) {
    return "Resolve blocking script review findings before approval.";
  }
  if ((scriptReview.scriptReviewWarningCount ?? 0) > 0) {
    return "pnpm producer approve script --run <run_id> --acknowledge-warnings";
  }
  return "pnpm producer approve script --run <run_id>";
}

function dynamicNextCommand(
  input: Pick<
    EvidenceNextCommandInput,
    "costQuote" | "draftRender" | "renderPlan" | "state" | "ttsEnabled" | "voiceoverAudio"
  >,
): string | undefined {
  if (input.state === "PRODUCTION_PACKAGE_GENERATED") {
    return productionPackageNextCommand(input.renderPlan ?? null);
  }
  if (input.state === "COST_ESTIMATED") {
    return costEstimatedNextCommand(input.costQuote);
  }
  if (input.state === "READY_FOR_MANUAL_PRODUCTION") {
    return manualProductionNextCommand(input.voiceoverAudio ?? null, input.ttsEnabled ?? false);
  }
  if (input.state === "RENDER_APPROVED") {
    return renderApprovedNextCommand(input.draftRender ?? null);
  }
  if (input.state === "RENDERED") {
    return renderedNextCommand(input.draftRender ?? null);
  }
  return undefined;
}

function productionPackageNextCommand(renderPlan: RenderPlanNextStep): string {
  if (renderPlan?.status === "pass") {
    return "pnpm producer estimate --run <run_id>";
  }
  return "pnpm producer render-plan --run <run_id>";
}

function costEstimatedNextCommand(costQuote: CostQuoteNextStep): string {
  if (costQuote?.invalid) {
    return "pnpm producer estimate --run <run_id> (cost quote is invalid and must be regenerated)";
  }
  if (costQuote?.approvalRequired && !costQuote.approved) {
    return "pnpm producer approve cost --run <run_id>";
  }
  return "pnpm producer readiness --run <run_id>";
}

function manualProductionNextCommand(
  voiceoverAudio: VoiceoverNextStep,
  ttsEnabled: boolean,
): string {
  if (voiceoverAudio?.status === "pass") {
    return "pnpm producer approve render --run <run_id>";
  }
  if (ttsEnabled) {
    return "pnpm producer voice --run <run_id>";
  }
  return "Manual production review. Enable local TTS before draft render.";
}

function renderApprovedNextCommand(draftRender: DraftRenderNextStep): string {
  if (draftRender?.status === "pass") {
    return "Manual draft render review. Upload remains approval-gated.";
  }
  return "pnpm producer render --run <run_id>";
}

function renderedNextCommand(draftRender: DraftRenderNextStep): string {
  if (draftRender?.status === "pass") {
    return "Manual final draft review. Upload remains approval-gated.";
  }
  return "Regenerate evidence; draft render artifacts are missing or blocked.";
}
