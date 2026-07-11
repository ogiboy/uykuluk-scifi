import { RunDetailCard } from "@/components/runs/RunDetailCard";
import { CopyableCommand } from "@/components/studio/CopyableCommand";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import type { StudioRunDetail } from "@/lib/runSummaries";
import { RunLedgerPanel } from "./RunLedgerPanel";

type RunReadinessDiagnosticsPanelsProps = Readonly<{ run: StudioRunDetail }>;

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
              className='bg-muted/15 ring-border/5 grid gap-2 rounded-lg p-3 text-sm ring-1'
              key={`diagnostic-${index}-${diagnostic.path}`}
            >
              <strong>{diagnostic.stage}</strong>
              <span className='text-muted-foreground'>{diagnostic.message}</span>
              <span className='text-muted-foreground font-mono text-xs break-all'>
                {diagnostic.path}
              </span>
              {diagnostic.nextAction ? (
                <CopyableCommand command={diagnostic.nextAction} label='Diagnostic next action' />
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className='bg-muted/15 text-muted-foreground ring-border/5 rounded-lg p-3 text-sm ring-1'>
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
      <p className='text-muted-foreground text-sm'>
        {run.readinessChecks.length > 0
          ? `${run.readinessChecks.length} check(s) recorded.`
          : "No readiness checks recorded."}
      </p>
      {run.readinessChecks.length > 0 ? (
        <Accordion className='grid gap-2' type='multiple'>
          {run.readinessChecks.map((check, index) => (
            <AccordionItem
              className='bg-muted/15 ring-border/5 rounded-lg px-3 ring-1'
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
                <p className='text-muted-foreground pb-3 text-sm'>{check.message}</p>
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
