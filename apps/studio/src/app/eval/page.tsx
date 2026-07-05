import { ModelEvalOverviewView } from "@/components/eval/ModelEvalOverviewView";
import { StudioPageHeader } from "@/components/studio/StudioPageHeader";
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
      <StudioPageHeader
        badge='No provider calls'
        eyebrow='Read-only local model evidence'
        title='Local model evaluation'
      />
      <ModelEvalOverviewView overview={overview} />
    </StudioShell>
  );
}
