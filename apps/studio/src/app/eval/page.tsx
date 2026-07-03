import { ModelEvalOverviewView } from "@/components/eval/ModelEvalOverviewView";
import { StudioShell } from "@/components/studio/StudioShell";
import { getStudioModelEvalOverview } from "@/lib/modelEvalOverview";

export const dynamic = "force-dynamic";

/**
 * Renders the read-only local model evaluation page.
 *
 * @returns The local model evaluation page.
 */
export default async function ModelEvalPage() {
  const overview = await getStudioModelEvalOverview();

  return (
    <StudioShell>
      <header className='studio-header'>
        <div>
          <p className='eyebrow'>Read-only local model evidence</p>
          <h1>Local model evaluation</h1>
        </div>
        <span className='status-pill'>No provider calls</span>
      </header>
      <ModelEvalOverviewView overview={overview} />
    </StudioShell>
  );
}
