import type { StudioRunDetail } from "@/lib/runSummaries";
import { RunLedgerPanel } from "./RunLedgerPanel";
import { readinessStatusClassName } from "./readinessStatusClassName";

type RunReadinessDiagnosticsPanelsProps = Readonly<{
  run: StudioRunDetail;
}>;

/**
 * Renders readiness, ledger, and diagnostic evidence for a run.
 *
 * @param run - The Studio run detail projection used for readiness review.
 */
export function RunReadinessDiagnosticsPanels({ run }: RunReadinessDiagnosticsPanelsProps) {
  return (
    <>
      <ReadinessChecksPanel run={run} />
      <RunLedgerPanel approvals={run.approvals} warnings={run.warnings} />
      <DiagnosticsPanel run={run} />
    </>
  );
}

function DiagnosticsPanel({ run }: Readonly<{ run: StudioRunDetail }>) {
  return (
    <section className='panel' aria-labelledby='diagnostics-heading'>
      <h2 id='diagnostics-heading'>Diagnostics</h2>
      {run.diagnostics.length > 0 ? (
        <ul>
          {run.diagnostics.map((diagnostic, index) => (
            <li key={`diagnostic-${index}-${diagnostic.path}`}>
              <strong>{diagnostic.stage}</strong>: {diagnostic.message}
              <br />
              <span>{diagnostic.path}</span>
              {diagnostic.nextAction ? (
                <>
                  <br />
                  <span>Next action: {diagnostic.nextAction}</span>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p>No run diagnostics recorded.</p>
      )}
    </section>
  );
}

function ReadinessChecksPanel({ run }: Readonly<{ run: StudioRunDetail }>) {
  return (
    <section className='panel' aria-labelledby='readiness-heading'>
      <h2 id='readiness-heading'>Readiness Checks</h2>
      <p>{run.readinessMessage}</p>
      {run.readinessNextAction ? (
        <p className='artifact-action'>Next action: {run.readinessNextAction}</p>
      ) : null}
      <p>
        {run.readinessChecks.length > 0
          ? `${run.readinessChecks.length} check(s) recorded.`
          : "No readiness checks recorded."}
      </p>
      {run.readinessChecks.length > 0 ? (
        <ul>
          {run.readinessChecks.map((check, index) => (
            <li key={`readiness-check-${index}-${check.name}`}>
              <strong>{check.name}</strong>:{" "}
              <span className={readinessStatusClassName(check.status)}>{check.status}</span>
              <br />
              <span>{check.message}</span>
              {check.nextAction ? (
                <p className='artifact-action'>Next action: {check.nextAction}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
