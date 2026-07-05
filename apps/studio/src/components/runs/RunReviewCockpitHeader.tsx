import { CopyableCommand } from "@/components/studio/CopyableCommand";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getNextSafeCommand } from "@/lib/runSummaryCopy";
import {
  buildStudioRunReviewBrief,
  type StudioRunReviewBriefCheckpoint,
} from "@/lib/runReviewBrief";
import { runReviewTabFocus } from "@/lib/runReviewNavigation";
import type { StudioRunDetail } from "@/lib/runSummaries";
import { RunPrimaryActionPanel } from "./RunPrimaryActionPanel";

type RunReviewCockpitHeaderProps = Readonly<{
  run: StudioRunDetail;
}>;

/**
 * Renders the primary run-detail operator summary.
 *
 * @param run - The Studio run detail projection to summarize.
 */
export function RunReviewCockpitHeader({ run }: RunReviewCockpitHeaderProps) {
  const brief = buildStudioRunReviewBrief(run);
  const tabFocus = runReviewTabFocus(run);
  return (
    <Card className='run-detail-hero' aria-labelledby='run-overview-heading'>
      <CardHeader className='run-hero-overview'>
        <CardDescription>Run review workspace</CardDescription>
        <CardTitle>
          <h2 id='run-overview-heading'>Run Overview</h2>
        </CardTitle>
        <div className='run-cockpit-badges'>
          <Badge variant={brief.severity === "blocked" ? "destructive" : "secondary"}>
            {reviewBadgeLabel(brief.severity)}
          </Badge>
          <Badge variant={run.renderDecision.kind === "present" ? "secondary" : "outline"}>
            Render decision: {run.renderDecision.kind}
          </Badge>
          <Badge variant='outline'>Focus: {tabFocus.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className='run-hero-metadata'>
        <dl className='run-metadata'>
          <RunMetric label='State' value={run.state} />
          <RunMetric label='Approvals' value={run.approvalCount} />
          <RunMetric label='Warnings' value={run.warningCount} />
          <RunMetric label='Readiness' value={run.readinessStatus} />
          <RunMetric label='Evidence' value={run.evidenceStatus} />
        </dl>
      </CardContent>
      <CardContent className='run-hero-brief'>
        <section className='run-review-brief' aria-labelledby='run-review-brief-heading'>
          <div>
            <p className={`review-brief-severity ${brief.severity}`}>{brief.severity}</p>
            <h3 id='run-review-brief-heading'>{brief.title}</h3>
            <p>{brief.summary}</p>
            <p className='artifact-description'>{tabFocus.detail}</p>
          </div>
          <ul className='review-brief-checkpoints'>
            {brief.checkpoints.map((checkpoint) => (
              <ReviewBriefCheckpoint checkpoint={checkpoint} key={checkpoint.label} />
            ))}
          </ul>
        </section>
      </CardContent>
      <CardContent className='run-hero-command'>
        <RunPrimaryActionPanel run={run} />
        <div className='operator-command-block secondary-command'>
          <strong>CLI/core source command</strong>
          <CopyableCommand command={getNextSafeCommand(run)} label='Next safe action' />
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
    <li>
      <span className={`status-pill small ${checkpoint.status}`}>{checkpoint.status}</span>
      <div>
        <strong>{checkpoint.label}</strong>
        <p>{checkpoint.detail}</p>
      </div>
    </li>
  );
}

function RunMetric({ label, value }: Readonly<{ label: string; value: number | string }>) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
