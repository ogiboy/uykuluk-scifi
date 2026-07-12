import type { ApprovalRecord } from "../../core/state.js";

/**
 * Formats approval records as a ledger section.
 *
 * @param approvals - Approval records to include in the ledger
 * @returns An empty array when `approvals` is empty; otherwise a blank line, a heading, and one bullet line per approval
 */
export function formatApprovalLedger(approvals: readonly ApprovalRecord[]): string[] {
  if (approvals.length === 0) {
    return [];
  }
  return ["", "Approval ledger:", ...approvals.map((approval) => `- ${formatApproval(approval)}`)];
}

/**
 * Formats warning messages as a ledger section.
 *
 * @param warnings - Warning messages to include
 * @returns A string array containing a blank line, a "Warning details:" heading, and one bullet line per warning, or an empty array when `warnings` is empty
 */
export function formatWarningDetails(warnings: readonly string[]): string[] {
  if (warnings.length === 0) {
    return [];
  }
  return ["", "Warning details:", ...warnings.map((warning) => `- ${warning}`)];
}

/**
 * Formats an approval record as a single ledger entry.
 *
 * @param approval - The approval record to format
 * @returns A human-readable approval summary
 */
function formatApproval(approval: ApprovalRecord): string {
  return [
    `${approval.target} approval`,
    `${approval.previousState} -> ${approval.nextState}`,
    approval.approvedRef ? `ref ${approval.approvedRef}` : undefined,
    `via ${approval.approvingCommand}`,
    acknowledgedWarningCount(approval),
    approval.createdAt,
  ]
    .filter((part): part is string => Boolean(part))
    .join(" · ");
}

/**
 * Formats the number of acknowledged warnings for an approval.
 *
 * @param approval - The approval record to inspect
 * @returns A string such as `1 acknowledged warning(s)` when one or more warnings were acknowledged, or `undefined` when none were acknowledged
 */
function acknowledgedWarningCount(approval: ApprovalRecord): string | undefined {
  const count = approval.acknowledgedWarnings?.length ?? 0;
  return count > 0 ? `${count} acknowledged warning(s)` : undefined;
}
