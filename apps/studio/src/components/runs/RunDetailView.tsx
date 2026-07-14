import { TabsContent } from "@/components/ui/tabs";
import { defaultRunReviewTab, type RunReviewTab } from "@/lib/runs/runReviewNavigation";
import type { StudioRunDetail } from "@/lib/runSummaries";
import { RunProductionMediaPanel } from "./production-media/RunProductionMediaPanel";
import { RunArtifactPreviewsPanel } from "./RunArtifactPreviewsPanel";
import { RunChannelHandoffPanel } from "./RunChannelHandoffPanel";
import { RunFinalReviewBundlePanel } from "./RunFinalReviewBundlePanel";
import { RunReadinessDiagnosticsPanels } from "./RunReadinessDiagnosticsPanels";
import { RunReviewActionSummarySheet } from "./RunReviewActionSummarySheet";
import { RunReviewCockpitHeader } from "./RunReviewCockpitHeader";
import { RunReviewDecisionRail } from "./RunReviewDecisionRail";
import { RunReviewSectionTabs } from "./RunReviewSectionTabs";
import { RunReviewTabs } from "./RunReviewTabs";
import { RunWorkflowProgressPanel } from "./RunWorkflowProgressPanel";
import { RunVisualReviewPanel } from "./visual-review/RunVisualReviewPanel";
import { RunVoiceAuditionPanel } from "./voice-audition/RunVoiceAuditionPanel";

const reviewWorkspaceClass =
  "grid min-w-0 items-start gap-4 min-[720px]:grid-cols-[repeat(auto-fit,minmax(320px,1fr))]";

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
    <div className='grid min-w-0 gap-4'>
      <RunReviewCockpitHeader run={run} />
      <RunReviewActionSummarySheet run={run} />

      <div className='grid min-w-0 items-start gap-4 min-[1181px]:grid-cols-[minmax(0,1fr)_minmax(320px,0.42fr)]'>
        <RunReviewTabs initialTab={defaultTab}>
          <RunReviewSectionTabs run={run} />

          <TabsContent value='progress'>
            <div className={reviewWorkspaceClass}>
              <RunWorkflowProgressPanel workflowProgress={run.workflowProgress} />
            </div>
          </TabsContent>
          <TabsContent value='media'>
            <div className={reviewWorkspaceClass}>
              <RunProductionMediaPanel
                evidenceMessage={run.evidenceMessage}
                evidenceNextAction={run.evidenceNextAction}
                evidenceStatus={run.evidenceStatus}
                productionMedia={run.productionMedia}
                runId={run.runId}
              />
            </div>
          </TabsContent>
          <TabsContent value='visuals'>
            <RunVisualReviewPanel runId={run.runId} summary={run.visuals} />
          </TabsContent>
          <TabsContent value='voice'>
            <div className={reviewWorkspaceClass}>
              <RunVoiceAuditionPanel runId={run.runId} summary={run.voiceAudition} />
            </div>
          </TabsContent>
          <TabsContent value='artifacts'>
            <div className={reviewWorkspaceClass}>
              <RunArtifactPreviewsPanel
                artifacts={run.artifacts}
                evidenceStatus={run.evidenceStatus}
              />
            </div>
          </TabsContent>
          <TabsContent value='handoff'>
            <div className={reviewWorkspaceClass}>
              <RunFinalReviewBundlePanel finalReviewBundle={run.finalReviewBundle} />
              <RunChannelHandoffPanel channelHandoff={run.channelHandoff} />
            </div>
          </TabsContent>
          <TabsContent value='readiness'>
            <div className={reviewWorkspaceClass}>
              <RunReadinessDiagnosticsPanels run={run} />
            </div>
          </TabsContent>
        </RunReviewTabs>

        <aside
          className='min-w-0 min-[1181px]:sticky min-[1181px]:top-4 min-[1181px]:max-h-[calc(100dvh-2rem)] min-[1181px]:overflow-auto'
          aria-label='Persistent run action rail'
        >
          <RunReviewDecisionRail run={run} />
        </aside>
      </div>
    </div>
  );
}
