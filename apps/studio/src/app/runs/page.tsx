import { RunSummaryTable } from "@/components/runs/RunSummaryTable";
import { listStudioRuns } from "@/lib/runSummaries";
import Link from "next/link";

export default async function RunsPage() {
  const runs = await listStudioRuns();

  return (
    <main className='studio-main page-shell'>
      <header className='studio-header'>
        <div>
          <p className='eyebrow'>Read-only local run review</p>
          <h1>Producer runs</h1>
        </div>
        <Link className='status-pill' href='/'>
          Studio home
        </Link>
      </header>
      <RunSummaryTable runs={runs} />
    </main>
  );
}
