import { CopyableCommand } from "@/components/studio/CopyableCommand";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getStudioActionServiceStatus } from "@/lib/actionServiceStatus";

/**
 * Displays the Studio mutation service contract status panel.
 *
 * @returns The rendered service contract status section.
 */
export function ServiceContractPanel() {
  const status = getStudioActionServiceStatus();
  const safetyLabel = status.webMutationsEnabled ? "Review required" : "Web mutations disabled";

  return (
    <section id='actions' aria-labelledby='actions-heading'>
      <div className='mb-4 space-y-2'>
        <h2 className='text-2xl font-semibold tracking-tight' id='actions-heading'>
          Mutation Service Contracts
        </h2>
        <p className='max-w-4xl text-sm text-muted-foreground'>
          Studio exposes guarded local approval, review, and workflow-stage routes over shared
          CLI/core contracts. Upload and publish actions remain disabled.
        </p>
      </div>
      <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
        <ServiceMetricCard
          detail={`${status.disabledRouteCount} future action routes remain disabled.`}
          label='Route Safety'
          tone={status.webMutationsEnabled ? "blocked" : "neutral"}
          value={safetyLabel}
        />
        <ServiceMetricCard
          detail='Approval, review, and local workflow-stage actions are bound to CLI/core functions.'
          label='CLI-ready Contracts'
          value={String(status.readyForCliCount)}
        />
        <ServiceMetricCard
          detail='Upload and publish actions stay disabled and approval-gated.'
          label='External Risk'
          tone='blocked'
          value={String(status.riskyExternalCount)}
        />
        <ServiceMetricCard
          detail='Route security findings must stay at zero before any additional mutation work.'
          label='Contract Findings'
          value={String(status.findings.length)}
        />
      </div>
      <div className='mt-4 grid gap-4 lg:grid-cols-2'>
        {status.summaries.map((summary) => (
          <Card key={summary.actionId}>
            <CardHeader>
              <CardTitle>{summary.actionId}</CardTitle>
              <CardDescription>{summary.description}</CardDescription>
            </CardHeader>
            <CardContent className='space-y-3'>
              <CopyableCommand command={summary.cliCommand} label={`${summary.actionId} command`} />
              <p className='text-sm text-muted-foreground'>
                Route:{" "}
                <code className='rounded bg-muted px-1.5 py-0.5 text-xs text-foreground'>
                  {summary.routePath}
                </code>{" "}
                · {summary.availability}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

type ServiceMetricCardProps = Readonly<{
  detail: string;
  label: string;
  tone?: "blocked" | "neutral";
  value: string;
}>;

function ServiceMetricCard({ detail, label, tone = "neutral", value }: ServiceMetricCardProps) {
  return (
    <Card>
      <CardContent className='space-y-2 pt-6'>
        <p className='text-sm font-medium text-muted-foreground'>{label}</p>
        <strong
          className={
            tone === "blocked"
              ? "block text-2xl font-semibold text-destructive"
              : "block text-2xl font-semibold"
          }
        >
          {value}
        </strong>
        <p className='text-sm text-muted-foreground'>{detail}</p>
      </CardContent>
    </Card>
  );
}
