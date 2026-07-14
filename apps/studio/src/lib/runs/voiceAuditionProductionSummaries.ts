import type { ProducerConfig } from "../../../../../src/config/schema";
import { readCostEstimateAtProjectRoot } from "../../../../../src/costs/costEstimate";
import { relevantConfigDigest, stagesDigest } from "../../../../../src/costs/costEstimateIntegrity";
import {
  voiceoverAudioMetaPath,
  voiceoverAudioPath,
} from "../../../../../src/stages/voice/voiceoverEvidence";
import { readValidatedStudioVoiceEvidence } from "../artifacts/studioCaptionArtifacts";
import { errorMessage, objectRecord, stringField } from "./voiceAuditionArtifactReads";
import type {
  StudioVoiceProductionSummary,
  StudioVoiceSelectionHistoryItem,
  VoiceAuditionRun,
  VoiceSummaryReadResult,
} from "./voiceAuditionSummaryTypes";

export type VoiceQuoteReadResult = Readonly<{
  bindingDigest?: string;
  diagnostics: string[];
  digest?: string;
  facts: Array<{ label: string; value: string }>;
  paths: string[];
  provider?: string;
  selectionDigest?: string;
  summary: StudioVoiceProductionSummary["quote"];
}>;

export async function readVoiceQuoteSummary(
  root: string,
  run: VoiceAuditionRun,
  config: ProducerConfig | null,
): Promise<VoiceQuoteReadResult> {
  const jsonPath = "costs/estimate.json";
  const markdownPath = "costs/estimate.md";
  if (!run.artifacts.includes(jsonPath) && !run.artifacts.includes(markdownPath)) {
    return { diagnostics: [], paths: [], summary: { status: "missing" }, facts: [] };
  }
  try {
    if (!run.artifacts.includes(jsonPath) || !run.artifacts.includes(markdownPath)) {
      throw new Error("both quote JSON and Markdown must remain registered");
    }
    const { estimate, digest } = await readCostEstimateAtProjectRoot(root, run.runId);
    if (estimate.runId !== run.runId) throw new Error("quote belongs to a different run");
    if (estimate.pricingDigest !== stagesDigest(estimate.stages)) {
      throw new Error("quote pricing digest does not match its stage details");
    }
    if (config && estimate.configDigest !== relevantConfigDigest(config)) {
      throw new Error("quote is stale for the current provider or budget configuration");
    }
    const ttsStage = estimate.stages.find((stage) => stage.stage === "tts");
    if (ttsStage?.provider === "elevenlabs") {
      if (!config || !config.providers.tts.enabled || config.providers.tts.mode !== "elevenlabs") {
        throw new Error("hosted quote is not current for the configured voice execution mode");
      }
      if (!ttsStage.bindingDigest || ttsStage.bindingSummary?.kind !== "selected-voice") {
        throw new Error("hosted quote is missing its selected-voice binding");
      }
    }
    return {
      ...(ttsStage?.bindingDigest ? { bindingDigest: ttsStage.bindingDigest } : {}),
      diagnostics: estimate.blockedReasons.map((reason) => `Quote block: ${reason}`),
      digest,
      paths: [jsonPath, markdownPath],
      ...(ttsStage?.provider ? { provider: ttsStage.provider } : {}),
      ...(ttsStage?.bindingSummary?.kind === "selected-voice"
        ? { selectionDigest: ttsStage.bindingSummary.selectionDigest }
        : {}),
      summary: {
        budgetAllowed: estimate.budgetAllowed,
        estimatedUsd: ttsStage?.estimatedUsd ?? estimate.estimatedStageCost,
        status: estimate.budgetAllowed ? "ready" : "blocked",
      },
      facts: [
        { label: "Quote digest", value: digest },
        { label: "Config digest", value: estimate.configDigest },
        { label: "Pricing digest", value: estimate.pricingDigest },
      ],
    };
  } catch (error) {
    return {
      diagnostics: [`Cost quote could not be validated: ${errorMessage(error)}`],
      paths: [jsonPath, markdownPath],
      summary: { status: "blocked" },
      facts: [],
    };
  }
}

