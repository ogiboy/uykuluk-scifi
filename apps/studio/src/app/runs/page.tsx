import { Badge } from "@/components/ui/badge";
import { RunQueueExplorer } from "@/components/runs/RunQueueExplorer";
import { StudioCommandPalette } from "@/components/studio/StudioCommandPalette";
import { StudioPageHeader } from "@/components/studio/StudioPageHeader";
import { StudioShell } from "@/components/studio/StudioShell";
import { listStudioRuns } from "@/lib/runSummaries";

export default async function RunsPage() {
  const runs = await listStudioRuns();

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
      <RunQueueExplorer runs={runs} />
    </StudioShell>
  );
}
