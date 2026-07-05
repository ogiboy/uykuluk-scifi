import Link from "next/link";

import { formatStudioInteger, MetricGrid } from "@/components/studio/MetricGrid";
import { CopyableCommand } from "@/components/studio/CopyableCommand";
import type { StudioDoctorOverview } from "@/lib/doctorOverview";
import { DoctorRunActionPanel } from "./DoctorRunActionPanel";

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
            Local health snapshot with guarded refresh. Studio does not mutate config.
          </p>
        </div>
        <Link className='status-pill small' href='/doctor'>
          Open doctor
        </Link>
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
        <DoctorRunActionPanel compact />
        <CopyableCommand command={overview.nextAction} label='Doctor command' />
      </div>
      {overview.error ? <p className='blocked'>{overview.error}</p> : null}
    </section>
  );
}