export async function readVoiceSynthesisSummary(
  root: string,
  run: VoiceAuditionRun,
): Promise<VoiceSummaryReadResult> {
  if (
    !run.artifacts.includes(voiceoverAudioMetaPath) &&
    !run.artifacts.includes(voiceoverAudioPath)
  ) {
    return {
      alignment: { detail: "No production timing evidence yet.", status: "missing" },
      diagnostics: [],
      facts: [],
      paths: [],
      summary: { detail: "Production voice has not been synthesized.", status: "missing" },
    };
  }
  try {
    const evidence = await readValidatedStudioVoiceEvidence(root, run.runId);
    const { meta, subtitle } = evidence;
    const operationId = meta.paidExecution?.operationId;
    const reservationId = meta.paidExecution?.reservationId;
    return {
      alignment: summarizeAlignment(subtitle.timingMode),
      diagnostics: [],
      facts: [
        { label: "Voice metadata", value: voiceoverAudioMetaPath },
        ...(operationId ? [{ label: "Operation ID", value: operationId }] : []),
        ...(reservationId ? [{ label: "Reservation ID", value: reservationId }] : []),
      ],
      paths: [
        voiceoverAudioMetaPath,
        voiceoverAudioPath,
        ...(meta.alignment ? [meta.alignment.path] : []),
        ...(meta.schemaVersion === 2 && meta.normalizedAlignment
          ? [meta.normalizedAlignment.path]
          : []),
        subtitle.path,
        subtitle.metadataPath,
      ],
      summary: {
        detail:
          meta.mode === "elevenlabs"
            ? "Hosted production voice, alignment, and aligned subtitle evidence are validated."
            : "Local fallback voice and subtitle evidence are validated for review.",
        durationSeconds: meta.output.durationSeconds,
        mode: meta.mode,
        status: "ready",
      },
    };
  } catch (error) {
    return {
      alignment: { detail: "Voice timing evidence is not trustworthy.", status: "missing" },
      diagnostics: [`Voice synthesis summary could not be validated: ${errorMessage(error)}`],
      facts: [],
      paths: [voiceoverAudioMetaPath, voiceoverAudioPath],
      summary: { detail: "Production voice evidence is invalid.", status: "missing" },
    };
  }
}

export function summarizeVoiceCostApproval(
  approvals: readonly unknown[],
  quoteDigest: string | undefined,
  quote: StudioVoiceProductionSummary["quote"],
): StudioVoiceProductionSummary["approval"] {
  if (quote.status === "missing") {
    return { detail: "No exact quote exists yet.", status: "missing" };
  }
  if (quote.status === "blocked") {
    return { detail: "The current quote is budget-blocked or invalid.", status: "blocked" };
  }
  const approval = approvals
    .map(objectRecord)
    .find(
      (candidate) =>
        candidate.target === "paid-generation-cost" && candidate.approvedRef === quoteDigest,
    );
  return approval
    ? {
        approvalId: stringField(approval, "approvalId"),
        detail: `Exact quote approved by ${stringField(approval, "approvalId") ?? "recorded approval"}.`,
        status: "approved",
      }
    : { detail: "Exact paid-generation quote still needs approval.", status: "pending" };
}

export function summarizeHostedVoiceExecution(
  selection: StudioVoiceSelectionHistoryItem | null,
  quote: VoiceQuoteReadResult,
  approval: StudioVoiceProductionSummary["approval"],
): StudioVoiceProductionSummary["hostedExecution"] {
  if (
    quote.provider !== "elevenlabs" ||
    quote.summary.status !== "ready" ||
    !quote.bindingDigest ||
    !quote.digest ||
    !approval.approvalId ||
    approval.status !== "approved" ||
    !selection?.productionRightsConfirmed ||
    selection.selectionDigest !== quote.selectionDigest
  ) {
    return null;
  }
  return {
    approvalId: approval.approvalId,
    bindingDigest: quote.bindingDigest,
    quoteDigest: quote.digest,
  };
}

export function voiceProductionFacts(
  selection: StudioVoiceSelectionHistoryItem | null,
  quote: VoiceQuoteReadResult,
  synthesis: VoiceSummaryReadResult,
): Array<{ label: string; value: string }> {
  return [
    ...(selection ? [{ label: "Selection digest", value: selection.selectionDigest }] : []),
    ...quote.facts,
    ...synthesis.facts,
  ];
}

function summarizeAlignment(
  timingMode: "elevenlabs-character-aligned" | "linear-fallback",
): StudioVoiceProductionSummary["alignment"] {
  if (timingMode === "elevenlabs-character-aligned") {
    return {
      detail: "Aligned SRT, timing metadata, and character alignment are validated for review.",
      status: "ready",
    };
  }
  return {
    detail: "Validated local fallback subtitle timing is ready for review.",
    status: "ready",
  };
}
