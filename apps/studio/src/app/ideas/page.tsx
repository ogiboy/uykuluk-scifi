import { IdeaHistoryOverviewView } from "@/components/ideas/IdeaHistoryOverviewView";
import { StudioPageHeader } from "@/components/studio/StudioPageHeader";
import { StudioShell } from "@/components/studio/StudioShell";
import { getStudioIdeaHistoryOverview } from "@/lib/ideaHistoryOverview";

export const dynamic = "force-dynamic";

/**
 * Renders the Studio idea originality page.
 *
 * @returns The read-only idea history surface.
 */
export default async function IdeasPage() {
  const overview = await getStudioIdeaHistoryOverview();

  return (
    <StudioShell>
      <StudioPageHeader
        badge='Runtime artifacts only'
        eyebrow='Read-only originality guard'
        title='Idea history'
      />
      <IdeaHistoryOverviewView overview={overview} />
    </StudioShell>
  );
}
