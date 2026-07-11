import { DoctorOverviewView } from "@/components/doctor/DoctorOverviewView";
import { StudioPageHeader } from "@/components/studio/StudioPageHeader";
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
      <StudioPageHeader
        badge='Read-only diagnostics'
        eyebrow='Read-only project diagnostics'
        title='Producer doctor diagnostics'
      />
      <DoctorOverviewView overview={overview} />
    </StudioShell>
  );
}
