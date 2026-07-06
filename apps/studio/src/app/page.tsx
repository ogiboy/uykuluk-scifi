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
import { Badge } from "@/components/ui/badge";
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
      <header className='grid gap-4 border-b border-border/40 pb-6 sm:grid-cols-[1fr_auto] sm:items-start'>
        <div className='space-y-2'>
          <p className='text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground'>
            Local-first production desk
          </p>
          <h1 className='max-w-4xl text-3xl font-semibold tracking-tight sm:text-4xl'>
            Control UykulukSciFi production from the web surface
          </h1>
        </div>
        <div className='flex flex-wrap items-center gap-2 sm:justify-end'>
          <StudioCommandPalette runs={runs} />
          <Badge variant='secondary'>CLI source of truth</Badge>
        </div>
      </header>

      <StudioControlDesk actionStatus={actionStatus} doctorOverview={doctorOverview} runs={runs} />
      <StatusGrid />
      <DoctorStatusPanel overview={doctorOverview} />
      <ModelEvalStatusPanel overview={modelEvalOverview} />
      <LatestRunReadinessPanel latestRun={runs[0] ?? null} />
      <AnalyticsStatusPanel overview={analyticsOverview} />
      <CommandPanel />
      <ServiceContractPanel status={actionStatus} />
      <AssetInventory inventory={assetInventory} />
      <StudioTabs promptInventory={promptInventory} />
    </StudioShell>
  );
}
