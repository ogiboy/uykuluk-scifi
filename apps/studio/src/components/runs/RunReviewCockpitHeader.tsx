import { CopyableCommand } from "@/components/studio/CopyableCommand";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { StudioRunDetail } from "@/lib/runSummaries";

type RunReviewCockpitHeaderProps = Readonly<{
  run: StudioRunDetail;
}>;

/**
 * Renders the primary run-detail operator summary.
 *
 * @param run - The Studio run detail projection to summarize.
 */
export function RunReviewCockpitHeader({ run }: RunReviewCockpitHeaderProps) {
  return (
    <Card className='run-detail-hero' aria-labelledby='run-overview-heading'>
      <CardHeader>
        <CardDescription>Run review workspace</CardDescription>
        <CardTitle>
          <h2 id='run-overview-heading'>Run Overview</h2>
        </CardTitle>
        <div className='run-cockpit-badges'>
          <Badge variant={run.blockedActionCount > 0 ? "destructive" : "secondary"}>
            {run.blockedActionCount > 0 ? "Blocked action" : "Reviewable"}
          </Badge>
          <Badge variant={run.renderDecision.kind === "present" ? "secondary" : "outline"}>
            Render decision: {run.renderDecision.kind}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <dl className='run-metadata'>
          <RunMetric label='State' value={run.state} />
          <RunMetric label='Approvals' value={run.approvalCount} />
          <RunMetric label='Warnings' value={run.warningCount} />
          <RunMetric label='Readiness' value={run.readinessStatus} />
          <RunMetric label='Evidence' value={run.evidenceStatus} />
        </dl>
      </CardContent>
      <CardContent>
        <div className='operator-command-block'>
          <strong>Next safe action</strong>
          <CopyableCommand
            command={run.nextRecommendedCommand ?? `pnpm producer evidence --run ${run.runId}`}
            label='Next safe action'
          />
          <p>
            Studio can record guarded local approvals where route security is enabled. Generation,
            artifact creation, upload, and publish stay with CLI/core gates.
          </p>
        </div>
      </CardContent>
    </Card>
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
