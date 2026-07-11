import { HomeSurfaceLinks } from "@/components/studio/HomeSurfaceLinks";
import { StudioCommandPalette } from "@/components/studio/StudioCommandPalette";
import { StudioControlDesk } from "@/components/studio/StudioControlDesk";
import { StudioShell } from "@/components/studio/StudioShell";
import { Badge } from "@/components/ui/badge";
import { getStudioActionServiceStatus } from "@/lib/actionServiceStatus";
import { getStudioAnalyticsOverview } from "@/lib/analyticsOverview";
import { getStudioAssetInventory } from "@/lib/assetInventory";
import { getStudioDoctorOverview } from "@/lib/doctorOverview";
import { getStudioIdeaHistoryOverview } from "@/lib/ideaHistoryOverview";
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
    ideaHistoryOverview,
    modelEvalOverview,
    promptInventory,
    runs,
  ] = await Promise.all([
    getStudioAnalyticsOverview(),
    getStudioAssetInventory(),
    getStudioDoctorOverview(),
    getStudioIdeaHistoryOverview(),
    getStudioModelEvalOverview(),
    getStudioPromptInventory(),
    listStudioRuns(),
  ]);

  return (
    <StudioShell>
      <header className='grid gap-4 pb-2 sm:grid-cols-[1fr_auto] sm:items-start'>
        <div className='space-y-2'>
          <p className='text-muted-foreground text-xs font-semibold tracking-[0.28em] uppercase'>
            Local-first production desk
          </p>
          <h1 className='max-w-4xl text-3xl font-semibold tracking-tight sm:text-4xl'>
            Control UykulukSciFi production from the web surface
          </h1>
        </div>
        <div className='flex flex-wrap items-center gap-2 sm:justify-end'>
          <StudioCommandPalette runs={runs} />
          <Badge variant='secondary'>Local core verified</Badge>
        </div>
      </header>

      <StudioControlDesk
        actionStatus={actionStatus}
        doctorOverview={doctorOverview}
        runs={runs}
        variant='compact'
      />
      <HomeSurfaceLinks
        actionStatus={actionStatus}
        analyticsOverview={analyticsOverview}
        assetInventory={assetInventory}
        doctorOverview={doctorOverview}
        ideaHistoryOverview={ideaHistoryOverview}
        modelEvalOverview={modelEvalOverview}
        promptInventory={promptInventory}
        runs={runs}
      />
    </StudioShell>
  );
}
