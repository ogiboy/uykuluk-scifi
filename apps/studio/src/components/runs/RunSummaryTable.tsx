import Link from "next/link";
import type { StudioRunSummary } from "@/lib/runSummaries";

export function RunSummaryTable({ runs }: { runs: StudioRunSummary[] }) {
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
          <span role='columnheader'>Next action</span>
        </div>
        {runs.map((run) => (
          <Link className='run-row' href={`/runs/${run.runId}`} key={run.runId} role='row'>
            <span role='cell'>{run.runId}</span>
            <span role='cell'>{run.state}</span>
            <span role='cell'>{formatReadiness(run.readinessPassed)}</span>
            <span role='cell'>{run.nextRecommendedCommand ?? "Generate evidence from CLI"}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function formatReadiness(value: boolean | null): string {
  if (value === true) {
    return "passed";
  }
  if (value === false) {
    return "blocked";
  }
  return "not generated";
}
