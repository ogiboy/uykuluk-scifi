/**
 * Formats an approval record for ledger display.
 *
 * @param approval - The approval record to format.
 * @param index - The zero-based position used in the fallback label.
 * @returns A formatted approval summary, or a fallback message for an uninspectable record.
 */
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

/**
 * Describes the approval state change.
 *
 * @param approval - The approval record to read from
 * @returns The state change in the form `previousState -> nextState`, or `undefined` if either state is missing
 */
function approvalTransition(approval: object): string | undefined {
  const previousState = fieldText(approval, "previousState");
  const nextState = fieldText(approval, "nextState");
  return previousState && nextState ? `${previousState} -> ${nextState}` : undefined;
}

/**
 * Counts acknowledged warning entries in an approval record.
 *
 * @param approval - The approval record to inspect
 * @returns The number of string entries in `acknowledgedWarnings`, or `0` when the property is missing or not an array
 */
function approvalWarningCount(approval: object): number {
  const warnings = "acknowledgedWarnings" in approval ? approval.acknowledgedWarnings : undefined;
  return Array.isArray(warnings)
    ? warnings.filter((warning) => typeof warning === "string").length
    : 0;
}

/**
 * Reads a trimmed string field from an object.
 *
 * @param record - The source object.
 * @param field - The property name to read.
 * @returns The field value when it is a string with content after trimming, otherwise `undefined`.
 */
function fieldText(record: object, field: string): string | undefined {
  const value = (record as Record<string, unknown>)[field];
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}
