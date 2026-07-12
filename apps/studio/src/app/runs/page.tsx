import { RunQueueExplorer } from "@/components/runs/RunQueueExplorer";
import { StartIdeasActionPanel } from "@/components/studio/StartIdeasActionPanel";
import { StudioCommandPalette } from "@/components/studio/StudioCommandPalette";
import { StudioPageHeader } from "@/components/studio/StudioPageHeader";
import { StudioShell } from "@/components/studio/StudioShell";
import { Badge } from "@/components/ui/badge";
import { startIdeasReadinessFromDoctor } from "@/lib/actions/startIdeasReadiness";
import { getStudioDoctorOverview } from "@/lib/doctorOverview";
import { listStudioRuns } from "@/lib/runSummaries";

export default async function RunsPage() {
  const [doctorOverview, runs] = await Promise.all([getStudioDoctorOverview(), listStudioRuns()]);
  const startIdeasReadiness = startIdeasReadinessFromDoctor(doctorOverview);

  return (
    <StudioShell>
      <StudioPageHeader
        actions={
          <>
            <StartIdeasActionPanel
              buttonLabel='Start idea run'
              presentation='button'
              readiness={startIdeasReadiness}
              showResult={false}
              variant='default'
            />
            <StudioCommandPalette runs={runs} />
            <Badge variant='secondary'>Local core verified</Badge>
          </>
        }
        eyebrow='Read-only local run review'
        title='Producer runs'
      />
      <RunQueueExplorer runs={runs} startIdeasReadiness={startIdeasReadiness} />
    </StudioShell>
  );
}
