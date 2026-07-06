import { ServiceContractCatalog } from "@/components/ServiceContractCatalog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getStudioActionServiceStatus,
  type StudioActionServiceStatus,
} from "@/lib/actionServiceStatus";
import { serviceContractGroups } from "@/lib/serviceContractPanel";

type ServiceContractPanelProps = Readonly<{ status?: StudioActionServiceStatus }>;

/**
 * Displays the Studio mutation service contract status panel.
 *
 * @param status - Optional preloaded service status shared with the current route.
 * @returns The rendered service contract status section.
 */
export function ServiceContractPanel({
  status = getStudioActionServiceStatus(),
}: ServiceContractPanelProps) {
  const safetyLabel = status.webMutationsEnabled ? "Review required" : "Web mutations disabled";
  const groups = serviceContractGroups(status.summaries);

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
      {status.findings.length > 0 ? (
        <Card className='mt-4 border-destructive/25 bg-destructive/10'>
          <CardHeader>
            <CardTitle>Route security findings</CardTitle>
            <CardDescription>
              Resolve these before adding or expanding Studio mutation routes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className='grid gap-2 text-sm text-muted-foreground'>
              {status.findings.map((finding, index) => (
                <li
                  className='rounded-lg bg-card/70 px-3 py-2 ring-1 ring-destructive/20'
                  key={`${index}-${finding}`}
                >
                  {finding}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
      <div className='mt-4'>
        <ServiceContractCatalog groups={groups} />
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
