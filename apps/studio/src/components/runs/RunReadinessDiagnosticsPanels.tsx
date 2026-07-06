import { RunDetailCard } from "@/components/runs/RunDetailCard";
import { CopyableCommand } from "@/components/studio/CopyableCommand";
import { Badge } from "@/components/ui/badge";
import type { StudioRunDetail } from "@/lib/runSummaries";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { RunLedgerPanel } from "./RunLedgerPanel";

type RunReadinessDiagnosticsPanelsProps = Readonly<{
  run: StudioRunDetail;
}>;

/**
 * Renders readiness, ledger, and diagnostic evidence for a run.
 *
 * @param run - The Studio run detail projection used for readiness review.
 */
export function RunReadinessDiagnosticsPanels({ run }: RunReadinessDiagnosticsPanelsProps) {
  return (
    <>
      <ReadinessChecksPanel run={run} />
      <RunLedgerPanel approvals={run.approvals} warnings={run.warnings} />
      <DiagnosticsPanel run={run} />
    </>
  );
}

function DiagnosticsPanel({ run }: Readonly<{ run: StudioRunDetail }>) {
  return (
    <RunDetailCard headingId='diagnostics-heading' title='Diagnostics'>
      {run.diagnostics.length > 0 ? (
        <ul className='grid gap-2'>
          {run.diagnostics.map((diagnostic, index) => (
            <li
              className='grid gap-2 rounded-lg bg-muted/15 p-3 text-sm ring-1 ring-border/5'
              key={`diagnostic-${index}-${diagnostic.path}`}
            >
              <strong>{diagnostic.stage}</strong>
              <span className='text-muted-foreground'>{diagnostic.message}</span>
              <span className='break-all font-mono text-xs text-muted-foreground'>
                {diagnostic.path}
              </span>
              {diagnostic.nextAction ? (
                <CopyableCommand command={diagnostic.nextAction} label='Diagnostic next action' />
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className='rounded-lg bg-muted/15 p-3 text-sm text-muted-foreground ring-1 ring-border/5'>
          No run diagnostics recorded.
        </p>
      )}
    </RunDetailCard>
  );
}

function ReadinessChecksPanel({ run }: Readonly<{ run: StudioRunDetail }>) {
  return (
    <RunDetailCard
      headingId='readiness-heading'
      title='Readiness Checks'
      description={run.readinessMessage}
    >
      {run.readinessNextAction ? (
        <CopyableCommand command={run.readinessNextAction} label='Readiness next action' />
      ) : null}
      <p className='text-sm text-muted-foreground'>
        {run.readinessChecks.length > 0
          ? `${run.readinessChecks.length} check(s) recorded.`
          : "No readiness checks recorded."}
      </p>
      {run.readinessChecks.length > 0 ? (
        <Accordion className='grid gap-2' type='multiple'>
          {run.readinessChecks.map((check, index) => (
            <AccordionItem
              className='rounded-lg bg-muted/15 px-3 ring-1 ring-border/5'
              key={`readiness-check-${index}-${check.name}`}
              value={check.name}
            >
              <AccordionTrigger>
                <span>{check.name}</span>
                <Badge className='capitalize' variant={readinessStatusBadgeVariant(check.status)}>
                  {check.status}
                </Badge>
              </AccordionTrigger>
              <AccordionContent>
                <p className='pb-3 text-sm text-muted-foreground'>{check.message}</p>
                {check.nextAction ? (
                  <CopyableCommand command={check.nextAction} label='Readiness check next action' />
                ) : null}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      ) : null}
    </RunDetailCard>
  );
}

function readinessStatusBadgeVariant(status: string) {
  if (status === "block") {
    return "destructive";
  }
  return "secondary";
}
