import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { StudioActionServiceStatus } from "@/lib/actionServiceStatus";
import {
  studioWorkflowActionSteps,
  type StudioWorkflowAction,
  type StudioWorkflowActionStatus,
} from "@/lib/studioWorkflowActions";

type StudioWorkflowMatrixPanelProps = Readonly<{ status: StudioActionServiceStatus }>;

/**
 * Renders the v1 workflow-to-web-control matrix from shared mutation contracts.
 *
 * @param status - Current route and service-contract status.
 * @returns An operator-facing workflow action matrix.
 */
export function StudioWorkflowMatrixPanel({ status }: StudioWorkflowMatrixPanelProps) {
  const steps = studioWorkflowActionSteps(status);

  return (
    <section aria-labelledby='workflow-action-matrix-heading'>
      <div className='mb-4 space-y-2'>
        <h2 className='text-2xl font-semibold tracking-tight' id='workflow-action-matrix-heading'>
          Workflow Control Matrix
        </h2>
        <p className='text-muted-foreground max-w-4xl text-sm'>
          Studio maps each safe v1 workflow step to shared CLI/core service contracts. This is a
          route-readiness view, not a second workflow engine.
        </p>
      </div>
      <div className='grid gap-4 lg:grid-cols-2'>
        {steps.map((step) => (
          <Card key={step.label}>
            <CardHeader>
              <CardTitle>{step.label}</CardTitle>
              <CardDescription>{step.summary}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className='grid gap-3'>
                {step.actions.map((action) => (
                  <li className='bg-muted/10 grid gap-2 rounded-lg p-3' key={action.actionId}>
                    <div className='flex flex-wrap items-start justify-between gap-2'>
                      <div className='min-w-0'>
                        <strong className='text-sm break-all'>{action.actionId}</strong>
                        <p className='text-muted-foreground mt-1 text-sm'>{action.description}</p>
                      </div>
                      <Badge variant={statusBadgeVariant(action.status)}>
                        {statusLabel(action.status)}
                      </Badge>
                    </div>
                    <ActionRouteFact action={action} />
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function ActionRouteFact({ action }: Readonly<{ action: StudioWorkflowAction }>) {
  const routeCopy =
    action.status === "web-ready" ? action.routePath : action.cliCommand.replace(/\s+/g, " ");
  return (
    <code className='bg-background/45 text-muted-foreground rounded px-2 py-1 font-mono text-xs break-all'>
      {routeCopy}
    </code>
  );
}

function statusBadgeVariant(
  status: StudioWorkflowActionStatus,
): "destructive" | "outline" | "secondary" {
  if (status === "disabled") {
    return "destructive";
  }
  return status === "web-ready" ? "secondary" : "outline";
}

function statusLabel(status: StudioWorkflowActionStatus): string {
  if (status === "web-ready") {
    return "web route";
  }
  if (status === "disabled") {
    return "disabled";
  }
  return "CLI fallback";
}
