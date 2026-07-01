import Link from "next/link";
import type { StudioRunSummary } from "@/lib/runSummaries";
import {
  formatRunChannelHandoff,
  formatRunChannelHandoffDecision,
  formatRunFinalReviewBundle,
  formatRunRenderDecision,
  formatRunReviewCounts,
} from "@/lib/runSummaryCopy";

type RunSummaryTableProps = Readonly<{ runs: readonly StudioRunSummary[] }>;

/**
 * Displays a summary table of saved producer runs.
 *
 * @param runs - The runs to display
 */
export function RunSummaryTable({ runs }: RunSummaryTableProps) {
  if (runs.length === 0) {
    return (
      <section className='panel' aria-labelledby='runs-empty-heading'>
        <h2 id='runs-empty-heading'>No runs yet</h2>
        <p>Start with the CLI source of truth: pnpm producer ideas.</p>
      </section>
    );
  }

  return (
    <section className='panel' aria-labelledby='runs-index-heading'>
      <h2 id='runs-index-heading'>Run Index</h2>
      <div className='run-table' role='table' aria-label='Saved producer runs'>
        <div className='run-row run-row-head' role='row'>
          <span role='columnheader'>Run</span>
          <span role='columnheader'>State</span>
          <span role='columnheader'>Readiness</span>
          <span role='columnheader'>Evidence</span>
          <span role='columnheader'>Render decision</span>
          <span role='columnheader'>Final bundle</span>
          <span role='columnheader'>Channel handoff</span>
          <span role='columnheader'>Next action</span>
        </div>
        {runs.map((run) => (
          <Link className='run-row' href={`/runs/${run.runId}`} key={run.runId} role='row'>
            <span role='cell'>{run.runId}</span>
            <span className='run-cell-stack' role='cell'>
              <strong>{run.state}</strong>
              <small>{formatRunReviewCounts(run)}</small>
            </span>
            <span className='run-cell-stack' role='cell'>
              <strong>{run.readinessStatus}</strong>
              {run.readinessStatus === "passed" ? null : <small>{run.readinessMessage}</small>}
              {run.readinessNextAction ? <small>{run.readinessNextAction}</small> : null}
            </span>
            <span className='run-cell-stack' role='cell'>
              <strong>{run.evidenceStatus}</strong>
              {run.evidenceStatus === "available" ? null : <small>{run.evidenceMessage}</small>}
            </span>
            <span className='run-cell-stack' role='cell'>
              <strong>{formatRunRenderDecision(run)}</strong>
              {run.renderDecision.kind === "present" ? (
                <small>{run.renderDecision.message}</small>
              ) : null}
            </span>
            <span className='run-cell-stack' role='cell'>
              <strong>{formatRunFinalReviewBundle(run)}</strong>
              {run.finalReviewBundle.kind === "present" ? (
                <small>{run.finalReviewBundle.reviewPath}</small>
              ) : null}
            </span>
            <span className='run-cell-stack' role='cell'>
              <strong>{formatRunChannelHandoff(run)}</strong>
              {run.channelHandoff.kind === "present" ? (
                <small>{run.channelHandoff.reviewPath}</small>
              ) : null}
              {run.channelHandoffDecision.kind === "present" ? (
                <small>{formatRunChannelHandoffDecision(run)}</small>
              ) : null}
            </span>
            <span role='cell'>{run.nextRecommendedCommand ?? "Generate evidence from CLI"}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
