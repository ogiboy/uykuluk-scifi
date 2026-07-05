"use client";

import Link from "next/link";
import type { Route } from "next";
import { Badge } from "@/components/ui/badge";
import { RunQuickStageActionButton } from "@/components/runs/RunQuickStageActionButton";
import {
  operatorActionDetail,
  operatorActionForRun,
  operatorActionToneLabel,
  type OperatorAction,
} from "@/components/runs/runSummaryOperatorAction";
import { homeActionQueueSummaryItems } from "@/lib/homeActionQueueSummary";
import { runReviewHrefFromSummary } from "@/lib/runReviewNavigation";
import type { StudioRunSummary } from "@/lib/runSummaries";

type HomeActionQueuePanelProps = Readonly<{
  runs: readonly StudioRunSummary[];
}>;

/**
 * Renders a compact action-prioritized queue for the Studio home rail.
 *
 * @param runs - Persisted local run summaries, newest first.
 * @returns A prioritized operator queue for the next safe web or detail action.
 */
export function HomeActionQueuePanel({ runs }: HomeActionQueuePanelProps) {
  return (
    <section className='panel compact-panel' aria-labelledby='home-action-queue-heading'>
      <div className='artifact-preview-header'>
        <div>
          <h3 id='home-action-queue-heading'>Action queue</h3>
          <p className='artifact-description'>Prioritized from persisted CLI/core run summaries.</p>
        </div>
        <Link className='status-pill small' href='/runs'>
          All runs
        </Link>
      </div>
      {runs.length > 0 ? (
        <>
          <HomeActionQueueSummary runs={runs} />
          <HomeActionQueueList runs={runs} />
        </>
      ) : (
        <p>No persisted runs found.</p>
      )}
    </section>
  );
}

function HomeActionQueueSummary({ runs }: HomeActionQueuePanelProps) {
  return (
    <dl className='home-action-queue-summary' aria-label='Home action queue summary'>
      {homeActionQueueSummaryItems(runs).map((item) => (
        <div key={item.key} data-tone={item.tone}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
          <small>{item.detail}</small>
        </div>
      ))}
    </dl>
  );
}

function HomeActionQueueList({ runs }: HomeActionQueuePanelProps) {
  return (
    <ol className='home-action-queue-list'>
      {prioritizedActionRuns(runs)
        .slice(0, 5)
        .map(({ action, run }) => (
          <li key={run.runId}>
            <div className='home-action-queue-item'>
              <div className='home-action-queue-copy'>
                <Link href={runReviewHrefFromSummary(run) as Route}>
                  <strong>{run.runId}</strong>
                </Link>
                <span>
                  {run.state} · {operatorActionDetail(action)}
                </span>
                <small>{action.label}</small>
              </div>
              <div className='home-action-queue-controls'>
                <Badge variant={action.tone === "blocked" ? "destructive" : "secondary"}>
                  {operatorActionToneLabel(action)}
                </Badge>
                <RunQuickStageActionButton label={action.label} run={run} variant='secondary' />
                <Link
                  className='home-action-queue-open'
                  href={runReviewHrefFromSummary(run, "review-decision") as Route}
                >
                  Open
                </Link>
              </div>
            </div>
          </li>
        ))}
    </ol>
  );
}

function prioritizedActionRuns(runs: readonly StudioRunSummary[]) {
  return runs
    .map((run) => ({
      action: operatorActionForRun(run),
      run,
    }))
    .sort(
      (left, right) =>
        actionTonePriority(left.action) - actionTonePriority(right.action) ||
        right.run.updatedAt.localeCompare(left.run.updatedAt),
    );
}

function actionTonePriority(action: OperatorAction): number {
  switch (action.tone) {
    case "available":
      return 0;
    case "blocked":
      return 1;
    case "attention":
    case "cli-only":
      return 2;
    case "complete":
      return 3;
  }
}
