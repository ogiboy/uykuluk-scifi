import type { EvidenceStatus } from "./statusMedia.js";

export function evidenceBlockedActionMessages(
  evidence: EvidenceStatus | null,
  runId: string,
): string[] {
  if (!Array.isArray(evidence?.blockedActions)) {
    return [];
  }
  return evidence.blockedActions
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => materializeRunCommand(item, runId));
}

function materializeRunCommand(command: string, runId: string): string {
  return command.replaceAll("<run_id>", runId);
}
