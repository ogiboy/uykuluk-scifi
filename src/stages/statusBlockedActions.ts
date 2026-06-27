import type { EvidenceStatus } from "./statusMedia.js";

/**
 * Builds run-specific blocked action messages from evidence.
 *
 * Filters `evidence.blockedActions` to keep only non-empty strings and replaces each
 * `<run_id>` placeholder with `runId`.
 *
 * @param evidence - The evidence status that may contain blocked actions.
 * @param runId - The run identifier to insert into each action message.
 * @returns The blocked action messages derived from `evidence.blockedActions`, or an empty array when none are available.
 */
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

/**
 * Replaces run ID placeholders in a command string.
 *
 * @param command - The command text to update
 * @param runId - The run ID to insert
 * @returns The command with every `"<run_id>"` placeholder replaced by `runId`
 */
function materializeRunCommand(command: string, runId: string): string {
  return command.replaceAll("<run_id>", runId);
}
