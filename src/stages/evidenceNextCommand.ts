type CostQuoteNextStep = { invalid?: boolean; approvalRequired: boolean; approved: boolean } | null;

type ScriptReviewNextStep = {
  scriptReviewBlockerCount?: number;
  scriptReviewWarningCount?: number;
};

type RenderPlanNextStep = { status?: string } | null;

type VoiceoverNextStep = { productionVoiceCandidate?: boolean | null; status?: string } | null;

type DraftRenderNextStep = { status?: string; voiceoverProductionVoiceCandidate?: boolean } | null;

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
  PRODUCTION_PACKAGE_GENERATED: "pnpm producer render-plan --run <run_id>",
  SCRIPT_APPROVED: "pnpm producer package --run <run_id>",
  SCRIPT_GENERATED: "pnpm producer review script --run <run_id>",
};

/**
 * Looks up the fixed operator command for a state.
 *
 * @param state - The evidence state name
 * @returns The matching command template, or `undefined` if no fixed command exists for the state
 */
export function staticEvidenceNextCommand(state: string): string | undefined {
  return STATIC_NEXT_COMMANDS[state];
}

/**
 * Replaces run ID placeholders in a command string.
 *
 * @param command - The command template containing `<run_id>` placeholders
 * @param runId - The run ID to insert into the command
 * @returns The command with every `<run_id>` placeholder replaced by `runId`
 */
export function materializeRunCommand(command: string, runId: string): string {
  return command.replaceAll("<run_id>", runId);
}

/**
 * Determines the next operator command or review message for an evidence snapshot.
 *
 * @param input - Evidence snapshot data used to choose the next step
 * @returns A command or instruction for the next safe operator action
 */
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

/**
 * Selects the next manual production command.
 *
 * @param voiceoverAudio - Voiceover evidence used to determine whether render approval is available
 * @param ttsEnabled - Whether local TTS is enabled for generating voice output
 * @returns A command or instruction for the next manual production step
 */
function manualProductionNextCommand(
  voiceoverAudio: VoiceoverNextStep,
  ttsEnabled: boolean,
): string {
  if (voiceoverAudio?.status === "pass") {
    if (
      voiceoverAudio.productionVoiceCandidate === true ||
      voiceoverAudio.productionVoiceCandidate === false
    ) {
      return "pnpm producer review voice --run <run_id>";
    }
    return "Regenerate voiceover evidence before render approval.";
  }
  if (voiceoverAudio?.status === "block") {
    return ttsEnabled
      ? "pnpm producer voice --run <run_id>"
      : "Enable local TTS in producer.config.json, then pnpm producer voice --run <run_id>";
  }
  if (ttsEnabled) {
    return "pnpm producer voice --run <run_id>";
  }
  return "Manual production review. Enable local TTS before draft render.";
}

/**
 * Chooses the next command after render approval.
 *
 * @param draftRender - The current draft render state
 * @returns The next operator command for render approval or draft review
 */
function renderApprovedNextCommand(draftRender: DraftRenderNextStep): string {
  if (draftRender?.status === "pass") {
    return renderedDraftReviewCommand();
  }
  return "pnpm producer render --run <run_id>";
}

/**
 * Chooses the next draft render command or review message.
 *
 * @param draftRender - Draft render evidence used to determine the next step
 * @returns The next operator command or review instruction for the rendered draft
 */
function renderedNextCommand(draftRender: DraftRenderNextStep): string {
  if (draftRender?.status === "pass") {
    return renderedDraftReviewCommand();
  }
  if (draftRender?.status === "block") {
    return "Regenerate evidence with pnpm producer evidence --run <run_id>; if draft artifacts remain blocked, revise upstream artifacts before a new render approval.";
  }
  return "pnpm producer evidence --run <run_id> (draft render artifacts are missing or evidence is stale)";
}

/**
 * Chooses the final draft review instruction for a rendered draft.
 *
 * @returns A command or instruction for the final draft review step.
 */
function renderedDraftReviewCommand(): string {
  return "pnpm producer review render --run <run_id>";
}
