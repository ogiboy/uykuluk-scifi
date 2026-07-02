import { CopyableCommand } from "@/components/studio/CopyableCommand";
import { getStudioActionServiceStatus } from "@/lib/actionServiceStatus";

/**
 * Displays the Studio mutation service contract status panel.
 *
 * @returns The rendered service contract status section.
 */
export function ServiceContractPanel() {
  const status = getStudioActionServiceStatus();
  const safetyLabel = status.webMutationsEnabled ? "Review required" : "Web mutations disabled";

  return (
    <section id='actions' aria-labelledby='actions-heading'>
      <h2 id='actions-heading'>Mutation Service Contracts</h2>
      <p>
        Studio exposes one guarded local render-decision route over the shared CLI/core contract.
        Approval, upload, and publish actions remain disabled or CLI-only.
      </p>
      <div className='status-grid'>
        <article className='status-card'>
          <p>Route Safety</p>
          <strong className={status.webMutationsEnabled ? "blocked" : undefined}>
            {safetyLabel}
          </strong>
          <p>{status.disabledRouteCount} future action routes remain disabled.</p>
        </article>
        <article className='status-card'>
          <p>CLI-ready Contracts</p>
          <strong>{status.readyForCliCount}</strong>
          <p>Approval and local review actions are bound to existing CLI/core functions.</p>
        </article>
        <article className='status-card'>
          <p>External Risk</p>
          <strong className='blocked'>{status.riskyExternalCount}</strong>
          <p>Upload and publish actions stay disabled and approval-gated.</p>
        </article>
        <article className='status-card'>
          <p>Contract Findings</p>
          <strong>{status.findings.length}</strong>
          <p>Route security findings must stay at zero before any additional mutation work.</p>
        </article>
      </div>
      <div className='command-grid'>
        {status.summaries.map((summary) => (
          <article className='panel' key={summary.actionId}>
            <h3>{summary.actionId}</h3>
            <CopyableCommand command={summary.cliCommand} label={`${summary.actionId} command`} />
            <p>{summary.description}</p>
            <p>
              Route: <code>{summary.routePath}</code> · {summary.availability}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
