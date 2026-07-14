import { loadConfigAtProjectRoot } from "../../../../../src/config/config";
import type { ProducerConfig } from "../../../../../src/config/schema";
import { getStudioActionServiceStatus } from "../actionServiceStatus";
import {
  missingVoicePreview,
  readVoiceCandidatePreviews,
  readVoiceCatalog,
  summarizeVoiceCandidate,
  summarizeVoiceQuota,
} from "./voiceAuditionCatalogSummaries";
import {
  readVoiceQuoteSummary,
  readVoiceSynthesisSummary,
  summarizeHostedVoiceExecution,
  summarizeVoiceCostApproval,
  voiceProductionFacts,
} from "./voiceAuditionProductionSummaries";
import { readVoiceSelectionHistory } from "./voiceAuditionSelectionSummaries";
import type {
  StudioVoiceAuditionActionId,
  StudioVoiceAuditionSummary,
  VoiceAuditionRun,
} from "./voiceAuditionSummaryTypes";

export type {
  StudioVoiceAuditionActionBinding,
  StudioVoiceAuditionActionId,
  StudioVoiceAuditionSummary,
  StudioVoiceCandidateSummary,
  StudioVoicePreviewSummary,
  StudioVoiceSelectionHistoryItem,
} from "./voiceAuditionSummaryTypes";

/**
 * Builds the Studio voice-audition projection exclusively from registered local run artifacts.
 *
 * Provider URLs and provider calls are intentionally absent from this read path. Hosted catalog,
 * preview, selection, and synthesis work starts only through an explicit guarded action.
 */
export async function readStudioVoiceAuditionSummary(
  root: string,
  run: VoiceAuditionRun,
  nowMs: number = Date.now(),
): Promise<StudioVoiceAuditionSummary> {
  const [catalogResult, config] = await Promise.all([
    readVoiceCatalog(root, run, nowMs),
    loadConfigAtProjectRoot(root).catch(() => null),
  ]);
  const executionMode = configuredVoiceExecutionMode(config);
  const [previewByVoiceId, selections, quote, synthesis] = await Promise.all([
    readVoiceCandidatePreviews(root, run, catalogResult.catalog, nowMs),
    readVoiceSelectionHistory(root, run),
    readVoiceQuoteSummary(root, run, config),
    readVoiceSynthesisSummary(root, run),
  ]);
  const currentSelection = selections.history.find((item) => item.status === "current") ?? null;
  const candidates = (catalogResult.catalog?.candidates ?? [])
    .slice(0, 24)
    .map((candidate) =>
      summarizeVoiceCandidate(
        candidate,
        catalogResult.catalog!,
        catalogResult.kind,
        previewByVoiceId.previews.get(candidate.voiceId) ?? missingVoicePreview(),
        currentSelection?.voiceId === candidate.voiceId,
      ),
    );
  const diagnostics = [
    ...catalogResult.diagnostics,
    ...previewByVoiceId.diagnostics,
    ...selections.diagnostics,
    ...quote.diagnostics,
    ...synthesis.diagnostics,
  ];
  const approval = summarizeVoiceCostApproval(run.approvals ?? [], quote.digest, quote.summary);
  return {
    actions: voiceActionBindings(executionMode),
    advanced: {
      diagnostics,
      facts: [
        ...(catalogResult.catalog
          ? [
              { label: "Catalog digest", value: catalogResult.catalog.catalogDigest },
              { label: "Model metadata digest", value: catalogResult.catalog.model.metadataDigest },
              { label: "Subscription digest", value: catalogResult.catalog.subscription.digest },
            ]
          : []),
        ...voiceProductionFacts(currentSelection, quote, synthesis),
      ],
      paths: uniquePaths([
        catalogResult.path,
        currentSelection?.artifactPath,
        ...candidates.flatMap((candidate) => [
          candidate.preview.artifactPath,
          candidate.preview.audioPath,
        ]),
        ...quote.paths,
        ...synthesis.paths,
        "ledger.jsonl",
        "costs/reservations.jsonl",
      ]),
    },
    candidates,
    catalog: {
      kind: catalogResult.kind,
      message: catalogResult.message,
      path: catalogResult.path,
      fetchedAt: catalogResult.catalog?.fetchedAt,
      modelId: catalogResult.catalog?.model.modelId,
    },
    currentSelection,
    executionMode,
    executionModeMessage: voiceExecutionModeMessage(executionMode),
    history: selections.history,
    production: {
      alignment: synthesis.alignment,
      approval,
      hostedExecution:
        executionMode === "hosted"
          ? summarizeHostedVoiceExecution(currentSelection, quote, approval)
          : null,
      quote: quote.summary,
      quota: catalogResult.catalog ? summarizeVoiceQuota(catalogResult.catalog) : null,
      synthesis: synthesis.summary,
    },
  };
}

function configuredVoiceExecutionMode(
  config: ProducerConfig | null,
): StudioVoiceAuditionSummary["executionMode"] {
  if (!config) return "unknown";
  return config.providers.tts.mode === "elevenlabs" ? "hosted" : "local";
}

function voiceActionBindings(
  executionMode: StudioVoiceAuditionSummary["executionMode"],
): StudioVoiceAuditionSummary["actions"] {
  const summaries = getStudioActionServiceStatus().summaries as readonly Readonly<{
    actionId: string;
    routePath: string;
  }>[];
  const binding = (actionId: StudioVoiceAuditionActionId) => {
    const summary = summaries.find(
      (candidate) => candidate.actionId === actionId && candidate.routePath !== "unrouted",
    );
    return summary ? { actionId, routePath: summary.routePath } : null;
  };
  const hostedBinding = (actionId: StudioVoiceAuditionActionId) =>
    executionMode === "hosted" ? binding(actionId) : null;
  return {
    "voice.candidates": hostedBinding("voice.candidates"),
    "voice.preview": hostedBinding("voice.preview"),
    "voice.reselect": hostedBinding("voice.reselect"),
    "voice.run": binding("voice.run"),
    "voice.select": hostedBinding("voice.select"),
  };
}

function voiceExecutionModeMessage(
  executionMode: StudioVoiceAuditionSummary["executionMode"],
): string {
  if (executionMode === "hosted") {
    return "Hosted ElevenLabs audition and production are configured; candidate and preview requests still require explicit operator actions.";
  }
  if (executionMode === "local") {
    return "Local TTS fallback is configured. Hosted candidate, preview, selection, and reselection actions are unavailable; local voice generation remains available.";
  }
  return "Voice execution mode could not be validated. Hosted audition actions remain unavailable.";
}

function uniquePaths(values: readonly (string | undefined)[]): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}
