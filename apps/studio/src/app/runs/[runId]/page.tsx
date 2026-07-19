import { RunDetailView } from "@/components/runs/RunDetailView";
import { StudioPageHeader } from "@/components/studio/StudioPageHeader";
import { StudioShell } from "@/components/studio/StudioShell";
import { buttonVariants } from "@/components/ui/button";
import { normalizeStudioLocale } from "@/i18n/locales";
import {
  defaultRunReviewTab,
  runReviewTabFromSearchParams,
  type RunReviewSearchParams,
} from "@/lib/runs/runReviewNavigation";
import { isRunId } from "@/lib/runs/runSummaryFiles";
import { getStudioRunDetail } from "@/lib/runSummaries";
import { getLocale } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";

type RunDetailPageProps = {
  params: Promise<{ runId: string }>;
  searchParams?: Promise<RunReviewSearchParams>;
};

/**
 * Renders the run review workspace for a validated run.
 *
 * Uses the requested review tab when valid and otherwise selects the run's default tab.
 * Renders a not-found page when the run ID is invalid or the run cannot be loaded.
 *
 * @param params - Route parameters containing the run ID.
 * @param searchParams - Optional review navigation parameters.
 * @returns The rendered run review page.
 */
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
  const resolvedSearchParams = await searchParams;
  const initialTab = runReviewTabFromSearchParams(resolvedSearchParams, defaultRunReviewTab(run));
  const locale = await getLocale();

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
      <RunDetailView initialTab={initialTab} locale={normalizeStudioLocale(locale)} run={run} />
    </StudioShell>
  );
}
