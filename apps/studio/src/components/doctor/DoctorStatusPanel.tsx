import { formatStudioInteger, MetricGrid } from "@/components/studio/MetricGrid";
import { CopyableCommand } from "@/components/studio/CopyableCommand";
import type { StudioDoctorOverview } from "@/lib/doctorOverview";

type DoctorStatusPanelProps = Readonly<{
  overview: StudioDoctorOverview;
}>;

/**
 * Renders a compact read-only producer doctor summary for the Studio home page.
 *
 * @param overview - Producer doctor overview data.
 * @returns The home-page doctor summary panel.
 */
export function DoctorStatusPanel({ overview }: DoctorStatusPanelProps) {
  return (
    <section className='panel' aria-labelledby='doctor-status-heading'>
      <div className='artifact-preview-header'>
        <div>
          <h2 id='doctor-status-heading'>Doctor Diagnostics</h2>
          <p className='artifact-description'>
            Read-only local health snapshot. Studio does not run doctor or mutate config.
          </p>
        </div>
        <a className='status-pill small' href='/doctor'>
          Open doctor
        </a>
      </div>
      <MetricGrid
        metrics={[
          { label: "Status", value: overview.status },
          { label: "Checks", value: formatStudioInteger(overview.checkCount) },
          { label: "Blocks", value: formatStudioInteger(overview.blockCount) },
          { label: "Warnings", value: formatStudioInteger(overview.warnCount) },
        ]}
      />
      <div className='artifact-action'>
        <strong>Next safe action</strong>
        <CopyableCommand command={overview.nextAction} label='Doctor command' />
      </div>
      {overview.error ? <p className='blocked'>{overview.error}</p> : null}
    </section>
  );
}
