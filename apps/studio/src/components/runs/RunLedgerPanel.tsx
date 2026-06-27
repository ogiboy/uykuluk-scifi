import { formatApprovalLedgerItem } from "@/lib/runLedgerCopy";

type RunLedgerPanelProps = Readonly<{
  approvals: readonly unknown[];
  warnings: readonly string[];
}>;

/**
 * Renders the approval ledger and warning list for a run.
 *
 * @param approvals - Recorded approval entries to display
 * @param warnings - Recorded warning messages to display
 */
export function RunLedgerPanel({ approvals, warnings }: RunLedgerPanelProps) {
  return (
    <section className='panel' aria-labelledby='run-ledger-heading'>
      <h2 id='run-ledger-heading'>Approval Ledger And Warnings</h2>
      <p>
        Read-only persisted operator evidence. Studio does not approve, acknowledge, or clear
        warnings.
      </p>

      <h3>Approvals</h3>
      {approvals.length > 0 ? (
        <ul>
          {approvals.map((approval, index) => (
            <li key={approvalKey(approval, index)}>{formatApprovalLedgerItem(approval, index)}</li>
          ))}
        </ul>
      ) : (
        <p>No approvals recorded.</p>
      )}

      <h3>Warnings</h3>
      {warnings.length > 0 ? (
        <ul>
          {warnings.map((warning, index) => (
            <li key={`warning-${index}-${warning}`}>{warning}</li>
          ))}
        </ul>
      ) : (
        <p>No warnings recorded.</p>
      )}
    </section>
  );
}

/**
 * Generates a React key for an approval entry.
 *
 * @param approval - The approval value to inspect
 * @param index - The list index used as a fallback
 * @returns The approval ID when present and non-empty, otherwise a fallback key based on `index`
 */
function approvalKey(approval: unknown, index: number): string {
  if (approval && typeof approval === "object" && "approvalId" in approval) {
    const approvalId = approval.approvalId;
    if (typeof approvalId === "string" && approvalId.length > 0) {
      return approvalId;
    }
  }
  return `approval-${index}`;
}
