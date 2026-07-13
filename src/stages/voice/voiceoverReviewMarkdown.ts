import { bulletList, table } from "../../utils/markdown.js";
import { renderOperatorDecisionSection } from "../review/operatorReviewMarkdown.js";
import type { VoiceoverAudioMeta } from "./voiceoverEvidence.js";
import {
  voiceoverLocalPlaybackPath,
  voiceoverRenderApprovalCommand,
  voiceoverRenderApprovalScope,
} from "./voiceoverReviewCommands.js";

/**
 * Builds the local voiceover review markdown artifact.
 *
 * @returns The rendered markdown string.
 */
export function renderVoiceoverReviewMarkdown(meta: VoiceoverAudioMeta): string {
  return [
    "# Voiceover Review",
    "",
    `Run: ${meta.runId}`,
    `Generated at: ${meta.createdAt}`,
    "",
    "> Local audio review artifact only. This does not approve render execution, upload, schedule, public publish, or paid provider execution.",
    "",
    "## Output",
    "",
    table(
      ["Artifact", "Value"],
      [
        ["WAV", meta.output.path],
        ["Local playback path", voiceoverLocalPlaybackPath(meta.runId)],
        ["Mode", meta.mode],
        ["Quality", meta.quality],
        ["Duration", `${meta.output.durationSeconds}s`],
        ["Sample rate", `${meta.output.sampleRateHz}Hz`],
        ["Channels", String(meta.output.channels)],
        ...peakNormalizationRows(meta),
        ["Bytes", String(meta.output.bytes)],
        ["SHA-256", meta.output.sha256],
        ["Render approval scope", renderApprovalScope(meta)],
        ["Render approval command", voiceoverRenderApprovalCommand(meta.runId)],
      ],
    ),
    "",
    "## Inputs",
    "",
    table(
      ["Input", "Value"],
      [
        [meta.source.path, meta.source.sha256],
        ["Source word count", String(meta.source.wordCount)],
        ...(meta.source.preparation
          ? [
              [meta.source.preparation.path, meta.source.preparation.sha256],
              ["Pronunciation replacements", String(meta.source.preparation.replacementsApplied)],
            ]
          : []),
        ...(meta.alignment ? [[meta.alignment.path, meta.alignment.sha256]] : []),
        [meta.renderPlan.path, meta.renderPlan.digest],
      ],
    ),
    ...providerSection(meta),
    "",
    "## Operator Checklist",
    "",
    bulletList(reviewChecklist(meta)),
    "",
    "## Required Decision",
    "",
    `Listen to the WAV locally at \`${voiceoverLocalPlaybackPath(meta.runId)}\`. If pacing, pronunciation, clipping, or source binding is unacceptable, revise the upstream package or TTS configuration and regenerate voiceover audio before render approval.`,
    "",
    ...renderVoiceoverDecision(meta),
  ].join("\n");
}

function peakNormalizationRows(meta: VoiceoverAudioMeta): string[][] {
  const evidence = meta.processing?.peakNormalization;
  if (!evidence) {
    return [];
  }
  return [
    ["Source peak", `${evidence.sourcePeakDbfs} dBFS`],
    ["Peak target", `${evidence.targetPeakDbfs} dBFS`],
    ["Peak normalization", evidence.applied ? `applied (${evidence.gainDb} dB)` : "not needed"],
  ];
}

/**
 * Builds the operator decision section for a voiceover review.
 *
 * @param meta - Voiceover review metadata used to populate run-specific instructions.
 * @returns The markdown lines for the required decision section.
 */
function renderVoiceoverDecision(meta: VoiceoverAudioMeta): string[] {
  return renderOperatorDecisionSection({
    reviewGates: [
      "Listen to the complete WAV locally before approving render.",
      "Confirm pronunciation, pacing, silence, clipping, duration, and source binding against the approved script and render plan.",
      "Confirm render approval has not been granted from audio file existence alone.",
    ],
    acceptableNextSteps: [
      renderApprovalNextStep(meta),
      `Run \`pnpm producer render --run ${meta.runId}\` only after exact render approval is recorded.`,
    ],
    revisionSteps: [
      "Revise the script package, TTS configuration, or local voice model, then regenerate voiceover audio.",
      "Regenerate evidence/readiness before render approval if upstream artifacts changed.",
    ],
    blockedActions: [
      "Draft render remains blocked until explicit render approval exists for the current render plan and voiceover audio.",
      "Private upload, scheduled publish, public publish, and paid provider execution remain unavailable from this review artifact.",
    ],
  });
}

