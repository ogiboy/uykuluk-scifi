import type { ApprovalRecord } from "../core/state.js";

export function formatApprovalLedger(approvals: readonly ApprovalRecord[]): string[] {
  if (approvals.length === 0) {
    return [];
  }
  return ["", "Approval ledger:", ...approvals.map((approval) => `- ${formatApproval(approval)}`)];
}

export function formatWarningDetails(warnings: readonly string[]): string[] {
  if (warnings.length === 0) {
    return [];
  }
  return ["", "Warning details:", ...warnings.map((warning) => `- ${warning}`)];
}

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

function acknowledgedWarningCount(approval: ApprovalRecord): string | undefined {
  const count = approval.acknowledgedWarnings?.length ?? 0;
  return count > 0 ? `${count} acknowledged warning(s)` : undefined;
}
