import { formatStudioInteger, MetricGrid } from "@/components/studio/MetricGrid";
import { CopyableCommand } from "@/components/studio/CopyableCommand";
import type { StudioModelEvalOverview } from "@/lib/modelEvalOverview";

type ModelEvalStatusPanelProps = Readonly<{
  overview: StudioModelEvalOverview;
}>;

/**
 * Renders a compact read-only local model evaluation summary on the Studio home page.
 *
 * @param overview - Local model evaluation overview loaded from ignored diagnostics artifacts.
 * @returns A read-only model evaluation status panel.
 */
export function ModelEvalStatusPanel({ overview }: ModelEvalStatusPanelProps) {
  return (
    <section className='panel' aria-labelledby='model-eval-status-heading'>
      <div className='artifact-preview-header'>
        <div>
          <h2 id='model-eval-status-heading'>Local Model Evaluation</h2>
          <p className='artifact-description'>
            Read-only parser-contract evidence. Studio does not call local models or mutate config.
          </p>
        </div>
        <a className='status-pill small' href='/eval'>
          Open eval
        </a>
      </div>
      <MetricGrid
        metrics={[
          { label: "Status", value: overview.status },
          {
            label: "Single model",
            value: overview.singleReport?.configuredModel ?? "not evaluated",
          },
          {
            label: "Candidates",
            value: formatStudioInteger(overview.candidateReport?.candidateCount ?? 0),
          },
          {
            label: "Passing candidates",
            value: formatStudioInteger(overview.candidateReport?.passingCandidateCount ?? 0),
          },
        ]}
      />
      <div className='artifact-action'>
        <strong>Next safe action</strong>
        <CopyableCommand command={overview.nextCommand} label='Model eval command' />
      </div>
      {overview.error ? <p className='blocked'>{overview.error}</p> : null}
    </section>
  );
}
