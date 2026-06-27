import {
  blockedActionsEmptyMessage,
  blockedActionsIntro,
  shouldShowEvidenceRemediation,
} from "@/lib/runEvidenceCopy";
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
    <section className='panel' aria-labelledby='blocked-actions-heading'>
      <h2 id='blocked-actions-heading'>Blocked Actions</h2>
      <p>{blockedActionsIntro(evidenceStatus)}</p>
      {evidenceStatus === "available" && blockedActions.length > 0 ? (
        <ul>
          {blockedActions.map((action) => (
            <li key={action}>{action}</li>
          ))}
        </ul>
      ) : (
        <p>{blockedActionsEmptyMessage(evidenceStatus)}</p>
      )}
      {shouldShowEvidenceRemediation(evidenceStatus) ? (
        <EvidenceRemediation message={evidenceMessage} nextAction={evidenceNextAction} />
      ) : null}
    </section>
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
    <>
      <p>Evidence: {message}</p>
      {nextAction ? <p className='artifact-action'>Evidence action: {nextAction}</p> : null}
    </>
  );
}
