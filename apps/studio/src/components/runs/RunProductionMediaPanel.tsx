import {
  productionMediaIntro,
  productionMediaReviewAction,
  shouldShowEvidenceRemediation,
} from "@/lib/runEvidenceCopy";
import type { StudioRunDetail } from "@/lib/runSummaries";
import type { ProductionMediaStatus } from "../../../../../src/stages/statusMediaSummary";

type RunProductionMediaPanelProps = Readonly<{
  evidenceMessage: string;
  evidenceNextAction?: string;
  evidenceStatus: StudioRunDetail["evidenceStatus"];
  productionMedia: StudioRunDetail["productionMedia"];
}>;

/**
 * Renders the production media evidence panel for a run.
 *
 * @param evidenceMessage - The remediation message to display when evidence requires attention.
 * @param evidenceNextAction - The next action to display with the remediation message.
 * @param evidenceStatus - The current evidence status used to choose the intro and remediation state.
 * @param productionMedia - The production media artifacts to list.
 */
export function RunProductionMediaPanel({
  evidenceMessage,
  evidenceNextAction,
  evidenceStatus,
  productionMedia,
}: RunProductionMediaPanelProps) {
  return (
    <section className='panel' aria-labelledby='production-media-heading'>
      <h2 id='production-media-heading'>Production Media Evidence</h2>
      <p>{productionMediaIntro(evidenceStatus)}</p>
      {shouldShowEvidenceRemediation(evidenceStatus) ? (
        <EvidenceRemediation message={evidenceMessage} nextAction={evidenceNextAction} />
      ) : null}
      <ul>
        {productionMedia.map((artifact) => (
          <li key={artifact.artifactPath}>
            <strong>{artifact.label}</strong>:{" "}
            <span className={mediaStatusClassName(artifact.status)}>{artifact.status}</span>
            {artifact.detail ? ` — ${artifact.detail}` : ""}
            <br />
            <span>{artifact.artifactPath}</span>
            <p className='artifact-action'>
              Review: {productionMediaReviewAction(evidenceStatus, artifact)}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Displays the remediation message and optional next action for evidence.
 *
 * @param message - The evidence message to display.
 * @param nextAction - The follow-up action to display when provided.
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

/**
 * Maps a media status to its display class name.
 *
 * @param status - The artifact status value.
 * @returns The CSS class name for the status pill.
 */
function mediaStatusClassName(status: ProductionMediaStatus["status"]): string {
  switch (status) {
    case "block":
      return "status-pill small blocked";
    case "missing":
    case "pass":
    case "recorded":
      return "status-pill small";
  }
}
