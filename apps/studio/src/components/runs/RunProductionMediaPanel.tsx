import {
  productionMediaIntro,
  productionMediaReviewAction,
  shouldShowEvidenceRemediation,
} from "@/lib/runEvidenceCopy";
import type { StudioRunDetail } from "@/lib/runSummaries";
import { CopyableCommand } from "../studio/CopyableCommand";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
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
      <div className='production-media-grid'>
        {productionMedia.map((artifact) => (
          <ProductionMediaCard
            artifact={artifact}
            evidenceStatus={evidenceStatus}
            key={artifact.artifactPath}
          />
        ))}
      </div>
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
    <Alert className='production-media-alert'>
      <AlertTitle>Evidence needs attention</AlertTitle>
      <AlertDescription>
        <p>{message}</p>
        {nextAction ? <CopyableCommand command={nextAction} label='Evidence action' /> : null}
      </AlertDescription>
    </Alert>
  );
}

function ProductionMediaCard({
  artifact,
  evidenceStatus,
}: Readonly<{
  artifact: ProductionMediaStatus;
  evidenceStatus: StudioRunDetail["evidenceStatus"];
}>) {
  return (
    <Card className='production-media-card'>
      <CardHeader>
        <CardDescription>{artifact.artifactPath}</CardDescription>
        <div className='production-media-card-title'>
          <CardTitle>
            <h3>{artifact.label}</h3>
          </CardTitle>
          <Badge variant={mediaStatusBadgeVariant(artifact.status)}>{artifact.status}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {artifact.detail ? <p>{artifact.detail}</p> : null}
        <p className='artifact-action'>
          Review: {productionMediaReviewAction(evidenceStatus, artifact)}
        </p>
        <MediaCommandList artifact={artifact} />
      </CardContent>
    </Card>
  );
}

function MediaCommandList({ artifact }: Readonly<{ artifact: ProductionMediaStatus }>) {
  const commands = mediaCommands(artifact);
  if (commands.length === 0) {
    return null;
  }
  return (
    <div className='production-media-commands'>
      {commands.map((command) => (
        <div key={command.label}>
          <strong>{command.label}</strong>
          <CopyableCommand command={command.value} label={command.label} />
        </div>
      ))}
    </div>
  );
}

function mediaCommands(artifact: ProductionMediaStatus): Array<{ label: string; value: string }> {
  return [
    artifact.reviewCommand ? { label: "Review command", value: artifact.reviewCommand } : null,
    artifact.localPlaybackPath
      ? { label: "Local playback path", value: artifact.localPlaybackPath }
      : null,
    artifact.renderApprovalCommand
      ? {
          label: `Render approval command (${artifact.renderApprovalScope ?? "scope unknown"})`,
          value: artifact.renderApprovalCommand,
        }
      : null,
  ].filter((command): command is { label: string; value: string } => Boolean(command));
}

/**
 * Maps a media status to the shadcn badge variant used in the review panel.
 *
 * @param status - The artifact status value.
 * @returns The badge variant for the status pill.
 */
function mediaStatusBadgeVariant(
  status: ProductionMediaStatus["status"],
): "destructive" | "outline" | "secondary" {
  switch (status) {
    case "block":
      return "destructive";
    case "missing":
    case "recorded":
      return "outline";
    case "pass":
      return "secondary";
  }
}
