import { AssetInventory } from "@/components/AssetInventory";
import { CommandPanel } from "@/components/CommandPanel";
import { ServiceContractPanel } from "@/components/ServiceContractPanel";
import { StatusGrid } from "@/components/StatusGrid";
import { AnalyticsStatusPanel } from "@/components/analytics/AnalyticsStatusPanel";
import { DoctorStatusPanel } from "@/components/doctor/DoctorStatusPanel";
import { ModelEvalStatusPanel } from "@/components/eval/ModelEvalStatusPanel";
import { LatestRunReadinessPanel } from "@/components/runs/LatestRunReadinessPanel";
import { StudioTabs } from "@/components/studio/StudioTabs";
import { getStudioAnalyticsOverview } from "@/lib/analyticsOverview";
import { getStudioAssetInventory } from "@/lib/assetInventory";
import { getStudioDoctorOverview } from "@/lib/doctorOverview";
import { getStudioModelEvalOverview } from "@/lib/modelEvalOverview";
import { getStudioPromptInventory } from "@/lib/promptInventory";
import { listStudioRuns } from "@/lib/runSummaries";
import { studioSections } from "@/lib/studioData";

export const dynamic = "force-dynamic";

/**
 * Renders the Studio home page.
 *
 * @returns The Studio page layout with navigation, status panels, and the current asset inventory.
 */
export default async function StudioHomePage() {
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
    <main className='studio-shell'>
      <aside className='studio-rail' aria-label='Studio navigation'>
        <div className='brand-lockup'>
          <span className='brand-mark'>USF</span>
          <div>
            <p>UykulukSciFi</p>
            <strong>Producer Studio</strong>
          </div>
        </div>
        <nav>
          {studioSections.map((section) =>
            "href" in section ? (
              <a key={section.id} href={section.href}>
                {section.label}
              </a>
            ) : (
              <a key={section.id} href={`#${section.id}`}>
                {section.label}
              </a>
            ),
          )}
        </nav>
      </aside>

      <section className='studio-main'>
        <header className='studio-header'>
          <div>
            <p className='eyebrow'>Local-first production desk</p>
            <h1>Manual approval-gated sci-fi video production</h1>
          </div>
          <span className='status-pill'>CLI source of truth</span>
        </header>

        <StatusGrid />
        <DoctorStatusPanel overview={doctorOverview} />
        <ModelEvalStatusPanel overview={modelEvalOverview} />
        <LatestRunReadinessPanel latestRun={runs[0] ?? null} />
        <AnalyticsStatusPanel overview={analyticsOverview} />
        <CommandPanel />
        <ServiceContractPanel />
        <AssetInventory inventory={assetInventory} />
        <StudioTabs promptInventory={promptInventory} />
      </section>
    </main>
  );
}
