import Link from "next/link";
import type { Route } from "next";
import { ActiveRunActions } from "@/components/studio/ActiveRunActions";
import { formatStudioInteger, MetricGrid } from "@/components/studio/MetricGrid";
import { runReviewHrefFromSummary } from "@/lib/runReviewNavigation";
import type { StudioRunSummary } from "@/lib/runSummaries";
import {
  formatRunRenderDecision,
  formatRunReviewCounts,
  getNextSafeCommand,
  NO_RUNS_NEXT_COMMAND,
} from "@/lib/runSummaryCopy";
import type { StudioActionServiceStatus } from "@/lib/actionServiceStatus";
import {
  buildStudioActionWorkbench,
  type StudioActionWorkbenchTone,
} from "@/lib/studioActionWorkbench";
import { CopyableCommand } from "./CopyableCommand";
import { StudioMutationSessionPanel } from "./StudioMutationSessionPanel";

type StudioControlDeskProps = Readonly<{
  actionStatus: StudioActionServiceStatus;
  runs: readonly StudioRunSummary[];
}>;

/**
 * Renders the Studio home control surface for the current local production queue.
 *
 * @param actionStatus - Current guarded Studio action contract status.
 * @param runs - Persisted producer run summaries, newest first.
 * @returns The first-screen operator control desk.
 */
export function StudioControlDesk({ actionStatus, runs }: StudioControlDeskProps) {
  const latestRun = runs[0] ?? null;
  return (
    <section className='control-desk' aria-labelledby='control-desk-heading'>
      <div className='control-desk-primary'>
        <div className='control-desk-heading'>
          <div>
            <p className='eyebrow'>Operator control desk</p>
            <h2 id='control-desk-heading'>Current production queue</h2>
          </div>
          <Link className='status-pill small' href='/runs'>
            Open all runs
          </Link>
        </div>

        {latestRun ? <ActiveRunCard run={latestRun} /> : <EmptyRunCard />}
      </div>

      <aside className='control-desk-rail' aria-label='Studio safety and queue summary'>
        <StudioMutationSessionPanel />
        <SafetyGateSummary actionStatus={actionStatus} />
        <QueueSnapshot runs={runs} />
      </aside>
    </section>
  );
}

function ActiveRunCard({ run }: Readonly<{ run: StudioRunSummary }>) {
  const actionWorkbench = buildStudioActionWorkbench(run);
  const currentSteps = run.workflowProgress.filter((step) =>
    ["blocked", "current"].includes(step.status),
  );
  const visibleCurrentSteps = currentSteps.slice(0, 4);
  const hiddenCurrentStepCount = Math.max(0, currentSteps.length - visibleCurrentSteps.length);
  const completedSteps = run.workflowProgress.filter((step) => step.status === "done").length;

  return (
    <article className='active-run-card'>
      <div className='active-run-header'>
        <div>
          <p className='artifact-description'>Active run</p>
          <h3>{run.runId}</h3>
        </div>
        <ActiveRunActions run={run} />
      </div>

      <MetricGrid
        metrics={[
          { label: "State", value: run.state },
          { label: "Readiness", value: run.readinessStatus },
          { label: "Evidence", value: run.evidenceStatus },
          { label: "Render decision", value: formatRunRenderDecision(run) },
          { label: "Blocks", value: formatStudioInteger(run.blockedActionCount) },
          { label: "Progress", value: `${completedSteps}/${run.workflowProgress.length}` },
        ]}
      />

      <div className='operator-command-block'>
        <strong>Next safe action</strong>
        <CopyableCommand command={getNextSafeCommand(run)} label='Next safe action' />
      </div>

      <div className='active-run-action-summary'>
        <div>
          <strong>{actionWorkbench.primary.label}</strong>
          <span>{formatWorkbenchTone(actionWorkbench.primary.tone)}</span>
        </div>
        <p>{actionWorkbench.primary.description}</p>
        {actionWorkbench.primary.routePath ? (
          <span className='artifact-action'>Web route: {actionWorkbench.primary.routePath}</span>
        ) : null}
      </div>

      <ol className='workflow-strip' aria-label='Current workflow attention'>
        {visibleCurrentSteps.length > 0 ? (
          visibleCurrentSteps.map((step) => (
            <li className={`workflow-chip workflow-chip-${step.status}`} key={step.label}>
              <strong>{step.label}</strong>
              <span>{step.detail}</span>
            </li>
          ))
        ) : (
          <li className='workflow-chip workflow-chip-pending'>
            <strong>No active blocker</strong>
            <span>Review the run detail before the next irreversible action.</span>
          </li>
        )}
        {hiddenCurrentStepCount > 0 ? (
          <li className='workflow-chip workflow-chip-more'>
            <strong>+{hiddenCurrentStepCount} more</strong>
            <span>Open the run detail for the full list.</span>
          </li>
        ) : null}
      </ol>

      <p className='artifact-description'>{formatRunReviewCounts(run)}</p>
    </article>
  );
}

function formatWorkbenchTone(tone: StudioActionWorkbenchTone): string {
  switch (tone) {
    case "attention":
      return "attention";
    case "available":
      return "web action";
    case "blocked":
      return "blocked";
    case "cli-only":
      return "CLI";
    case "complete":
      return "complete";
  }
}

function EmptyRunCard() {
  return (
    <article className='active-run-card'>
      <h3>No local runs yet</h3>
      <p>
        Start with a safe local idea run. Studio will show the persisted run queue, evidence,
        readiness, and guarded approval actions once CLI/core creates the run.
      </p>
      <div className='operator-command-block'>
        <strong>Next safe action</strong>
        <CopyableCommand command={NO_RUNS_NEXT_COMMAND} label='Next safe action' />
      </div>
    </article>
  );
}

function SafetyGateSummary({
  actionStatus,
}: Readonly<{ actionStatus: StudioActionServiceStatus }>) {
  const findingTone = actionStatus.findings.length > 0 ? "blocked" : undefined;

  return (
    <section className='panel compact-panel' aria-labelledby='safety-gates-heading'>
      <h3 id='safety-gates-heading'>Safety gates</h3>
      <dl className='decision-list'>
        <div>
          <dt>Web actions</dt>
          <dd>{actionStatus.webMutationsEnabled ? "Guarded local routes" : "Disabled"}</dd>
        </div>
        <div>
          <dt>Upload / publish</dt>
          <dd className='blocked'>Disabled by default</dd>
        </div>
        <div>
          <dt>Route findings</dt>
          <dd className={findingTone}>{actionStatus.findings.length}</dd>
        </div>
        <div>
          <dt>CLI-ready contracts</dt>
          <dd>{actionStatus.readyForCliCount}</dd>
        </div>
      </dl>
    </section>
  );
}

function QueueSnapshot({ runs }: Readonly<{ runs: readonly StudioRunSummary[] }>) {
  return (
    <section className='panel compact-panel' aria-labelledby='queue-snapshot-heading'>
      <h3 id='queue-snapshot-heading'>Queue snapshot</h3>
      {runs.length > 0 ? (
        <ol className='queue-list'>
          {runs.slice(0, 5).map((run) => (
            <li key={run.runId}>
              <Link href={runReviewHrefFromSummary(run) as Route}>
                <strong>{run.runId}</strong>
                <span>
                  {run.state} · {run.readinessStatus}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <p>No persisted runs found.</p>
      )}
    </section>
  );
}
