import { Badge } from "@/components/ui/badge";
import { RunQueueExplorer } from "@/components/runs/RunQueueExplorer";
import { StudioCommandPalette } from "@/components/studio/StudioCommandPalette";
import { StudioPageHeader } from "@/components/studio/StudioPageHeader";
import { StudioShell } from "@/components/studio/StudioShell";
import { getStudioDoctorOverview } from "@/lib/doctorOverview";
import { listStudioRuns } from "@/lib/runSummaries";
import { startIdeasReadinessFromDoctor } from "@/lib/startIdeasReadiness";

export default async function RunsPage() {
  const [doctorOverview, runs] = await Promise.all([getStudioDoctorOverview(), listStudioRuns()]);
  const startIdeasReadiness = startIdeasReadinessFromDoctor(doctorOverview);

  return (
    <StudioShell>
      <StudioPageHeader
        actions={
          <>
            <StudioCommandPalette runs={runs} />
            <Badge variant='secondary'>CLI source of truth</Badge>
          </>
        }
        eyebrow='Read-only local run review'
        title='Producer runs'
      />
      <RunQueueExplorer runs={runs} startIdeasReadiness={startIdeasReadiness} />
    </StudioShell>
  );
}
