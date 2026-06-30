import type { StudioRunDetail } from "@/lib/runSummaries";
import type { StudioArtifactPreview } from "@/lib/artifactPreviews";
import { artifactPreviewsIntro } from "@/lib/runEvidenceCopy";
import { RunBlockedActionsPanel } from "./RunBlockedActionsPanel";
import { RunLedgerPanel } from "./RunLedgerPanel";
import { RunProductionMediaPanel } from "./RunProductionMediaPanel";
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
  const artifactGroups = groupedArtifactPreviews(run.artifacts);

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
        <p>Read-only display. Use the CLI for approvals, artifacts, render, upload, or publish.</p>
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

      <RunRenderDecisionCommandsPanel commands={run.renderDecisionCommands} />

      <section className='panel' aria-labelledby='artifact-heading'>
        <h2 id='artifact-heading'>Artifact Previews</h2>
        <p>
          Read-only excerpts grouped by operator review phase. Use CLI commands to change workflow
          state.
        </p>
        <p>{artifactPreviewsIntro(run.evidenceStatus)}</p>
        <div className='artifact-preview-groups'>
          {artifactGroups.map((group) => (
            <section className='artifact-preview-group' key={group.label}>
              <h3>{group.label}</h3>
              <ul className='artifact-preview-list'>
                {group.artifacts.map((artifact) => (
                  <li className='artifact-preview-card' key={artifact.path}>
                    <div className='artifact-preview-header'>
                      <div>
                        <strong>{artifact.label}</strong>
                        <span>{artifact.path}</span>
                      </div>
                      <span
                        className={
                          artifact.exists ? "status-pill small" : "status-pill small blocked"
                        }
                      >
                        {artifact.exists ? "available" : "missing"}
                      </span>
                    </div>
                    <p className='artifact-description'>{artifact.description}</p>
                    <p className='artifact-meta'>
                      {artifact.kind}
                      {typeof artifact.sizeBytes === "number"
                        ? ` · ${artifact.sizeBytes} bytes`
                        : ""}
                      {artifact.previewTruncated ? " · preview truncated" : ""}
                    </p>
                    {artifact.preview ? (
                      <pre className='artifact-preview'>{artifact.preview}</pre>
                    ) : (
                      <p>{artifactPreviewFallback(artifact)}</p>
                    )}
                    <p className='artifact-action'>{artifact.operatorAction}</p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </section>

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

/**
 * Groups artifact previews by group label.
 *
 * @param artifacts - The artifact previews to group.
 * @returns The grouped artifact previews, ordered by first occurrence of each group.
 */
function groupedArtifactPreviews(
  artifacts: StudioArtifactPreview[],
): Array<{ artifacts: StudioArtifactPreview[]; label: string }> {
  const groups = new Map<string, StudioArtifactPreview[]>();
  for (const artifact of artifacts) {
    groups.set(artifact.group, [...(groups.get(artifact.group) ?? []), artifact]);
  }
  return [...groups.entries()].map(([label, groupedArtifacts]) => ({
    artifacts: groupedArtifacts,
    label,
  }));
}

/**
 * Provides a fallback message for an artifact preview.
 *
 * @param artifact - The artifact preview metadata
 * @returns A message explaining why the preview is unavailable
 */
function artifactPreviewFallback(artifact: StudioArtifactPreview): string {
  if (!artifact.exists) {
    return "Artifact is not generated yet.";
  }
  if (artifact.kind === "binary") {
    return "Binary or media artifact. Preview is intentionally limited to metadata.";
  }
  return "Text preview is unavailable; inspect the artifact from the CLI.";
}
