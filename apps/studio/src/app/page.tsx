import { AssetInventory } from "@/components/AssetInventory";
import { CommandPanel } from "@/components/CommandPanel";
import { ServiceContractPanel } from "@/components/ServiceContractPanel";
import { StatusGrid } from "@/components/StatusGrid";
import { AnalyticsStatusPanel } from "@/components/analytics/AnalyticsStatusPanel";
import { DoctorStatusPanel } from "@/components/doctor/DoctorStatusPanel";
import { ModelEvalStatusPanel } from "@/components/eval/ModelEvalStatusPanel";
import { LatestRunReadinessPanel } from "@/components/runs/LatestRunReadinessPanel";
import { StudioControlDesk } from "@/components/studio/StudioControlDesk";
import { StudioCommandPalette } from "@/components/studio/StudioCommandPalette";
import { StudioShell } from "@/components/studio/StudioShell";
import { StudioTabs } from "@/components/studio/StudioTabs";
import { getStudioAnalyticsOverview } from "@/lib/analyticsOverview";
import { getStudioActionServiceStatus } from "@/lib/actionServiceStatus";
import { getStudioAssetInventory } from "@/lib/assetInventory";
import { getStudioDoctorOverview } from "@/lib/doctorOverview";
import { getStudioModelEvalOverview } from "@/lib/modelEvalOverview";
import { getStudioPromptInventory } from "@/lib/promptInventory";
import { listStudioRuns } from "@/lib/runSummaries";

export const dynamic = "force-dynamic";

/**
 * Renders the Studio home page.
 *
 * @returns The Studio page layout with navigation, status panels, and the current asset inventory.
 */
export default async function StudioHomePage() {
  const actionStatus = getStudioActionServiceStatus();
  const [
    analyticsOverview,
    assetInventory,
    doctorOverview,
    modelEvalOverview,
    promptInventory,
    runs,
  ] = await Promise.all([
    getStudioAnalyticsOverview(),
    getStudioAssetInventory(),
    getStudioDoctorOverview(),
    getStudioModelEvalOverview(),
    getStudioPromptInventory(),
    listStudioRuns(),
  ]);

  return (
    <StudioShell>
      <header className='studio-header'>
        <div>
          <p className='eyebrow'>Local-first production desk</p>
          <h1>Control UykulukSciFi production from the web surface</h1>
        </div>
        <div className='studio-header-actions'>
          <StudioCommandPalette runs={runs} />
          <span className='status-pill'>CLI source of truth</span>
        </div>
      </header>

      <StudioControlDesk actionStatus={actionStatus} runs={runs} />
      <StatusGrid />
      <DoctorStatusPanel overview={doctorOverview} />
      <ModelEvalStatusPanel overview={modelEvalOverview} />
      <LatestRunReadinessPanel latestRun={runs[0] ?? null} />
      <AnalyticsStatusPanel overview={analyticsOverview} />
      <CommandPanel />
      <ServiceContractPanel />
      <AssetInventory inventory={assetInventory} />
      <StudioTabs promptInventory={promptInventory} />
    </StudioShell>
  );
}
