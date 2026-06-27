export function formatApprovalLedgerItem(approval: unknown, index: number): string {
  if (!approval || typeof approval !== "object") {
    return `Approval ${index + 1}: uninspectable approval record.`;
  }
  const target = fieldText(approval, "target") ?? "unknown target";
  const transition = approvalTransition(approval);
  const approvedRef = fieldText(approval, "approvedRef");
  const command = fieldText(approval, "approvingCommand");
  const createdAt = fieldText(approval, "createdAt");
  const warningCount = approvalWarningCount(approval);
  return [
    `${target} approval`,
    transition,
    approvedRef ? `ref ${approvedRef}` : undefined,
    command ? `via ${command}` : undefined,
    warningCount > 0 ? `${warningCount} acknowledged warning(s)` : undefined,
    createdAt,
  ]
    .filter((part): part is string => Boolean(part))
    .join(" · ");
}

function approvalTransition(approval: object): string | undefined {
  const previousState = fieldText(approval, "previousState");
  const nextState = fieldText(approval, "nextState");
  return previousState && nextState ? `${previousState} -> ${nextState}` : undefined;
}

function approvalWarningCount(approval: object): number {
  const warnings = "acknowledgedWarnings" in approval ? approval.acknowledgedWarnings : undefined;
  return Array.isArray(warnings)
    ? warnings.filter((warning) => typeof warning === "string").length
    : 0;
}

function fieldText(record: object, field: string): string | undefined {
  const value = (record as Record<string, unknown>)[field];
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}
