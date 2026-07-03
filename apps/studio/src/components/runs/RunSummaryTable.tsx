import Link from "next/link";
import type { StudioRunSummary } from "@/lib/runSummaries";
import {
  formatRunChannelHandoff,
  formatRunChannelHandoffDecision,
  formatRunFinalReviewBundle,
  formatRunRenderDecision,
  formatRunReviewCounts,
} from "@/lib/runSummaryCopy";
import type { RunQueueDensity } from "@/lib/runQueueWorkbench";

type RunSummaryTableProps = Readonly<{
  density?: RunQueueDensity;
  runs: readonly StudioRunSummary[];
}>;

/**
 * Displays a summary table of saved producer runs.
 *
 * @param density - The operator-selected table density.
 * @param runs - The runs to display
 */
export function RunSummaryTable({ density = "comfortable", runs }: RunSummaryTableProps) {
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
      <div className='run-table-scroll'>
        <table className='run-table' data-density={density}>
          <caption className='sr-only'>Saved producer runs and their next safe actions</caption>
          <colgroup>
            <col className='run-col-id' />
            <col className='run-col-state' />
            <col className='run-col-status' />
            <col className='run-col-status' />
            <col className='run-col-review' />
            <col className='run-col-review' />
            <col className='run-col-review' />
            <col className='run-col-action' />
          </colgroup>
          <thead>
            <tr className='run-row run-row-head'>
              <th scope='col'>Run</th>
              <th scope='col'>State</th>
              <th scope='col'>Readiness</th>
              <th scope='col'>Evidence</th>
              <th scope='col'>Render decision</th>
              <th scope='col'>Final bundle</th>
              <th scope='col'>Channel handoff</th>
              <th scope='col'>Next action</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr className='run-row' key={run.runId}>
                <th data-label='Run' scope='row'>
                  <Link className='run-row-link' href={`/runs/${run.runId}`}>
                    {run.runId}
                  </Link>
                </th>
                <td className='run-cell-stack' data-label='State'>
                  <strong>{run.state}</strong>
                  <small>{formatRunReviewCounts(run)}</small>
                </td>
                <td className='run-cell-stack' data-label='Readiness'>
                  <strong>{run.readinessStatus}</strong>
                  {run.readinessStatus === "passed" ? null : <small>{run.readinessMessage}</small>}
                  {run.readinessNextAction ? <small>{run.readinessNextAction}</small> : null}
                </td>
                <td className='run-cell-stack' data-label='Evidence'>
                  <strong>{run.evidenceStatus}</strong>
                  {run.evidenceStatus === "available" ? null : <small>{run.evidenceMessage}</small>}
                </td>
                <td className='run-cell-stack' data-label='Render decision'>
                  <strong>{formatRunRenderDecision(run)}</strong>
                  {run.renderDecision.kind === "present" ? (
                    <small>{run.renderDecision.message}</small>
                  ) : null}
                </td>
                <td className='run-cell-stack' data-label='Final bundle'>
                  <strong>{formatRunFinalReviewBundle(run)}</strong>
                  {run.finalReviewBundle.kind === "present" ? (
                    <small>{run.finalReviewBundle.reviewPath}</small>
                  ) : null}
                </td>
                <td className='run-cell-stack' data-label='Channel handoff'>
                  <strong>{formatRunChannelHandoff(run)}</strong>
                  {run.channelHandoff.kind === "present" ? (
                    <small>{run.channelHandoff.reviewPath}</small>
                  ) : null}
                  {run.channelHandoffDecision.kind === "present" ? (
                    <small>{formatRunChannelHandoffDecision(run)}</small>
                  ) : null}
                </td>
                <td data-label='Next action'>
                  {run.nextRecommendedCommand ?? "Generate evidence from CLI"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
