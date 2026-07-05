import { AnalyticsOverviewView } from "@/components/analytics/AnalyticsOverviewView";
import { StudioPageHeader } from "@/components/studio/StudioPageHeader";
import { StudioShell } from "@/components/studio/StudioShell";
import { getStudioAnalyticsOverview } from "@/lib/analyticsOverview";

export const dynamic = "force-dynamic";

/**
 * Renders the analytics feedback page.
 *
 * @returns The analytics feedback page.
 */
export default async function AnalyticsPage() {
  const overview = await getStudioAnalyticsOverview();

  return (
    <StudioShell>
      <StudioPageHeader
        badge='Manual import only'
        eyebrow='Read-only manual feedback loop'
        title='Analytics feedback'
      />
      <AnalyticsOverviewView overview={overview} />
    </StudioShell>
  );
}
