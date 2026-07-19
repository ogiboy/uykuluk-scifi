import { loadConfigAtProjectRoot } from "../../../../../src/config/config";
import { readStudioLocalModelOverview } from "../localModels/localModelOverview";

export type StudioLocalVisualSummary = Readonly<{
  enabled: boolean;
  message: string;
  mode: "black-forest-labs" | "mflux-local" | "static-manual" | "unknown";
  readiness:
    "absent" | "failed" | "interrupted" | "ready" | "setup-pending" | "setup-running" | "unknown";
}>;

/**
 * Reads the configuration and filesystem-only MFLUX readiness needed to expose local visual work.
 *
 * This projection never installs a runtime, downloads a model, or starts an inference operation.
 */
export async function readStudioLocalVisualSummary(
  root: string,
): Promise<StudioLocalVisualSummary> {
  const [configResult, overviewResult] = await Promise.allSettled([
    loadConfigAtProjectRoot(root),
    readStudioLocalModelOverview(root),
  ]);
  const readiness =
    overviewResult.status === "fulfilled" ? overviewResult.value.readiness : "unknown";
  if (configResult.status === "rejected") {
    return {
      enabled: false,
      message:
        "Image-generation settings could not be read. Review Settings before local generation.",
      mode: "unknown",
      readiness,
    };
  }

  const imageGeneration = configResult.value.providers.imageGeneration;
  if (!imageGeneration.enabled) {
    return {
      enabled: false,
      message: "Enable MFLUX local image generation in Settings before generating local revisions.",
      mode: imageGeneration.mode,
      readiness,
    };
  }
  if (imageGeneration.mode !== "mflux-local") {
    return {
      enabled: true,
      message: "Select MFLUX local image generation in Settings before generating local revisions.",
      mode: imageGeneration.mode,
      readiness,
    };
  }
  if (overviewResult.status === "rejected") {
    return {
      enabled: true,
      message:
        "MFLUX readiness could not be read. Review Local Models in Settings before continuing.",
      mode: "mflux-local",
      readiness: "unknown",
    };
  }
  return {
    enabled: true,
    message: localReadinessMessage(readiness),
    mode: "mflux-local",
    readiness,
  };
}

/**
 * Determines whether local MFLUX image generation is ready for use.
 *
 * @param summary - The local visual generation status to evaluate
 * @returns `true` if local generation is enabled, uses MFLUX, and is ready; `false` otherwise.
 */
export function isStudioLocalVisualReady(summary: StudioLocalVisualSummary): boolean {
  return summary.enabled && summary.mode === "mflux-local" && summary.readiness === "ready";
}

/**
 * Provides the user-facing message for the current MFLUX readiness state.
 *
 * @param readiness - The current local model readiness state
 * @returns The message describing the required action or available local generation
 */
function localReadinessMessage(readiness: StudioLocalVisualSummary["readiness"]): string {
  if (readiness === "ready") return "MFLUX local image generation is ready for selected scenes.";
  if (readiness === "setup-pending" || readiness === "setup-running") {
    return "MFLUX setup is in progress; wait for the Local Models status to become ready.";
  }
  if (readiness === "interrupted" || readiness === "failed") {
    return "MFLUX needs recovery or verification in Settings before local generation.";
  }
  return "Prepare MFLUX in Settings before local generation.";
}
