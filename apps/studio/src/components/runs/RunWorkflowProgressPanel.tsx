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
    <section className='panel' aria-labelledby='workflow-progress-heading'>
      <div className='workflow-progress-header'>
        <div>
          <h2 id='workflow-progress-heading'>Workflow Progress</h2>
          <p>
            Read-only v1 production-loop projection from CLI/core state, readiness, evidence, and
            media status.
          </p>
        </div>
        <div className='workflow-progress-summary' aria-label='Workflow progress summary'>
          <span>
            {completedCount}/{workflowProgress.length} done
          </span>
          <span>{attentionCount} active</span>
        </div>
      </div>
      <ol className='workflow-progress-list'>
        {workflowProgress.map((step) => (
          <li className={`workflow-progress-item ${step.status}`} key={step.label}>
            <span className={workflowStatusClassName(step.status)}>{step.status}</span>
            <div>
              <strong>{step.label}</strong>
              <p>{step.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * Maps workflow progress statuses to Studio status pill class names.
 *
 * @param status - The workflow progress status value
 * @returns The CSS class name for the corresponding workflow status pill
 */
function workflowStatusClassName(status: string): string {
  if (status === "blocked") {
    return "status-pill small attention";
  }
  if (status === "done") {
    return "status-pill small done";
  }
  if (status === "current") {
    return "status-pill small ready";
  }
  return "status-pill small pending";
}
