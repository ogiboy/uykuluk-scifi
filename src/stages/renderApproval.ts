import { createHash } from "node:crypto";

export type RenderApprovalRefInput = {
  renderPlanDigest: string;
  voiceoverAudioDigest: string;
  voiceoverMode: string;
  voiceoverProductionVoiceCandidate: boolean;
  voiceoverQuality: string;
};

export function renderApprovalRef(input: RenderApprovalRefInput): string {
  return createHash("sha256").update(JSON.stringify(input), "utf8").digest("hex");
}
