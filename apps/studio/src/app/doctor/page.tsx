import { DoctorOverviewView } from "@/components/doctor/DoctorOverviewView";
import { StudioShell } from "@/components/studio/StudioShell";
import { getStudioDoctorOverview } from "@/lib/doctorOverview";

export const dynamic = "force-dynamic";

/**
 * Renders the read-only producer doctor diagnostics page.
 *
 * @returns The producer doctor diagnostics page.
 */
export default async function DoctorPage() {
  const overview = await getStudioDoctorOverview();

  return (
    <StudioShell>
      <header className='studio-header'>
        <div>
          <p className='eyebrow'>Read-only project diagnostics</p>
          <h1>Producer doctor diagnostics</h1>
        </div>
        <span className='status-pill'>Read-only diagnostics</span>
      </header>
      <DoctorOverviewView overview={overview} />
    </StudioShell>
  );
}
