import { bulletList, table } from "../utils/markdown.js";
import type { VoiceoverAudioMeta } from "./voiceoverEvidence.js";

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
        ["Mode", meta.mode],
        ["Quality", meta.quality],
        ["Duration", `${meta.output.durationSeconds}s`],
        ["Sample rate", `${meta.output.sampleRateHz}Hz`],
        ["Channels", String(meta.output.channels)],
        ["Bytes", String(meta.output.bytes)],
        ["SHA-256", meta.output.sha256],
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
    "Listen to the WAV locally. If pacing, pronunciation, clipping, or source binding is unacceptable, revise the upstream package or TTS configuration and regenerate voiceover audio before render approval.",
  ].join("\n");
}

function providerSection(meta: VoiceoverAudioMeta): string[] {
  if (!meta.provider) {
    return [];
  }

  return [
    "",
    "## Local TTS Provider Provenance",
    "",
    table(
      ["Provider input", "Value"],
      [
        ["Binary", meta.provider.binary ?? "n/a"],
        ["Piper model", meta.provider.modelPath ?? "n/a"],
        ["Piper model SHA-256", meta.provider.modelSha256 ?? "n/a"],
        ["Piper config", meta.provider.configPath ?? "n/a"],
        ["Piper config SHA-256", meta.provider.configSha256 ?? "n/a"],
      ],
    ),
  ];
}

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
  return "Local Piper audio must be manually reviewed for voice quality before render approval.";
}
