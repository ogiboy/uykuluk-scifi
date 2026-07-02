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
import { StudioMutationSessionPanel } from "../studio/StudioMutationSessionPanel";

/**
 * Renders a read-only detail view for a run.
 *
 * @param run - The run data to display.
 */
export function RunDetailView({ run }: Readonly<{ run: StudioRunDetail }>) {
  return (
    <div className='run-review-page'>
      <section className='run-detail-hero' aria-labelledby='run-overview-heading'>
        <div>
          <p className='eyebrow'>Run review workspace</p>
          <h2 id='run-overview-heading'>Run Overview</h2>
        </div>
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
        <div className='operator-command-block'>
          <strong>Next safe action</strong>
          <code className='command'>
            {run.nextRecommendedCommand ?? `pnpm producer evidence --run ${run.runId}`}
          </code>
          <p>
            Studio can record guarded local approvals where route security is enabled. Generation,
            artifact creation, upload, and publish stay with CLI/core gates.
          </p>
        </div>
      </section>

      <nav className='review-section-tabs' aria-label='Run review sections'>
        <a href='#review-progress'>Progress</a>
        <a href='#review-media'>Media</a>
        <a href='#review-artifacts'>Artifacts</a>
        <a href='#review-handoff'>Handoff</a>
        <a href='#review-readiness'>Readiness</a>
        <a href='#review-actions'>Actions</a>
      </nav>

      <div className='run-review-workspace'>
        <main className='run-review-main' aria-label='Run evidence and artifacts'>
          <div id='review-progress' className='review-section'>
            <RunWorkflowProgressPanel workflowProgress={run.workflowProgress} />
          </div>
          <div id='review-media' className='review-section'>
            <RunProductionMediaPanel
              evidenceMessage={run.evidenceMessage}
              evidenceNextAction={run.evidenceNextAction}
              evidenceStatus={run.evidenceStatus}
              productionMedia={run.productionMedia}
            />
          </div>
          <div id='review-artifacts' className='review-section'>
            <RunArtifactPreviewsPanel
              artifacts={run.artifacts}
              evidenceStatus={run.evidenceStatus}
            />
          </div>
          <div id='review-handoff' className='review-section'>
            <RunFinalReviewBundlePanel finalReviewBundle={run.finalReviewBundle} />
            <RunChannelHandoffPanel channelHandoff={run.channelHandoff} />
          </div>
          <div id='review-readiness' className='review-section'>
            <ReadinessChecksPanel run={run} />
            <RunLedgerPanel approvals={run.approvals} warnings={run.warnings} />
            <DiagnosticsPanel run={run} />
          </div>
        </main>

        <aside
          id='review-actions'
          className='run-review-rail review-section'
          aria-label='Run decisions and blocked actions'
        >
          <StudioMutationSessionPanel />
          <RunBlockedActionsPanel
            blockedActions={run.blockedActions}
            evidenceMessage={run.evidenceMessage}
            evidenceNextAction={run.evidenceNextAction}
            evidenceStatus={run.evidenceStatus}
          />
          <RunApprovalActionPanel run={run} />
          <RunRenderDecisionStatusPanel renderDecision={run.renderDecision} />
          <RunRenderDecisionActionPanel commands={run.renderDecisionCommands} runId={run.runId} />
          <RunRenderDecisionCommandsPanel commands={run.renderDecisionCommands} />
          <RunChannelHandoffDecisionPanel channelHandoffDecision={run.channelHandoffDecision} />
        </aside>
      </div>
    </div>
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