/**
 * Builds the render-approval guidance for the current voiceover mode.
 *
 * @param meta - Voiceover review metadata used to choose the safest approval wording.
 * @returns The operator-facing render approval guidance.
 */
function renderApprovalNextStep(meta: VoiceoverAudioMeta): string {
  const command = voiceoverRenderApprovalCommand(meta.runId);
  if (meta.quality !== "deterministic-local-reference") {
    return `Run \`${command}\` only after audio and render-plan review both pass.`;
  }
  return `Run \`${command}\` only for a local timing draft after deterministic reference audio and render-plan review both pass.`;
}

/**
 * Builds the local TTS provider provenance section.
 *
 * @param meta - Voiceover audio metadata
 * @returns A provenance section when provider details are present; otherwise an empty array.
 */
function providerSection(meta: VoiceoverAudioMeta): string[] {
  if (!meta.provider) {
    return [];
  }

  return [
    "",
    "## TTS Provider Provenance",
    "",
    table(
      ["Provider input", "Value"],
      [
        ["Service", meta.provider.service ?? "local-piper"],
        ["Binary", meta.provider.binary ?? "n/a"],
        ["Model", meta.provider.modelId ?? meta.provider.modelPath ?? "n/a"],
        ["Model SHA-256", meta.provider.modelSha256 ?? "n/a"],
        ["Voice ID", meta.provider.voiceId ?? "n/a"],
        ["Output format", meta.provider.outputFormat ?? "n/a"],
        ...paidExecutionRows(meta),
        ["Piper config", meta.provider.configPath ?? "n/a"],
        ["Piper config SHA-256", meta.provider.configSha256 ?? "n/a"],
      ],
    ),
  ];
}

function paidExecutionRows(meta: VoiceoverAudioMeta): string[][] {
  const paid = meta.paidExecution;
  if (!paid) return [];
  return [
    ["Execution binding", paid.bindingDigest],
    ["Selection digest", paid.selection.digest],
    ["Live validation", paid.liveValidation.validationDigest],
    ["Quote digest", paid.quoteDigest],
    ["Approval ID", paid.approvalId],
    ["Reservation ID", paid.reservationId],
    ["Operation ID", paid.operationId],
    ["Result spool", paid.resultSpool.path],
    ["Result spool digest", paid.resultSpool.digest],
    ["Actual USD micros", String(paid.actualUsdMicros)],
    ["Provider-reported billable credits", String(paid.billing.billableCredits)],
    [
      "Approved base USD / 1K billable credits",
      paid.billing.baseUsdPerThousandBillableCredits.toFixed(6),
    ],
  ];
}

/**
 * Builds the operator review checklist for a voiceover render.
 *
 * @param meta - Voiceover audio metadata used to choose the mode-specific checklist item
 * @returns An ordered list of checklist items for local audio review
 */
function reviewChecklist(meta: VoiceoverAudioMeta): string[] {
  return [
    modeSpecificChecklistItem(meta),
    "Confirm duration is plausible for the approved script and render plan.",
    "Confirm pronunciation and pacing are acceptable for Turkish narration.",
    "Confirm there is no clipping, silence-only output, or obvious corruption.",
    "Confirm render approval has not been granted from audio file existence alone.",
  ];
}

function modeSpecificChecklistItem(meta: VoiceoverAudioMeta): string {
  if (meta.mode === "deterministic-local") {
    return "Deterministic reference audio is for timing only; do not treat it as production voice quality.";
  }
  if (meta.mode === "elevenlabs") {
    return "ElevenLabs audio and character alignment must be manually reviewed before render approval.";
  }
  return "Local Piper audio must be manually reviewed for voice quality before render approval.";
}

function renderApprovalScope(meta: VoiceoverAudioMeta): string {
  return voiceoverRenderApprovalScope(meta.quality !== "deterministic-local-reference");
}
