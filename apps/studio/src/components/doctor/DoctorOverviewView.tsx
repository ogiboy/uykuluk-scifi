import type {
  StudioDoctorCheckSummary,
  StudioDoctorOverview,
  StudioDoctorStatus,
} from "@/lib/doctorOverview";
import { ArtifactPreview } from "@/components/studio/ArtifactPreview";
import { CopyableCommand } from "@/components/studio/CopyableCommand";
import { formatStudioInteger, MetricGrid } from "@/components/studio/MetricGrid";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DoctorRunActionPanel } from "./DoctorRunActionPanel";

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
    <div className='grid gap-4 lg:grid-cols-2'>
      <section aria-labelledby='doctor-overview-heading'>
        <Card>
          <CardHeader>
            <h2 className='text-xl font-semibold tracking-tight' id='doctor-overview-heading'>
              Doctor Overview
            </h2>
          </CardHeader>
          <CardContent>
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
                  value:
                    overview.durationMs === null ? "not generated" : `${overview.durationMs} ms`,
                },
                { label: "Source", value: overview.jsonPath },
              ]}
            />
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby='doctor-action-heading'>
        <Card>
          <CardHeader>
            <h2 className='text-xl font-semibold tracking-tight' id='doctor-action-heading'>
              Next Safe Action
            </h2>
          </CardHeader>
          <CardContent className='space-y-4'>
            <DoctorRunActionPanel />
            <CopyableCommand command={overview.nextAction} label='Doctor command' />
            <p className='text-sm text-muted-foreground'>
              Studio can refresh local doctor artifacts through the guarded CLI route. It does not
              edit config, start providers, download models, upload media, publish content, or
              mutate run workflow state outside the canonical doctor command.
            </p>
            {overview.error ? <p className='text-sm text-destructive'>{overview.error}</p> : null}
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby='doctor-checks-heading'>
        <Card>
          <CardHeader>
            <h2 className='text-xl font-semibold tracking-tight' id='doctor-checks-heading'>
              Doctor Checks
            </h2>
          </CardHeader>
          <CardContent>
            {overview.checks.length > 0 ? (
              <ul className='grid gap-3'>
                {overview.checks.map((check, index) => (
                  <DoctorCheckCard check={check} key={`${check.name}-${index}`} />
                ))}
              </ul>
            ) : (
              <p className='text-sm text-muted-foreground'>
                Run doctor from Studio or CLI to generate local diagnostics.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby='doctor-report-heading'>
        <Card>
          <CardHeader>
            <h2 className='text-xl font-semibold tracking-tight' id='doctor-report-heading'>
              Report Preview
            </h2>
          </CardHeader>
          <CardContent className='space-y-3'>
            <p className='text-xs text-muted-foreground'>
              {overview.markdownPath}
              {overview.reportPreviewTruncated ? " · preview truncated" : ""}
            </p>
            {overview.reportPreview ? (
              <ArtifactPreview>{overview.reportPreview}</ArtifactPreview>
            ) : (
              <p className='text-sm text-muted-foreground'>
                Run doctor from Studio or CLI to refresh the local Markdown report artifact.
              </p>
            )}
          </CardContent>
        </Card>
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
    <li className='grid gap-3 rounded-lg border bg-muted/20 p-3'>
      <div className='grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start'>
        <div className='min-w-0 space-y-1'>
          <strong>{check.name}</strong>
          <span className='block text-sm text-muted-foreground'>{check.message}</span>
        </div>
        <Badge variant={doctorStatusBadgeVariant(check.status)}>{check.status}</Badge>
      </div>
      {check.nextAction ? (
        <p className='rounded-lg border bg-background p-3 text-sm text-muted-foreground'>
          {check.nextAction}
        </p>
      ) : null}
    </li>
  );
}

/**
 * Selects the shadcn badge variant for a doctor check.
 *
 * @param status - The doctor check status.
 * @returns The badge variant for the status.
 */
function doctorStatusBadgeVariant(
  status: StudioDoctorStatus | StudioDoctorCheckSummary["status"],
): "destructive" | "secondary" {
  switch (status) {
    case "block":
    case "blocked":
    case "invalid":
      return "destructive";
    case "warn":
    case "warning":
    case "missing":
    case "pass":
    case "passing":
      return "secondary";
  }
}
