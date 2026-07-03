import { RunQueueExplorer } from "@/components/runs/RunQueueExplorer";
import { StudioCommandPalette } from "@/components/studio/StudioCommandPalette";
import { StudioShell } from "@/components/studio/StudioShell";
import { listStudioRuns } from "@/lib/runSummaries";

export default async function RunsPage() {
  const runs = await listStudioRuns();

  return (
    <StudioShell>
      <header className='studio-header'>
        <div>
          <p className='eyebrow'>Read-only local run review</p>
          <h1>Producer runs</h1>
        </div>
        <div className='studio-header-actions'>
          <StudioCommandPalette runs={runs} />
          <span className='status-pill'>CLI source of truth</span>
        </div>
      </header>
      <RunQueueExplorer runs={runs} />
    </StudioShell>
  );
}
