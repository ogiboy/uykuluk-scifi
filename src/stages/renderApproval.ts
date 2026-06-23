import { createHash } from "node:crypto";

export function renderApprovalRef(input: {
  renderPlanDigest: string;
  voiceoverAudioDigest: string;
}): string {
  return createHash("sha256").update(JSON.stringify(input), "utf8").digest("hex");
}
