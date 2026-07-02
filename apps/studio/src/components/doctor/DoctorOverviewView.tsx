import type {
  StudioDoctorCheckSummary,
  StudioDoctorOverview,
  StudioDoctorStatus,
} from "@/lib/doctorOverview";
import { CopyableCommand } from "@/components/studio/CopyableCommand";
import { formatStudioInteger, MetricGrid } from "@/components/studio/MetricGrid";

type DoctorOverviewViewProps = Readonly<{
  overview: StudioDoctorOverview;
}>;

/**
 * Renders the read-only producer doctor diagnostics overview.
 *
 * @param overview - Doctor diagnostics data for the operator surface.
 * @returns The producer doctor diagnostics layout.
 */
export function DoctorOverviewView({ overview }: DoctorOverviewViewProps) {
  return (
    <div className='analytics-detail-grid'>
      <section className='panel' aria-labelledby='doctor-overview-heading'>
        <h2 id='doctor-overview-heading'>Doctor Overview</h2>
        <MetricGrid
          metrics={[
            { label: "Status", value: overview.status },
            { label: "Checks", value: formatStudioInteger(overview.checkCount) },
            { label: "Passing", value: formatStudioInteger(overview.passCount) },
            { label: "Warnings", value: formatStudioInteger(overview.warnCount) },
            { label: "Blocks", value: formatStudioInteger(overview.blockCount) },
            { label: "Generated", value: overview.createdAt ?? "not generated" },
            {
              label: "Duration",
              value: overview.durationMs === null ? "not generated" : `${overview.durationMs} ms`,
            },
            { label: "Source", value: overview.jsonPath },
          ]}
        />
      </section>

      <section className='panel' aria-labelledby='doctor-action-heading'>
        <h2 id='doctor-action-heading'>Next Safe Action</h2>
        <CopyableCommand command={overview.nextAction} label='Doctor command' />
        <p>
          Read-only display from local diagnostics artifacts. Studio does not run doctor, edit
          config, start providers, download models, upload media, publish content, or mutate
          workflow state.
        </p>
        {overview.error ? <p className='blocked'>{overview.error}</p> : null}
      </section>

      <section className='panel' aria-labelledby='doctor-checks-heading'>
        <h2 id='doctor-checks-heading'>Doctor Checks</h2>
        {overview.checks.length > 0 ? (
          <ul className='artifact-preview-list'>
            {overview.checks.map((check, index) => (
              <DoctorCheckCard check={check} key={`${check.name}-${index}`} />
            ))}
          </ul>
        ) : (
          <p>Run the CLI doctor command to generate local diagnostics.</p>
        )}
      </section>

      <section className='panel' aria-labelledby='doctor-report-heading'>
        <h2 id='doctor-report-heading'>Report Preview</h2>
        <p className='artifact-meta'>
          {overview.markdownPath}
          {overview.reportPreviewTruncated ? " · preview truncated" : ""}
        </p>
        {overview.reportPreview ? (
          <pre className='artifact-preview'>{overview.reportPreview}</pre>
        ) : (
          <p>Run the CLI doctor command to refresh the local Markdown report artifact.</p>
        )}
      </section>
    </div>
  );
}

/**
 * Renders a single producer doctor check.
 *
 * @param check - Doctor check summary to display.
 * @returns The rendered check card.
 */
function DoctorCheckCard({ check }: Readonly<{ check: StudioDoctorCheckSummary }>) {
  return (
    <li className='artifact-preview-card'>
      <div className='artifact-preview-header'>
        <div>
          <strong>{check.name}</strong>
          <span>{check.message}</span>
        </div>
        <span className={doctorStatusClassName(check.status)}>{check.status}</span>
      </div>
      {check.nextAction ? <p className='artifact-action'>{check.nextAction}</p> : null}
    </li>
  );
}

/**
 * Selects the status pill class for a doctor check.
 *
 * @param status - The doctor check status.
 * @returns A CSS class list for the status pill.
 */
function doctorStatusClassName(
  status: StudioDoctorStatus | StudioDoctorCheckSummary["status"],
): string {
  switch (status) {
    case "block":
    case "blocked":
    case "invalid":
      return "status-pill small blocked";
    case "warn":
    case "warning":
      return "status-pill small";
    case "missing":
    case "pass":
    case "passing":
      return "status-pill small";
  }
}
