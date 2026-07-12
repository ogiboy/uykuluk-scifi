import { RunDetailView } from "@/components/runs/RunDetailView";
import { StudioPageHeader } from "@/components/studio/StudioPageHeader";
import { StudioShell } from "@/components/studio/StudioShell";
import { buttonVariants } from "@/components/ui/button";
import {
  defaultRunReviewTab,
  runReviewTabFromSearchParams,
  type RunReviewSearchParams,
} from "@/lib/runs/runReviewNavigation";
import { isRunId } from "@/lib/runs/runSummaryFiles";
import { getStudioRunDetail } from "@/lib/runSummaries";
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
      <StudioPageHeader
        actions={
          <Link className={buttonVariants({ variant: "secondary" })} href='/runs'>
            All runs
          </Link>
        }
        eyebrow='Run review workspace'
        title={run.runId}
      />
      <RunDetailView initialTab={initialTab} run={run} />
    </StudioShell>
  );
}
