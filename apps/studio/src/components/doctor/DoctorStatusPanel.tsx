import Link from "next/link";

import { formatStudioInteger, MetricGrid } from "@/components/studio/MetricGrid";
import { CliFallbackCommand } from "@/components/studio/CliFallbackCommand";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    <section aria-labelledby='doctor-status-heading'>
      <Card>
        <CardHeader className='gap-4 sm:grid-cols-[1fr_auto]'>
          <div className='space-y-2'>
            <CardTitle id='doctor-status-heading'>Doctor Diagnostics</CardTitle>
            <CardDescription>
              Local health snapshot with guarded refresh. Studio does not mutate config.
            </CardDescription>
          </div>
          <Link className={buttonVariants({ variant: "secondary" })} href='/doctor'>
            Open doctor
          </Link>
        </CardHeader>
        <CardContent className='space-y-4'>
          <MetricGrid
            metrics={[
              { label: "Status", value: overview.status },
              { label: "Checks", value: formatStudioInteger(overview.checkCount) },
              { label: "Blocks", value: formatStudioInteger(overview.blockCount) },
              { label: "Warnings", value: formatStudioInteger(overview.warnCount) },
            ]}
          />
          <div className='space-y-3 rounded-xl bg-muted/25 p-3'>
            <strong className='text-sm'>Next safe action</strong>
            <DoctorRunActionPanel compact />
            <CliFallbackCommand
              align='start'
              command={overview.nextAction}
              label='Doctor command'
              triggerLabel='Show doctor fallback'
            />
          </div>
          {overview.error ? <p className='text-sm text-destructive'>{overview.error}</p> : null}
        </CardContent>
      </Card>
    </section>
  );
}
