import { RunDetailView } from "@/components/runs/RunDetailView";
import { StudioShell } from "@/components/studio/StudioShell";
import {
  defaultRunReviewTab,
  runReviewTabFromSearchParams,
  type RunReviewSearchParams,
} from "@/lib/runReviewNavigation";
import { getStudioRunDetail } from "@/lib/runSummaries";
import { isRunId } from "@/lib/runSummaryFiles";
import Link from "next/link";
import { notFound } from "next/navigation";

type RunDetailPageProps = {
  params: Promise<{ runId: string }>;
  searchParams?: Promise<RunReviewSearchParams>;
};

export default async function RunDetailPage({
  params,
  searchParams,
}: Readonly<RunDetailPageProps>) {
  const { runId } = await params;
  if (!isRunId(runId)) {
    notFound();
  }
  const run = await getStudioRunDetail(runId);
  if (!run) {
    notFound();
  }
  const initialTab = runReviewTabFromSearchParams(await searchParams, defaultRunReviewTab(run));

  return (
    <StudioShell>
      <header className='studio-header'>
        <div>
          <p className='eyebrow'>Run review workspace</p>
          <h1>{run.runId}</h1>
        </div>
        <Link className='status-pill' href='/runs'>
          All runs
        </Link>
      </header>
      <RunDetailView initialTab={initialTab} run={run} />
    </StudioShell>
  );
}
