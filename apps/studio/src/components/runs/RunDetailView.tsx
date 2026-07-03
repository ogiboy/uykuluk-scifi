import type { StudioRunDetail } from "@/lib/runSummaries";
import { defaultRunReviewTab, type RunReviewTab } from "@/lib/runReviewNavigation";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { RunArtifactPreviewsPanel } from "./RunArtifactPreviewsPanel";
import { RunChannelHandoffPanel } from "./RunChannelHandoffPanel";
import { RunFinalReviewBundlePanel } from "./RunFinalReviewBundlePanel";
import { RunProductionMediaPanel } from "./RunProductionMediaPanel";
import { RunReadinessDiagnosticsPanels } from "./RunReadinessDiagnosticsPanels";
import { RunReviewActionSummarySheet } from "./RunReviewActionSummarySheet";
import { RunReviewCockpitHeader } from "./RunReviewCockpitHeader";
import { RunReviewDecisionRail } from "./RunReviewDecisionRail";
import { RunReviewSectionTabs } from "./RunReviewSectionTabs";
import { RunWorkflowProgressPanel } from "./RunWorkflowProgressPanel";

/**
 * Renders a read-only detail view for a run.
 *
 * @param initialTab - The run review tab selected from URL or run-state projection.
 * @param run - The run data to display.
 */
export function RunDetailView({
  initialTab,
  run,
}: Readonly<{ initialTab?: RunReviewTab; run: StudioRunDetail }>) {
  const defaultTab = initialTab ?? defaultRunReviewTab(run);
  return (
    <div className='run-review-page'>
      <RunReviewCockpitHeader run={run} />
      <RunReviewActionSummarySheet run={run} />

      <div className='run-review-cockpit'>
        <Tabs defaultValue={defaultTab} className='run-review-tabs'>
          <RunReviewSectionTabs run={run} />

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
                runId={run.runId}
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
