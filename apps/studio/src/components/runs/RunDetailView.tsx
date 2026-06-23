import type { StudioRunDetail } from "@/lib/runSummaries";

export function RunDetailView({ run }: { run: StudioRunDetail }) {
  return (
    <div className='run-detail-grid'>
      <section className='panel' aria-labelledby='run-overview-heading'>
        <h2 id='run-overview-heading'>Run Overview</h2>
        <dl className='run-metadata'>
          <div>
            <dt>State</dt>
            <dd>{run.state}</dd>
          </div>
          <div>
            <dt>Approvals</dt>
            <dd>{run.approvalCount}</dd>
          </div>
          <div>
            <dt>Warnings</dt>
            <dd>{run.warningCount}</dd>
          </div>
          <div>
            <dt>Readiness</dt>
            <dd>
              {run.readinessPassed === true
                ? "passed"
                : run.readinessPassed === false
                  ? "blocked"
                  : "not generated"}
            </dd>
          </div>
        </dl>
      </section>

      <section className='panel' aria-labelledby='next-action-heading'>
        <h2 id='next-action-heading'>Next Safe Action</h2>
        <code className='command'>
          {run.nextRecommendedCommand ?? "Run pnpm producer evidence --run <run_id>"}
        </code>
        <p>
          Read-only display. Use the CLI to mutate approvals, artifacts, render, upload, or publish
          state.
        </p>
      </section>

      <section className='panel' aria-labelledby='artifact-heading'>
        <h2 id='artifact-heading'>Review Artifacts</h2>
        <ul className='artifact-list'>
          {run.artifacts.map((artifact) => (
            <li key={artifact.path}>
              <span>{artifact.path}</span>
              <strong className={artifact.exists ? undefined : "blocked"}>
                {artifact.exists ? "available" : "missing"}
              </strong>
            </li>
          ))}
        </ul>
      </section>

      <section className='panel' aria-labelledby='readiness-heading'>
        <h2 id='readiness-heading'>Readiness Checks</h2>
        <p>
          {run.readiness?.passed === true ? "Readiness passed." : "Readiness has not passed yet."}
        </p>
        <p>
          {Array.isArray(run.readiness?.checks)
            ? `${run.readiness.checks.length} check(s) recorded.`
            : "No readiness checks recorded."}
        </p>
      </section>
    </div>
  );
}
