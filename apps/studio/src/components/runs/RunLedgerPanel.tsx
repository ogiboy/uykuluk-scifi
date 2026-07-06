import { RunDetailCard } from "@/components/runs/RunDetailCard";
import { Badge } from "@/components/ui/badge";
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
    <RunDetailCard
      headingId='run-ledger-heading'
      title='Approval Ledger And Warnings'
      description='Read-only persisted operator evidence. Studio does not approve, acknowledge, or clear warnings.'
    >
      <div className='grid gap-3'>
        <div className='flex flex-wrap items-center gap-2'>
          <h3 className='text-sm font-semibold'>Approvals</h3>
          <Badge variant={approvals.length > 0 ? "secondary" : "outline"}>
            {approvals.length} recorded
          </Badge>
        </div>
        {approvals.length > 0 ? (
          <ul className='grid gap-2'>
            {approvals.map((approval, index) => (
              <li
                className='rounded-lg bg-muted/10 p-3 text-sm text-muted-foreground'
                key={approvalKey(approval, index)}
              >
                {formatApprovalLedgerItem(approval, index)}
              </li>
            ))}
          </ul>
        ) : (
          <p className='rounded-lg bg-muted/10 p-3 text-sm text-muted-foreground'>
            No approvals recorded.
          </p>
        )}
      </div>

      <div className='grid gap-3'>
        <div className='flex flex-wrap items-center gap-2'>
          <h3 className='text-sm font-semibold'>Warnings</h3>
          <Badge variant={warnings.length > 0 ? "destructive" : "outline"}>
            {warnings.length} recorded
          </Badge>
        </div>
        {warnings.length > 0 ? (
          <ul className='grid gap-2'>
            {warnings.map((warning, index) => (
              <li
                className='rounded-lg bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-100'
                key={`warning-${index}-${warning}`}
              >
                {warning}
              </li>
            ))}
          </ul>
        ) : (
          <p className='rounded-lg bg-muted/10 p-3 text-sm text-muted-foreground'>
            No warnings recorded.
          </p>
        )}
      </div>
    </RunDetailCard>
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
