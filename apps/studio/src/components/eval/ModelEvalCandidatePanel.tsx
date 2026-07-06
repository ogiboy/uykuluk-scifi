import { CliFallbackCommand } from "@/components/studio/CliFallbackCommand";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type {
  StudioCandidateEvalSummary,
  StudioModelEvalCheckSummary,
} from "@/lib/modelEvalOverview";

type ModelEvalCandidatePanelProps = Readonly<{
  candidateReport: StudioCandidateEvalSummary | null;
}>;

type ModelEvalCheckListProps = Readonly<{
  checks: StudioModelEvalCheckSummary[];
  ownerId: string;
}>;

/**
 * Renders the candidate model comparison panel from local evaluation artifacts.
 *
 * @param candidateReport - Parsed candidate comparison report, or null when unavailable.
 */
export function ModelEvalCandidatePanel({ candidateReport }: ModelEvalCandidatePanelProps) {
  return (
    <section aria-labelledby='model-eval-candidates-heading'>
      <Card>
        <CardHeader>
          <h2 className='text-xl font-semibold tracking-tight' id='model-eval-candidates-heading'>
            Candidate Results
          </h2>
        </CardHeader>
        <CardContent className='space-y-4'>
          {candidateReport ? (
            <>
              <p className='text-xs text-muted-foreground'>
                Recommended passing candidate:{" "}
                {candidateReport.recommendedCandidate?.configuredModel ?? "none yet"}
              </p>
              {candidateReport.operatorGuidance ? (
                <div className='grid gap-3 rounded-xl bg-muted/25 p-3'>
                  <p className='text-sm text-muted-foreground'>
                    {candidateReport.operatorGuidance.message}
                  </p>
                  <CliFallbackCommand
                    align='start'
                    command={candidateReport.operatorGuidance.nextCommand}
                    label='Candidate eval command'
                    triggerLabel='Show candidate eval fallback'
                  />
                </div>
              ) : null}
              <ul className='grid gap-3'>
                {candidateReport.candidates.map((candidate, index) => (
                  <li
                    className='grid min-w-0 gap-3 rounded-xl bg-muted/25 p-3'
                    key={`${candidate.configuredModel}-${index}`}
                  >
                    <div className='grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start'>
                      <div className='min-w-0 space-y-1'>
                        <strong className='break-all'>{candidate.configuredModel}</strong>
                        <span className='block text-sm text-muted-foreground'>
                          {candidate.passCount} passed · {candidate.blockCount} blocked checks ·{" "}
                          {candidate.durationMs}ms
                        </span>
                      </div>
                      <Badge variant={candidate.passed ? "secondary" : "destructive"}>
                        {candidate.passed ? "pass" : "block"}
                      </Badge>
                    </div>
                    <ModelEvalCheckList checks={candidate.checks} ownerId={`candidate-${index}`} />
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className='text-sm text-muted-foreground'>
              No candidate comparison report has been generated.
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

/**
 * Renders model evaluation check cards.
 *
 * @param checks - Check results from a single model or candidate report.
 * @param ownerId - Stable key prefix for the rendered check list.
 */
export function ModelEvalCheckList({ checks, ownerId }: ModelEvalCheckListProps) {
  return (
    <ul className='grid gap-3'>
      {checks.map((check) => (
        <li
          className='grid min-w-0 gap-3 rounded-xl bg-muted/25 p-3'
          key={`${ownerId}-${check.name}`}
        >
          <div className='grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start'>
            <div className='min-w-0 space-y-1'>
              <strong className='break-all'>{check.name}</strong>
              <span className='block text-sm text-muted-foreground'>{check.message}</span>
            </div>
            <Badge variant={check.status === "pass" ? "secondary" : "destructive"}>
              {check.status}
            </Badge>
          </div>
          <p className='break-all text-xs text-muted-foreground'>
            {check.durationMs === null ? "duration n/a" : `${check.durationMs}ms`}
            {" · "}
            input {check.inputTokensApprox ?? "n/a"} / output {check.outputTokensApprox ?? "n/a"}
            {check.promptHash ? ` · prompt ${check.promptHash}` : ""}
            {check.outputHash ? ` · output ${check.outputHash}` : ""}
          </p>
        </li>
      ))}
    </ul>
  );
}
