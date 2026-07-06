import Link from "next/link";
import { CopyableCommand } from "@/components/studio/CopyableCommand";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getStudioActionServiceStatus,
  type StudioActionServiceStatus,
  type StudioActionServiceSummary,
} from "@/lib/actionServiceStatus";
import {
  actionSurface,
  serviceBoundaryCopy,
  serviceContractGroups,
} from "@/lib/serviceContractPanel";

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
      <div className='mt-4 grid gap-4'>
        {groups.map((group) => (
          <Card key={group.title} aria-label={group.title}>
            <CardHeader className='gap-3 sm:grid-cols-[minmax(0,1fr)_auto]'>
              <div className='space-y-1'>
                <CardTitle>{group.title}</CardTitle>
                <CardDescription>{group.description}</CardDescription>
              </div>
              <Badge className='justify-self-start sm:justify-self-end' variant='secondary'>
                {group.summaries.length}
              </Badge>
            </CardHeader>
            <CardContent>
              <ServiceContractAccordion summaries={group.summaries} />
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function ServiceContractAccordion({
  summaries,
}: Readonly<{ summaries: readonly StudioActionServiceSummary[] }>) {
  return (
    <Accordion className='rounded-xl bg-muted/20 px-3' type='multiple'>
      {summaries.map((summary) => (
        <AccordionItem className='border-border/40' key={summary.actionId} value={summary.actionId}>
          <AccordionTrigger className='hover:no-underline'>
            <span className='grid min-w-0 gap-1'>
              <span className='flex flex-wrap items-center gap-2'>
                <span className='break-all font-semibold'>{summary.actionId}</span>
                <Badge
                  variant={
                    summary.availability === "disabled-external" ? "destructive" : "secondary"
                  }
                >
                  {summary.availability === "disabled-external" ? "disabled" : "guarded"}
                </Badge>
              </span>
              <span className='text-sm font-normal text-muted-foreground'>
                {summary.description}
              </span>
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <ServiceContractDetails summary={summary} />
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

function ServiceContractDetails({ summary }: Readonly<{ summary: StudioActionServiceSummary }>) {
  return (
    <div className='grid gap-3 rounded-xl bg-background/70 p-3'>
      <ActionRouteControl summary={summary} />
      <CopyableCommand command={summary.cliCommand} label={`${summary.actionId} command`} />
      <dl className='grid gap-2 text-sm text-muted-foreground sm:grid-cols-2'>
        <div className='space-y-1 rounded-lg bg-muted/40 p-3'>
          <dt className='font-medium text-foreground'>Route</dt>
          <dd>
            <code className='break-all text-xs text-foreground'>{summary.routePath}</code>
          </dd>
        </div>
        <div className='space-y-1 rounded-lg bg-muted/40 p-3'>
          <dt className='font-medium text-foreground'>Boundary</dt>
          <dd>{serviceBoundaryCopy(summary)}</dd>
        </div>
      </dl>
    </div>
  );
}

function ActionRouteControl({ summary }: Readonly<{ summary: StudioActionServiceSummary }>) {
  if (summary.availability === "ready-for-cli" && summary.routePath !== "unrouted") {
    const surface = actionSurface(summary.actionId);
    return (
      <Link
        className={buttonVariants({ className: "w-full sm:w-fit", variant: "default" })}
        href={surface.href}
      >
        {surface.label}
      </Link>
    );
  }
  return (
    <p className='rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive'>
      Web execution is disabled for this action.
    </p>
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
