import { RunRecord } from "../core/state.js";
import {
  draftRenderPath,
  draftRenderReviewPath,
  type DraftRenderEvidence,
} from "./render/renderEvidenceContracts.js";
import { readDraftRenderValidation } from "./render/renderEvidenceValidation.js";
import {
  sourceFrameCadence,
  sourceFrameCount,
  sourceFrameSegments,
} from "./render/renderTimelineSummary.js";

export * from "./render/renderEvidenceContracts.js";
export * from "./render/renderEvidenceValidation.js";

/**
 * Reads and validates draft render evidence for a run.
 *
 * @param run - The run record whose draft render artifacts should be checked
 * @returns A draft render evidence result describing whether the draft render is missing, valid, or blocked by a validation failure
 */
export async function readDraftRenderEvidence(run: RunRecord): Promise<DraftRenderEvidence> {
  const result = await readDraftRenderValidation(run);
  if (result.status === "missing" || result.status === "block") {
    return result;
  }
  const { digest, manifest } = result;
  return {
    status: "pass",
    path: draftRenderPath,
    digest,
    bytes: manifest.output.bytes,
    durationSeconds: manifest.output.durationSeconds,
    overlayRoles: manifest.composition.overlays.map((overlay) => overlay.role),
    timelineSegments: manifest.timeline.map((item) => item.segment),
    sourceFrameCount: sourceFrameCount(manifest.timeline),
    sourceFrameSegments: sourceFrameSegments(manifest.timeline),
    sourceFrameCadence: sourceFrameCadence(manifest.ffmpegTimelineInputs),
    reviewPath: draftRenderReviewPath,
    reviewChecklist: manifest.composition.reviewChecklist,
    ffmpegReviewCommand: manifest.ffmpeg.reviewCommand,
    voiceoverMode: manifest.voiceoverAudio.mode,
    voiceoverProductionVoiceCandidate: manifest.voiceoverAudio.productionVoiceCandidate,
    voiceoverQuality: manifest.voiceoverAudio.quality,
    subtitlePath: manifest.subtitles.path,
    subtitleTimingMode: manifest.subtitles.timingMode,
    renderApproval: manifest.renderApproval,
    mediaProbe: manifest.mediaProbe,
    ...(manifest.schemaVersion === 11
      ? {
          soundtrackManifestDigest: manifest.soundtrack.manifestDigest,
          masteringOutputMeasurement: manifest.mastering.outputMeasurement,
          encoding: manifest.encoding,
        }
      : {}),
  };
}
