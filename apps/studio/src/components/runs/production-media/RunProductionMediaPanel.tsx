import {
  productionMediaIntro,
  productionMediaReviewSummary,
  productionMediaReviewAction,
  shouldShowEvidenceRemediation,
  type ProductionMediaStatus,
} from "@/lib/runEvidenceCopy";
import type { StudioRunDetail } from "@/lib/runSummaries";
import { studioMediaArtifactUrl } from "@/lib/studioMediaArtifacts";
import { CopyableCommand } from "@/components/studio/CopyableCommand";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RunDetailCard } from "../RunDetailCard";
import { RunProductionMediaFacts } from "./RunProductionMediaFacts";
import { RunProductionMediaPreview } from "./RunProductionMediaPreview";
import { RunProductionMediaSummary } from "./RunProductionMediaSummary";

type RunProductionMediaPanelProps = Readonly<{
  evidenceMessage: string;
  evidenceNextAction?: string;
  evidenceStatus: StudioRunDetail["evidenceStatus"];
  productionMedia: StudioRunDetail["productionMedia"];
  runId: string;
}>;

/**
 * Renders the production media evidence panel for a run.
 *
 * @param evidenceMessage - The remediation message to display when evidence requires attention.
 * @param evidenceNextAction - The next action to display with the remediation message.
 * @param evidenceStatus - The current evidence status used to choose the intro and remediation state.
 * @param productionMedia - The production media artifacts to list.
 * @param runId - The current run identifier used to build local media preview URLs.
 */
export function RunProductionMediaPanel({
  evidenceMessage,
  evidenceNextAction,
  evidenceStatus,
  productionMedia,
  runId,
}: RunProductionMediaPanelProps) {
  const summary = productionMediaReviewSummary(evidenceStatus, productionMedia);
  return (
    <RunDetailCard
      headingId='production-media-heading'
      title='Production Media Evidence'
      description={productionMediaIntro(evidenceStatus)}
    >
      <RunProductionMediaSummary summary={summary} />
      {shouldShowEvidenceRemediation(evidenceStatus) ? (
        <EvidenceRemediation message={evidenceMessage} nextAction={evidenceNextAction} />
      ) : null}
      <div className='grid gap-4 xl:grid-cols-2'>
        {productionMedia.map((artifact) => (
          <ProductionMediaCard
            artifact={artifact}
            evidenceStatus={evidenceStatus}
            key={artifact.artifactPath}
            runId={runId}
          />
        ))}
      </div>
    </RunDetailCard>
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
    <Alert>
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
  runId,
}: Readonly<{
  artifact: ProductionMediaStatus;
  evidenceStatus: StudioRunDetail["evidenceStatus"];
  runId: string;
}>) {
  const mediaUrl = mediaPreviewUrl(runId, artifact);
  return (
    <Card className='min-w-0 gap-4 overflow-hidden border border-transparent bg-background/35 py-4 shadow-none'>
      <CardHeader className='gap-2 px-4'>
        <CardDescription className='break-all font-mono text-xs'>
          {artifact.artifactPath}
        </CardDescription>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <CardTitle>
            <h3 className='text-base font-semibold leading-snug'>{artifact.label}</h3>
          </CardTitle>
          <Badge variant={mediaStatusBadgeVariant(artifact.status)}>{artifact.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className='grid gap-4 px-4'>
        <RunProductionMediaFacts artifact={artifact} />
        {mediaUrl ? (
          <RunProductionMediaPreview artifact={artifact} mediaUrl={mediaUrl} runId={runId} />
        ) : null}
        <p className='rounded-lg bg-muted/10 p-3 text-sm text-muted-foreground'>
          Review: {productionMediaReviewAction(evidenceStatus, artifact)}
        </p>
        <MediaCommandList artifact={artifact} />
      </CardContent>
    </Card>
  );
}

function mediaPreviewUrl(runId: string, artifact: ProductionMediaStatus): string | null {
  if (artifact.status === "block" || artifact.status === "missing") {
    return null;
  }
  return studioMediaArtifactUrl(runId, artifact.artifactPath);
}

function MediaCommandList({ artifact }: Readonly<{ artifact: ProductionMediaStatus }>) {
  const commands = mediaCommands(artifact);
  if (commands.length === 0) {
    return null;
  }
  return (
    <div className='grid gap-3'>
      {commands.map((command) => (
        <div className='grid gap-2' key={command.label}>
          <strong className='text-sm'>{command.label}</strong>
          <CopyableCommand command={command.value} label={command.label} />
        </div>
      ))}
    </div>
  );
}

function mediaCommands(artifact: ProductionMediaStatus): Array<{ label: string; value: string }> {
  return [
    artifact.reviewCommand ? { label: "Review command", value: artifact.reviewCommand } : null,
    artifact.reviewArtifactPath
      ? { label: "Review artifact path", value: artifact.reviewArtifactPath }
      : null,
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
