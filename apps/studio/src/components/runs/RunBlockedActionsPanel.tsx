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
