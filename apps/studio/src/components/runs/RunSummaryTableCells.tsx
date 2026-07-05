import { Badge } from "@/components/ui/badge";
import { runReviewHrefFromSummary } from "@/lib/runReviewNavigation";
import type { StudioRunSummary } from "@/lib/runSummaries";
import {
  formatRunChannelHandoff,
  formatRunChannelHandoffDecision,
  formatRunFinalReviewBundle,
  formatRunRenderDecision,
  formatRunReviewCounts,
} from "@/lib/runSummaryCopy";
import Link from "next/link";
import type { Route } from "next";
import {
  operatorActionDetail,
  operatorActionForRun,
  operatorActionToneLabel,
} from "./runSummaryOperatorAction";

type RunSummaryCellProps = Readonly<{
  run: StudioRunSummary;
}>;

export function RunIdCell({ run }: RunSummaryCellProps) {
  return (
    <Link
      className='font-semibold text-foreground underline-offset-4 hover:underline'
      href={runReviewHrefFromSummary(run) as Route}
    >
      {run.runId}
    </Link>
  );
}

export function RunStateCell({ run }: RunSummaryCellProps) {
  const reviewCounts = formatRunReviewCounts(run);
  return (
    <span className='grid min-w-0 gap-1'>
      <strong className='truncate' title={run.state}>
        {run.state}
      </strong>
      <small className='truncate text-muted-foreground' title={reviewCounts}>
        {reviewCounts}
      </small>
    </span>
  );
}

export function RunReadinessCell({ run }: RunSummaryCellProps) {
  return (
    <span className='grid min-w-0 gap-1'>
      <strong>{run.readinessStatus}</strong>
      {run.readinessStatus === "passed" ? null : (
        <small className='text-muted-foreground'>{run.readinessMessage}</small>
      )}
      {run.readinessNextAction ? (
        <small className='break-words text-muted-foreground'>{run.readinessNextAction}</small>
      ) : null}
    </span>
  );
}

export function RunEvidenceCell({ run }: RunSummaryCellProps) {
  return (
    <span className='grid min-w-0 gap-1'>
      <strong>{run.evidenceStatus}</strong>
      {run.evidenceStatus === "available" ? null : (
        <small className='text-muted-foreground'>{run.evidenceMessage}</small>
      )}
    </span>
  );
}

export function RunOperatorActionCell({ run }: RunSummaryCellProps) {
  const action = operatorActionForRun(run);
  return (
    <span className='grid min-w-0 gap-1'>
      <span className='flex flex-wrap items-center gap-2'>
        <strong>{action.label}</strong>
        <Badge variant={action.tone === "blocked" ? "destructive" : "secondary"}>
          {operatorActionToneLabel(action)}
        </Badge>
      </span>
      <small className='text-muted-foreground'>{operatorActionDetail(action)}</small>
      {action.routePath ? (
        <small className='break-all text-muted-foreground'>{action.routePath}</small>
      ) : null}
    </span>
  );
}

export function RunDecisionCell({ run }: RunSummaryCellProps) {
  return (
    <span className='grid min-w-0 gap-1'>
      <strong>Render: {formatRunRenderDecision(run)}</strong>
      {run.renderDecision.kind === "present" ? (
        <small className='text-muted-foreground'>{run.renderDecision.message}</small>
      ) : null}
      {run.channelHandoff.kind === "present" ? (
        <small className='text-muted-foreground'>
          Channel: {formatRunChannelHandoffDecision(run)}
        </small>
      ) : null}
    </span>
  );
}

export function RunBlockedActionCell({ run }: RunSummaryCellProps) {
  return (
    <Badge variant={run.blockedActionCount > 0 ? "destructive" : "secondary"}>
      {run.blockedActionCount}
    </Badge>
  );
}

export function RunUpdatedCell({ run }: RunSummaryCellProps) {
  return formatRunDate(run.updatedAt);
}

export function RunFinalBundleCell({ run }: RunSummaryCellProps) {
  return (
    <span className='grid min-w-0 gap-1'>
      <strong>{formatRunFinalReviewBundle(run)}</strong>
      {run.finalReviewBundle.kind === "present" ? (
        <small className='break-all text-muted-foreground'>
          {run.finalReviewBundle.reviewPath}
        </small>
      ) : null}
    </span>
  );
}

export function RunChannelHandoffCell({ run }: RunSummaryCellProps) {
  return (
    <span className='grid min-w-0 gap-1'>
      <strong>{formatRunChannelHandoff(run)}</strong>
      {run.channelHandoff.kind === "present" ? (
        <small className='break-all text-muted-foreground'>{run.channelHandoff.reviewPath}</small>
      ) : null}
      {run.channelHandoffDecision.kind === "present" ? (
        <small className='text-muted-foreground'>{formatRunChannelHandoffDecision(run)}</small>
      ) : null}
    </span>
  );
}

export function RunNextActionCell({ run }: RunSummaryCellProps) {
  return (
    <span className='block max-w-96 break-words'>
      {run.nextRecommendedCommand ?? "Generate evidence from CLI"}
    </span>
  );
}

function formatRunDate(value: string): string {
  if (!value) {
    return "unknown";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("tr-TR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
  });
}
