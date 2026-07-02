import type { StudioRunDetail } from "@/lib/runSummaries";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RunArtifactPreviewsPanel } from "./RunArtifactPreviewsPanel";
import { RunChannelHandoffPanel } from "./RunChannelHandoffPanel";
import { RunFinalReviewBundlePanel } from "./RunFinalReviewBundlePanel";
import { RunProductionMediaPanel } from "./RunProductionMediaPanel";
import { RunReadinessDiagnosticsPanels } from "./RunReadinessDiagnosticsPanels";
import { RunReviewActionSummarySheet } from "./RunReviewActionSummarySheet";
import { RunReviewCockpitHeader } from "./RunReviewCockpitHeader";
import { RunReviewDecisionRail } from "./RunReviewDecisionRail";
import { RunWorkflowProgressPanel } from "./RunWorkflowProgressPanel";

/**
 * Renders a read-only detail view for a run.
 *
 * @param run - The run data to display.
 */
export function RunDetailView({ run }: Readonly<{ run: StudioRunDetail }>) {
  return (
    <div className='run-review-page'>
      <RunReviewCockpitHeader run={run} />
      <RunReviewActionSummarySheet run={run} />

      <div className='run-review-cockpit'>
        <Tabs defaultValue='progress' className='run-review-tabs'>
          <TabsList className='review-section-tabs' aria-label='Run review sections'>
            <TabsTrigger value='progress'>Progress</TabsTrigger>
            <TabsTrigger value='media'>Media</TabsTrigger>
            <TabsTrigger value='artifacts'>Artifacts</TabsTrigger>
            <TabsTrigger value='handoff'>Handoff</TabsTrigger>
            <TabsTrigger value='readiness'>Readiness</TabsTrigger>
          </TabsList>

          <TabsContent value='progress'>
            <div className='run-review-workspace'>
              <RunWorkflowProgressPanel workflowProgress={run.workflowProgress} />
            </div>
          </TabsContent>
          <TabsContent value='media'>
            <div className='run-review-workspace'>
              <RunProductionMediaPanel
                evidenceMessage={run.evidenceMessage}
                evidenceNextAction={run.evidenceNextAction}
                evidenceStatus={run.evidenceStatus}
                productionMedia={run.productionMedia}
              />
            </div>
          </TabsContent>
          <TabsContent value='artifacts'>
            <div className='run-review-workspace'>
              <RunArtifactPreviewsPanel
                artifacts={run.artifacts}
                evidenceStatus={run.evidenceStatus}
              />
            </div>
          </TabsContent>
          <TabsContent value='handoff'>
            <div className='run-review-workspace'>
              <RunFinalReviewBundlePanel finalReviewBundle={run.finalReviewBundle} />
              <RunChannelHandoffPanel channelHandoff={run.channelHandoff} />
            </div>
          </TabsContent>
          <TabsContent value='readiness'>
            <div className='run-review-workspace'>
              <RunReadinessDiagnosticsPanels run={run} />
            </div>
          </TabsContent>
        </Tabs>

        <aside className='run-review-sticky-rail' aria-label='Persistent run action rail'>
          <RunReviewDecisionRail run={run} />
        </aside>
      </div>
    </div>
  );
}
