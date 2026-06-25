import { AnalyticsOverviewView } from "@/components/analytics/AnalyticsOverviewView";
import { getStudioAnalyticsOverview } from "@/lib/analyticsOverview";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const overview = await getStudioAnalyticsOverview();

  return (
    <main className='studio-main page-shell'>
      <header className='studio-header'>
        <div>
          <p className='eyebrow'>Read-only manual feedback loop</p>
          <h1>Analytics feedback</h1>
        </div>
        <Link className='status-pill' href='/'>
          Studio home
        </Link>
      </header>
      <AnalyticsOverviewView overview={overview} />
    </main>
  );
}
