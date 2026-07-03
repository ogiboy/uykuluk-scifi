import { Badge } from "@/components/ui/badge";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { StudioRunDetail } from "@/lib/runSummaries";

type RunReviewSectionTabsProps = Readonly<{
  run: Pick<
    StudioRunDetail,
    | "artifactCount"
    | "blockedActionCount"
    | "finalReviewBundle"
    | "productionMedia"
    | "readinessStatus"
    | "workflowProgress"
  >;
}>;

/**
 * Renders section tabs with compact operator status hints.
 *
 * @param run - The run projection used to summarize each review section.
 */
export function RunReviewSectionTabs({ run }: RunReviewSectionTabsProps) {
  const mediaPassed = run.productionMedia.filter((artifact) => artifact.status === "pass").length;
  const currentWorkflowSteps = run.workflowProgress.filter((step) => step.status === "current");
  const activeWorkflowCount = run.blockedActionCount || currentWorkflowSteps.length;

  return (
    <TabsList className='review-section-tabs' aria-label='Run review sections'>
      <RunReviewTab value='progress' label='Progress' status={formatCount(activeWorkflowCount)} />
      <RunReviewTab
        value='media'
        label='Media'
        status={`${mediaPassed}/${run.productionMedia.length}`}
      />
      <RunReviewTab value='artifacts' label='Artifacts' status={formatCount(run.artifactCount)} />
      <RunReviewTab value='handoff' label='Handoff' status={formatHandoffStatus(run)} />
      <RunReviewTab value='readiness' label='Readiness' status={run.readinessStatus} />
    </TabsList>
  );
}

function RunReviewTab({
  label,
  status,
  value,
}: Readonly<{ label: string; status: string; value: string }>) {
  return (
    <TabsTrigger value={value}>
      <span className='review-section-tab-label'>{label}</span>
      <Badge className='review-section-tab-status' variant='outline'>
        {status}
      </Badge>
    </TabsTrigger>
  );
}

function formatCount(count: number): string {
  return count > 0 ? String(count) : "clear";
}

function formatHandoffStatus(run: Pick<StudioRunDetail, "finalReviewBundle">): "missing" | "ready" {
  return run.finalReviewBundle.kind === "present" ? "ready" : "missing";
}
