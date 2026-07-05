import { RunDetailCard } from "@/components/runs/RunDetailCard";
import { Badge } from "@/components/ui/badge";
import type { StatusWorkflowStep } from "../../../../../src/stages/statusWorkflow";

type RunWorkflowProgressPanelProps = Readonly<{
  workflowProgress: StatusWorkflowStep[];
}>;

/**
 * Renders the read-only v1 workflow progress projection for a run.
 *
 * @param props - Panel props
 * @param props.workflowProgress - Ordered workflow progress rows
 */
export function RunWorkflowProgressPanel({ workflowProgress }: RunWorkflowProgressPanelProps) {
  const completedCount = workflowProgress.filter((step) => step.status === "done").length;
  const attentionCount = workflowProgress.filter(
    (step) => step.status === "blocked" || step.status === "current",
  ).length;
  return (
    <RunDetailCard
      headingId='workflow-progress-heading'
      title='Workflow Progress'
      description='Read-only v1 production-loop projection from CLI/core state, readiness, evidence, and media status.'
    >
      <div className='flex flex-wrap gap-2' aria-label='Workflow progress summary'>
        <Badge variant='secondary'>
          {completedCount}/{workflowProgress.length} done
        </Badge>
        <Badge variant={attentionCount > 0 ? "outline" : "secondary"}>
          {attentionCount} active
        </Badge>
      </div>
      <ol className='grid gap-3'>
        {workflowProgress.map((step) => (
          <li
            className='grid gap-2 rounded-lg border bg-muted/20 p-3 sm:grid-cols-[auto_1fr]'
            key={step.label}
          >
            <Badge className='capitalize' variant={workflowStatusBadgeVariant(step.status)}>
              {step.status}
            </Badge>
            <div className='min-w-0'>
              <strong className='block text-sm'>{step.label}</strong>
              <p className='mt-1 text-sm text-muted-foreground'>{step.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </RunDetailCard>
  );
}

/**
 * Maps workflow progress statuses to Studio badge variants.
 *
 * @param status - The workflow progress status value
 * @returns The shadcn badge variant for the corresponding workflow status
 */
function workflowStatusBadgeVariant(status: string) {
  if (status === "blocked") {
    return "destructive";
  }
  if (status === "done") {
    return "secondary";
  }
  return "outline";
}
