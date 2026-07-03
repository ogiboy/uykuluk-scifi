import { RunDetailView } from "@/components/runs/RunDetailView";
import { StudioShell } from "@/components/studio/StudioShell";
import { getStudioRunDetail } from "@/lib/runSummaries";
import Link from "next/link";
import { notFound } from "next/navigation";

type RunDetailPageProps = {
  params: Promise<{ runId: string }>;
};

export default async function RunDetailPage({ params }: Readonly<RunDetailPageProps>) {
  const { runId } = await params;
  const run = await getStudioRunDetail(runId);
  if (!run) {
    notFound();
  }

  return (
    <StudioShell>
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
    </StudioShell>
  );
}
