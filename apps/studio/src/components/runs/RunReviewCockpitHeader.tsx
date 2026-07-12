import { CliFallbackCommand } from "@/components/studio/CliFallbackCommand";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  buildStudioRunReviewBrief,
  type StudioRunReviewBriefCheckpoint,
} from "@/lib/runs/runReviewBrief";
import { runReviewTabFocus } from "@/lib/runs/runReviewNavigation";
import { getNextSafeCommand } from "@/lib/runs/runSummaryCopy";
import type { StudioRunDetail } from "@/lib/runSummaries";
import { RunPrimaryActionPanel } from "./RunPrimaryActionPanel";

type RunReviewCockpitHeaderProps = Readonly<{ run: StudioRunDetail }>;

/**
 * Renders the primary run-detail operator summary.
 *
 * @param run - The Studio run detail projection to summarize.
 */
export function RunReviewCockpitHeader({ run }: RunReviewCockpitHeaderProps) {
  const brief = buildStudioRunReviewBrief(run);
  const tabFocus = runReviewTabFocus(run);
  return (
    <Card
      className='grid min-w-0 items-start gap-4 rounded-lg bg-[linear-gradient(135deg,color-mix(in_srgb,var(--accent)_7%,transparent),transparent_50%),var(--panel)] p-4 py-4 min-[1181px]:grid-cols-[minmax(220px,0.8fr)_minmax(180px,0.7fr)_minmax(360px,1.5fr)]'
      aria-labelledby='run-overview-heading'
    >
      <CardHeader className='min-w-0 p-0'>
        <CardDescription>Run review workspace</CardDescription>
        <CardTitle>
          <h2 className='mb-0' id='run-overview-heading'>
            Run Overview
          </h2>
        </CardTitle>
        <div className='flex flex-wrap gap-2'>
          <Badge variant={brief.severity === "blocked" ? "destructive" : "secondary"}>
            {reviewBadgeLabel(brief.severity)}
          </Badge>
          <Badge variant={run.renderDecision.kind === "present" ? "secondary" : "outline"}>
            Render decision: {run.renderDecision.kind}
          </Badge>
          <Badge variant='outline'>Focus: {tabFocus.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className='min-w-0 p-0'>
        <dl className='grid gap-3 sm:grid-cols-2'>
          <RunMetric label='State' value={run.state} />
          <RunMetric label='Approvals' value={run.approvalCount} />
          <RunMetric label='Warnings' value={run.warningCount} />
          <RunMetric label='Readiness' value={run.readinessStatus} />
          <RunMetric label='Evidence' value={run.evidenceStatus} />
        </dl>
      </CardContent>
      <CardContent className='min-w-0 p-0'>
        <section className='grid gap-3' aria-labelledby='run-review-brief-heading'>
          <div>
            <p
              className={
                brief.severity === "blocked"
                  ? "text-destructive mb-1.5 text-[11px] font-extrabold tracking-[0.14em] uppercase"
                  : "text-primary mb-1.5 text-[11px] font-extrabold tracking-[0.14em] uppercase"
              }
            >
              {brief.severity}
            </p>
            <h3 className='font-semibold' id='run-review-brief-heading'>
              {brief.title}
            </h3>
            <p>{brief.summary}</p>
            <p className='text-muted-foreground text-sm'>{tabFocus.detail}</p>
          </div>
          <ul className='grid list-none gap-2 p-0'>
            {brief.checkpoints.map((checkpoint) => (
              <ReviewBriefCheckpoint checkpoint={checkpoint} key={checkpoint.label} />
            ))}
          </ul>
        </section>
      </CardContent>
      <CardContent className='col-span-full grid min-w-0 gap-3 p-0'>
        <RunPrimaryActionPanel run={run} />
        <div className='bg-muted/10 flex flex-wrap items-center justify-between gap-3 rounded-lg p-4'>
          <div className='grid gap-1 text-sm'>
            <strong>CLI/core audit fallback</strong>
            <span className='text-muted-foreground'>
              Studio keeps the web action primary while preserving the exact source command for
              recovery.
            </span>
          </div>
          <CliFallbackCommand command={getNextSafeCommand(run)} label='Next safe action' />
        </div>
      </CardContent>
    </Card>
  );
}

function reviewBadgeLabel(severity: ReturnType<typeof buildStudioRunReviewBrief>["severity"]) {
  if (severity === "blocked") {
    return "Blocked action";
  }
  if (severity === "ready") {
    return "Next action ready";
  }
  return "Reviewable";
}

function ReviewBriefCheckpoint({
  checkpoint,
}: Readonly<{ checkpoint: StudioRunReviewBriefCheckpoint }>) {
  return (
    <li className='grid grid-cols-[auto_minmax(0,1fr)] items-start gap-2'>
      <Badge className='capitalize' variant={checkpointBadgeVariant(checkpoint.status)}>
        {checkpoint.status}
      </Badge>
      <div>
        <strong>{checkpoint.label}</strong>
        <p className='text-muted-foreground mt-0.5 text-xs'>{checkpoint.detail}</p>
      </div>
    </li>
  );
}

function checkpointBadgeVariant(
  status: StudioRunReviewBriefCheckpoint["status"],
): "outline" | "secondary" {
  if (status === "done" || status === "ready") {
    return "secondary";
  }
  return "outline";
}

function RunMetric({ label, value }: Readonly<{ label: string; value: number | string }>) {
  return (
    <div className='min-w-0'>
      <dt className='text-muted-foreground text-xs'>{label}</dt>
      <dd className='mt-1 font-semibold break-words'>{value}</dd>
    </div>
  );
}
