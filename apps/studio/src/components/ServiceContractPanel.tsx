import { CopyableCommand } from "@/components/studio/CopyableCommand";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getStudioActionServiceStatus,
  type StudioActionServiceStatus,
  type StudioActionServiceSummary,
} from "@/lib/actionServiceStatus";

type ServiceContractPanelProps = Readonly<{
  status?: StudioActionServiceStatus;
}>;

type ServiceContractGroup = Readonly<{
  description: string;
  summaries: readonly StudioActionServiceSummary[];
  title: string;
}>;

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
        <Card className='mt-4 border-destructive/40 bg-destructive/10'>
          <CardHeader>
            <CardTitle>Route security findings</CardTitle>
            <CardDescription>
              Resolve these before adding or expanding Studio mutation routes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className='grid gap-2 text-sm text-muted-foreground'>
              {status.findings.map((finding, index) => (
                <li className='rounded-md border bg-card px-3 py-2' key={`${index}-${finding}`}>
                  {finding}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
      <div className='mt-4 grid gap-6'>
        {groups.map((group) => (
          <section className='space-y-3' key={group.title} aria-label={group.title}>
            <div className='flex flex-wrap items-start justify-between gap-3'>
              <div className='space-y-1'>
                <h3 className='text-lg font-semibold tracking-tight'>{group.title}</h3>
                <p className='max-w-4xl text-sm text-muted-foreground'>{group.description}</p>
              </div>
              <Badge variant='secondary'>{group.summaries.length}</Badge>
            </div>
            <div className='grid gap-4 lg:grid-cols-2'>
              {group.summaries.map((summary) => (
                <ServiceContractCard key={summary.actionId} summary={summary} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}

function ServiceContractCard({ summary }: Readonly<{ summary: StudioActionServiceSummary }>) {
  return (
    <Card>
      <CardHeader>
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <div className='space-y-2'>
            <CardTitle>{summary.actionId}</CardTitle>
            <CardDescription>{summary.description}</CardDescription>
          </div>
          <Badge
            variant={summary.availability === "disabled-external" ? "destructive" : "secondary"}
          >
            {summary.availability === "disabled-external" ? "disabled" : "guarded"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className='space-y-3'>
        <CopyableCommand command={summary.cliCommand} label={`${summary.actionId} command`} />
        <dl className='grid gap-2 text-sm text-muted-foreground sm:grid-cols-2'>
          <div className='space-y-1 rounded-md border bg-muted/20 p-3'>
            <dt className='font-medium text-foreground'>Route</dt>
            <dd>
              <code className='break-all text-xs text-foreground'>{summary.routePath}</code>
            </dd>
          </div>
          <div className='space-y-1 rounded-md border bg-muted/20 p-3'>
            <dt className='font-medium text-foreground'>Boundary</dt>
            <dd>{serviceBoundaryCopy(summary)}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
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

function serviceContractGroups(
  summaries: readonly StudioActionServiceSummary[],
): readonly ServiceContractGroup[] {
  const guarded = summaries.filter((summary) => summary.availability === "ready-for-cli");
  const disabled = summaries.filter((summary) => summary.availability === "disabled-external");
  return [
    {
      description:
        "These routes are local-only POST actions backed by typed CLI/core contracts and route security.",
      summaries: guarded,
      title: "Guarded local actions",
    },
    {
      description:
        "These public or external-risk actions remain unavailable from Studio until future config, approval, and evidence contracts exist.",
      summaries: disabled,
      title: "Disabled external actions",
    },
  ];
}

function serviceBoundaryCopy(summary: StudioActionServiceSummary): string {
  if (summary.availability === "disabled-external") {
    return "No Studio route executes this action; upload and publish stay blocked.";
  }
  if (summary.routePath === "unrouted") {
    return "Contract exists, but no guarded route is currently exposed.";
  }
  return "Same-origin JSON, Studio action header, local session proof, and CLI/core gates required.";
}
