import type { StudioRunDetail } from "@/lib/runSummaries";
import { RunArtifactPreviewsPanel } from "./RunArtifactPreviewsPanel";
import { RunApprovalActionPanel } from "./RunApprovalActionPanel";
import { RunChannelHandoffDecisionPanel } from "./RunChannelHandoffDecisionPanel";
import { RunBlockedActionsPanel } from "./RunBlockedActionsPanel";
import { RunChannelHandoffPanel } from "./RunChannelHandoffPanel";
import { RunFinalReviewBundlePanel } from "./RunFinalReviewBundlePanel";
import { RunLedgerPanel } from "./RunLedgerPanel";
import { RunProductionMediaPanel } from "./RunProductionMediaPanel";
import { RunRenderDecisionActionPanel } from "./RunRenderDecisionActionPanel";
import { RunRenderDecisionCommandsPanel } from "./RunRenderDecisionCommandsPanel";
import { RunRenderDecisionStatusPanel } from "./RunRenderDecisionStatusPanel";
import { RunWorkflowProgressPanel } from "./RunWorkflowProgressPanel";
import { readinessStatusClassName } from "./readinessStatusClassName";

/**
 * Renders a read-only detail view for a run.
 *
 * @param run - The run data to display.
 */
export function RunDetailView({ run }: Readonly<{ run: StudioRunDetail }>) {
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
            <dd>{run.readinessStatus}</dd>
          </div>
          <div>
            <dt>Evidence</dt>
            <dd>{run.evidenceStatus}</dd>
          </div>
        </dl>
      </section>

      <section className='panel' aria-labelledby='next-action-heading'>
        <h2 id='next-action-heading'>Next Safe Action</h2>
        <code className='command'>
          {run.nextRecommendedCommand ?? `Run pnpm producer evidence --run ${run.runId}`}
        </code>
        <p>
          Studio can record guarded local approvals where route security is enabled. Use CLI/core
          commands for generation, artifacts, render execution, upload, and publish.
        </p>
        <p>Evidence: {run.evidenceMessage}</p>
        {run.evidenceNextAction ? (
          <p className='artifact-action'>Evidence action: {run.evidenceNextAction}</p>
        ) : null}
      </section>

      <RunBlockedActionsPanel
        blockedActions={run.blockedActions}
        evidenceMessage={run.evidenceMessage}
        evidenceNextAction={run.evidenceNextAction}
        evidenceStatus={run.evidenceStatus}
      />

      <RunApprovalActionPanel run={run} />

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

      <RunLedgerPanel approvals={run.approvals} warnings={run.warnings} />

      <RunProductionMediaPanel
        evidenceMessage={run.evidenceMessage}
        evidenceNextAction={run.evidenceNextAction}
        evidenceStatus={run.evidenceStatus}
        productionMedia={run.productionMedia}
      />

      <RunWorkflowProgressPanel workflowProgress={run.workflowProgress} />

      <RunRenderDecisionStatusPanel renderDecision={run.renderDecision} />
      <RunRenderDecisionActionPanel commands={run.renderDecisionCommands} runId={run.runId} />
      <RunRenderDecisionCommandsPanel commands={run.renderDecisionCommands} />
      <RunFinalReviewBundlePanel finalReviewBundle={run.finalReviewBundle} />
      <RunChannelHandoffPanel channelHandoff={run.channelHandoff} />
      <RunChannelHandoffDecisionPanel channelHandoffDecision={run.channelHandoffDecision} />

      <RunArtifactPreviewsPanel artifacts={run.artifacts} evidenceStatus={run.evidenceStatus} />

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
    </div>
  );
}
