import Link from "next/link";

import { EmptyRunCard } from "@/components/studio/EmptyRunCard";
import { OperatorBrief } from "@/components/studio/OperatorBrief";
import { ActiveRunCard, ActiveRunSnapshot } from "@/components/studio/control-desk/ActiveRunCards";
import {
  HomeControlRail,
  StudioSafetySummaryRail,
} from "@/components/studio/control-desk/StudioControlRails";
import { buttonVariants } from "@/components/ui/button";
import type { StudioActionServiceStatus } from "@/lib/actionServiceStatus";
import { startIdeasReadinessFromDoctor } from "@/lib/actions/startIdeasReadiness";
import type { StudioDoctorOverview } from "@/lib/doctorOverview";
import type { StudioRunSummary } from "@/lib/runSummaries";

type StudioControlDeskProps = Readonly<{
  actionStatus: StudioActionServiceStatus;
  doctorOverview: StudioDoctorOverview;
  runs: readonly StudioRunSummary[];
  variant?: "compact" | "full";
}>;

/**
 * Renders the Studio home control surface for the current local production queue.
 *
 * @param actionStatus - Current guarded Studio action contract status.
 * @param doctorOverview - Latest persisted producer doctor overview.
 * @param runs - Persisted producer run summaries, newest first.
 * @param variant - Whether to render the compact home view or the full action workbench view.
 * @returns The first-screen operator control desk.
 */
export function StudioControlDesk({
  actionStatus,
  doctorOverview,
  runs,
  variant = "full",
}: StudioControlDeskProps) {
  const latestRun = runs[0] ?? null;
  const startIdeasReadiness = startIdeasReadinessFromDoctor(doctorOverview);
  const compact = variant === "compact";
  const activeRun = activeRunContent(latestRun, compact, startIdeasReadiness);

  return (
    <section
      className={
        compact
          ? "grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]"
          : "grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]"
      }
      aria-labelledby='control-desk-heading'
    >
      <div className='grid min-w-0 content-start gap-4'>
        <div className='grid gap-4 sm:grid-cols-[1fr_auto] sm:items-start'>
          <div className='space-y-2'>
            <p className='text-muted-foreground text-xs font-semibold tracking-[0.28em] uppercase'>
              Operator control desk
            </p>
            <h2 className='text-2xl font-semibold tracking-tight' id='control-desk-heading'>
              Current production queue
            </h2>
          </div>
          <Link className={buttonVariants({ variant: "secondary" })} href='/runs'>
            Open all runs
          </Link>
        </div>

        <OperatorBrief latestRun={latestRun} startIdeasReadiness={startIdeasReadiness} />

        {activeRun}
      </div>

      {compact ? (
        <HomeControlRail
          actionStatus={actionStatus}
          runs={runs}
          startIdeasReadiness={startIdeasReadiness}
        />
      ) : (
        <StudioSafetySummaryRail
          actionStatus={actionStatus}
          latestRun={latestRun}
          runs={runs}
          startIdeasReadiness={startIdeasReadiness}
        />
      )}
    </section>
  );
}

function activeRunContent(
  latestRun: StudioRunSummary | null,
  compact: boolean,
  readiness: ReturnType<typeof startIdeasReadinessFromDoctor>,
) {
  if (!latestRun) {
    return <EmptyRunCard readiness={readiness} />;
  }
  if (compact) {
    return <ActiveRunSnapshot run={latestRun} />;
  }
  return <ActiveRunCard run={latestRun} />;
}
