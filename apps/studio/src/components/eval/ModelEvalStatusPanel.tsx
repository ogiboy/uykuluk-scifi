import Link from "next/link";

import { formatStudioInteger, MetricGrid } from "@/components/studio/MetricGrid";
import { CliFallbackCommand } from "@/components/studio/CliFallbackCommand";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    <section aria-labelledby='model-eval-status-heading'>
      <Card>
        <CardHeader className='gap-4 sm:grid-cols-[1fr_auto]'>
          <div className='space-y-2'>
            <CardTitle id='model-eval-status-heading'>Local Model Evaluation</CardTitle>
            <CardDescription>
              Read-only parser-contract evidence. Studio does not call local models or mutate
              config.
            </CardDescription>
          </div>
          <Link className={buttonVariants({ variant: "secondary" })} href='/eval'>
            Open eval
          </Link>
        </CardHeader>
        <CardContent className='space-y-4'>
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
          <div className='space-y-3 rounded-xl bg-muted/25 p-3'>
            <strong className='text-sm'>Next safe action</strong>
            <CliFallbackCommand
              align='start'
              command={overview.nextCommand}
              label='Model eval command'
              triggerLabel='Show eval fallback'
            />
          </div>
          {overview.error ? <p className='text-sm text-destructive'>{overview.error}</p> : null}
        </CardContent>
      </Card>
    </section>
  );
}
