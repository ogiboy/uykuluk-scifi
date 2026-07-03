import { AnalyticsOverviewView } from "@/components/analytics/AnalyticsOverviewView";
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
      <header className='studio-header'>
        <div>
          <p className='eyebrow'>Read-only manual feedback loop</p>
          <h1>Analytics feedback</h1>
        </div>
        <span className='status-pill'>Manual import only</span>
      </header>
      <AnalyticsOverviewView overview={overview} />
    </StudioShell>
  );
}
