import { loadConfig } from "../config/config.js";
import type { ProducerConfig } from "../config/schema.js";
import { writeRunJson, writeRunText } from "../core/artifacts.js";
import { SafeExitError } from "../core/errors.js";
import { appendLedgerEvent } from "../core/ledger.js";
import { createRun, setRunState } from "../core/runStore.js";
import { assertTransition } from "../core/transitions.js";
import { defaultStagePricing } from "../costs/pricing.js";
import {
  promptProfileDigest,
  selectPromptProfile,
  type PromptProfile,
} from "../prompts/profiles/promptProfileStore.js";
import { createPromptProvenance } from "../prompts/provenance.js";
import { renderIdeasPrompt } from "../prompts/templates.js";
import { createLlmProvider } from "../providers/index.js";
import { enforceBudget } from "../safeguards/budgetGuard.js";
import { configDigest } from "../settings/settingsRevisionStore.js";
import {
  buildEpisodeBriefSnapshot,
  buildOperationSettingsSnapshot,
  episodeBriefPath,
  episodeCreationRequestSchema,
  ideasOperationSettingsPath,
  type EpisodeCreationRequest,
} from "./episode/episodeSnapshotContracts.js";
import { recordIdeaEditorialWarnings } from "./idea/ideaEditorialWarnings.js";
import { persistIdeaGenerationFailure } from "./idea/ideaFailureDiagnostics.js";
import {
  generateIdeasWithRepair,
  renderIdeasMarkdown,
  repairEvidenceWithPrompt,
} from "./idea/ideaGeneration.js";
import {
  ideaHistoryEvidence,
  ideaHistoryPromptBlock,
  readIdeaHistory,
} from "./idea/ideaHistory.js";
import { VideoIdea } from "./types.js";

export { renderIdeaRepairPrompt } from "./idea/ideaRepairPrompt.js";

/**
 * Generates a set of video ideas using an LLM and writes formatted artifacts to the run.
 *
 * @returns An object containing the run ID and the generated video ideas (up to 10).
 * @throws When generation or artifact writing fails.
 */
export async function runIdeas(
  input?: EpisodeCreationRequest,
): Promise<{ runId: string; ideas: VideoIdea[] }> {
  const config = await loadConfig();
  const { profile, request } = resolveEpisodeCreation(config, input);
  let run = await createRun();
  assertTransition(run.state, "IDEAS_GENERATED");
  const provider = createLlmProvider(config);
  try {
    const settingsSnapshot = buildOperationSettingsSnapshot({ config, profile, runId: run.runId });
    const briefSnapshot = buildEpisodeBriefSnapshot({ request, settings: settingsSnapshot });
    run = await writeRunJson(run, "ideas", ideasOperationSettingsPath, settingsSnapshot);
    run = await writeRunJson(run, "ideas", episodeBriefPath, briefSnapshot);
    const estimatedUsd = defaultStagePricing.ideas.estimatedUsd;
    await enforceBudget({
      run,
      config,
      stage: "ideas",
      provider: defaultStagePricing.ideas.provider,
      estimatedUsd,
      recordCostEvent: false,
    });
    const ideaHistory = await readIdeaHistory({ excludeRunId: run.runId });
    const promptContext = ideaHistoryPromptBlock(ideaHistory);
    const prompt = await renderIdeasPrompt(
      [
        episodeDirectionPromptBlock(profile, request.operatorBrief),
        ...(promptContext ? [promptContext] : []),
      ],
      { overrides: config.prompts.overrides },
    );
    const generation = await generateIdeasWithRepair({
      config,
      ideaHistory,
      prompt,
      provider,
      runId: run.runId,
    });
    await enforceBudget({
      run,
      config,
      stage: "ideas",
      provider: generation.result.provider,
      model: generation.result.model,
      estimatedUsd,
      inputTokens: generation.result.inputTokensApprox,
      outputTokens: generation.result.outputTokensApprox,
      durationMs: generation.result.durationMs,
    });
    run = await recordIdeaEditorialWarnings(run, generation.qualityWarnings);
    run = await writeRunJson(run, "ideas", "ideas.json", {
      history: ideaHistoryEvidence(ideaHistory),
      ideas: generation.ideas,
      qualityWarnings: generation.qualityWarnings,
      prompt: createPromptProvenance(prompt.key, prompt.text, "ideas.json", prompt.source),
      repair: repairEvidenceWithPrompt(prompt.key, generation),
    });
    run = await writeRunText(run, "ideas", "ideas.md", renderIdeasMarkdown(generation.ideas));
    run = await setRunState(run, "IDEAS_GENERATED", "ideas");
    return { runId: run.runId, ideas: generation.ideas };
  } catch (error) {
    run = await persistIdeaGenerationFailure(run, config, error);
    await appendLedgerEvent({
      runId: run.runId,
      type: "ERROR",
      stage: "ideas",
      message: (error as Error).message,
    });
    throw error;
  }
}

function resolveEpisodeCreation(
  config: ProducerConfig,
  input?: EpisodeCreationRequest,
): Readonly<{ profile: PromptProfile; request: EpisodeCreationRequest }> {
  const selectedId = input?.profileId ?? config.editorial.activeProfileId;
  const profile = selectPromptProfile(selectedId, config.editorial.profiles);
  const currentProfileDigest = promptProfileDigest(profile);
  const request = episodeCreationRequestSchema.parse(
    input ?? {
      profileId: profile.id,
      expectedProfileDigest: currentProfileDigest,
      expectedSettingsDigest: configDigest(config),
    },
  );
  if (request.expectedProfileDigest !== currentProfileDigest) {
    throw new SafeExitError(
      "Prompt profile changed before idea generation; reload the episode brief and try again.",
    );
  }
  if (request.expectedSettingsDigest !== configDigest(config)) {
    throw new SafeExitError(
      "Settings changed before idea generation; reload the episode brief and try again.",
    );
  }
  if (profile.requiresOperatorBrief && !request.operatorBrief) {
    throw new SafeExitError("The selected prompt profile requires an operator brief.");
  }
  return { profile, request };
}

function episodeDirectionPromptBlock(profile: PromptProfile, operatorBrief?: string): string {
  return [
    "## Episode Direction",
    `Genre: ${profile.genre}`,
    `Profile: ${profile.generationPrompt}`,
    ...(operatorBrief ? ["Operator brief:", operatorBrief] : []),
  ].join("\n");
}
