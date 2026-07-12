import { RunDetailCard } from "@/components/runs/RunDetailCard";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  blockedActionsEmptyMessage,
  blockedActionsIntro,
  shouldShowEvidenceRemediation,
} from "@/lib/runs/runEvidenceCopy";
import type { StudioRunDetail } from "@/lib/runSummaries";

type RunBlockedActionsPanelProps = Readonly<{
  blockedActions: readonly string[];
  evidenceMessage: string;
  evidenceNextAction?: string;
  evidenceStatus: StudioRunDetail["evidenceStatus"];
}>;

/**
 * Renders the blocked-actions panel for a run.
 *
 * @param blockedActions - The blocked action messages to display when evidence is available.
 * @param evidenceMessage - The evidence message shown in the remediation section.
 * @param evidenceNextAction - The next action shown in the remediation section, when provided.
 * @param evidenceStatus - The current evidence status used to choose the displayed content.
 */
export function RunBlockedActionsPanel({
  blockedActions,
  evidenceMessage,
  evidenceNextAction,
  evidenceStatus,
}: RunBlockedActionsPanelProps) {
  return (
    <RunDetailCard
      headingId='blocked-actions-heading'
      title='Blocked Actions'
      description={blockedActionsIntro(evidenceStatus)}
    >
      {evidenceStatus === "available" && blockedActions.length > 0 ? (
        <Accordion className='bg-muted/10 rounded-lg px-3' type='single' collapsible>
          <AccordionItem className='border-0' value='blocked-actions'>
            <AccordionTrigger>{blockedActions.length} blocked action(s)</AccordionTrigger>
            <AccordionContent>
              <ul className='text-muted-foreground grid gap-2 pb-2 text-sm'>
                {blockedActions.map((action, index) => (
                  <li
                    className='bg-background/45 rounded-md p-2'
                    key={`blocked-action-${index}-${action}`}
                  >
                    {action}
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      ) : (
        <p className='bg-muted/10 text-muted-foreground rounded-lg p-3 text-sm'>
          {blockedActionsEmptyMessage(evidenceStatus)}
        </p>
      )}
      {shouldShowEvidenceRemediation(evidenceStatus) ? (
        <EvidenceRemediation message={evidenceMessage} nextAction={evidenceNextAction} />
      ) : null}
    </RunDetailCard>
  );
}

/**
 * Displays evidence details and an optional next action.
 *
 * @param message - The evidence message to display.
 * @param nextAction - The follow-up action to display with the evidence.
 */
function EvidenceRemediation({
  message,
  nextAction,
}: Readonly<{ message: string; nextAction?: string }>) {
  return (
    <div className='grid gap-2 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-100'>
      <p>Evidence: {message}</p>
      {nextAction ? <p>Evidence action: {nextAction}</p> : null}
    </div>
  );
}
