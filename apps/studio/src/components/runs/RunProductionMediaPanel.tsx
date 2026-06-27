import { productionMediaIntro, shouldShowEvidenceRemediation } from "@/lib/runEvidenceCopy";
import type { StudioRunDetail } from "@/lib/runSummaries";

type RunProductionMediaPanelProps = Readonly<{
  evidenceMessage: string;
  evidenceNextAction?: string;
  evidenceStatus: StudioRunDetail["evidenceStatus"];
  productionMedia: StudioRunDetail["productionMedia"];
}>;

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
          </li>
        ))}
      </ul>
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

function mediaStatusClassName(status: string): string {
  return status === "pass" ? "status-pill small" : "status-pill small blocked";
}
