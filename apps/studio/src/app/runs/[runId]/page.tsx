import Link from "next/link";
import { notFound } from "next/navigation";
import { RunDetailView } from "@/components/runs/RunDetailView";
import { getStudioRunDetail } from "@/lib/runSummaries";

type RunDetailPageProps = {
  params: Promise<{ runId: string }>;
};

export default async function RunDetailPage({ params }: RunDetailPageProps) {
  const { runId } = await params;
  const run = await getStudioRunDetail(runId);
  if (!run) {
    notFound();
  }

  return (
    <main className='studio-main page-shell'>
      <header className='studio-header'>
        <div>
          <p className='eyebrow'>Read-only run detail</p>
          <h1>{run.runId}</h1>
        </div>
        <Link className='status-pill' href='/runs'>
          All runs
        </Link>
      </header>
      <RunDetailView run={run} />
    </main>
  );
}
