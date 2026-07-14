import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import type { StudioActionServiceStatus } from "@/lib/actionServiceStatus";
import { homeActionQueueSummaryItems } from "@/lib/actions/homeActionQueueSummary";
import type { StudioRunSummary } from "@/lib/runSummaries";

type StudioActionOverviewPanelProps = Readonly<{
  runs: readonly StudioRunSummary[];
  status: StudioActionServiceStatus;
}>;

type ActionOverviewFact = Readonly<{
  detail: string;
  label: string;
  tone: "blocked" | "neutral" | "ready" | "warning";
  value: string;
}>;

/**
 * Renders the route-level action overview for guarded Studio web controls.
 *
 * @param runs - Persisted run summaries used for action queue categories.
 * @param status - Current shared mutation-service route status.
 * @returns A compact overview of web-ready runs, guarded contracts, and disabled boundaries.
 */
export function StudioActionOverviewPanel({ runs, status }: StudioActionOverviewPanelProps) {
  const queueFacts = actionQueueFacts(runs);
  const contractFacts = actionContractFacts(status);

  return (
    <section
      aria-labelledby='action-overview-heading'
      className='bg-card/55 rounded-2xl p-5 shadow-sm shadow-black/10'
    >
      <div className='grid gap-3 pb-4 sm:grid-cols-[1fr_auto] sm:items-end'>
        <div className='space-y-1'>
          <p className='text-muted-foreground text-xs font-semibold tracking-[0.28em] uppercase'>
            Guarded action map
          </p>
          <h2 className='text-xl font-semibold tracking-tight' id='action-overview-heading'>
            Studio actions stay local, same-origin, and CLI/core-backed.
          </h2>
        </div>
        <div className='flex flex-wrap gap-2 sm:justify-end'>
          <Link className={buttonVariants({ variant: "secondary" })} href='/runs'>
            Open run queue
          </Link>
          <Link className={buttonVariants({ variant: "ghost" })} href='#actions'>
            Contract catalog
          </Link>
        </div>
      </div>

      <div className='grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,26rem)]'>
        <ActionFactGroup facts={queueFacts} heading='Run action queue' />
        <ActionFactGroup facts={contractFacts} heading='Route contracts' />
      </div>

      <ul className='text-muted-foreground mt-4 grid gap-3 text-sm md:grid-cols-3'>
        <li className='bg-background/45 rounded-xl p-3'>
          Web routes call guarded local POST endpoints; they do not own workflow state.
        </li>
        <li className='bg-background/45 rounded-xl p-3'>
          CLI/core still validates approvals, readiness, evidence, budget, and provider boundaries.
        </li>
        <li className='bg-background/45 rounded-xl p-3'>
          Upload, public publishing, and scheduling stay disabled. Hosted voice remains available
          only through exact CLI/core approval and cost gates.
        </li>
      </ul>
    </section>
  );
}

function ActionFactGroup({
  facts,
  heading,
}: Readonly<{ facts: readonly ActionOverviewFact[]; heading: string }>) {
  return (
    <section aria-label={heading} className='bg-background/35 grid gap-3 rounded-xl p-4'>
      <h3 className='text-muted-foreground text-sm font-semibold tracking-[0.18em] uppercase'>
        {heading}
      </h3>
      <dl className='grid gap-3 sm:grid-cols-2'>
        {facts.map((fact) => (
          <div className='bg-muted/10 grid gap-2 rounded-lg p-3 text-sm' key={fact.label}>
            <dt className='flex items-center justify-between gap-3'>
              <span className='text-muted-foreground'>{fact.label}</span>
              <Badge variant={badgeVariant(fact.tone)}>{fact.value}</Badge>
            </dt>
            <dd>{fact.detail}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function actionQueueFacts(runs: readonly StudioRunSummary[]): ActionOverviewFact[] {
  const summary = Object.fromEntries(
    homeActionQueueSummaryItems(runs).map((item) => [item.key, item.value]),
  );
  return [
    {
      detail: "Run-bound actions that Studio can execute through guarded local routes.",
      label: "Web-ready runs",
      tone: "ready",
      value: String(summary.webAction ?? 0),
    },
    {
      detail: "Runs requiring operator artifact or decision review before the next action.",
      label: "Needs review",
      tone: "warning",
      value: String(summary.needsReview ?? 0),
    },
    {
      detail: "Runs that need fail-closed CLI recovery or diagnostic remediation.",
      label: "Blocked recovery",
      tone: (summary.blockedCli ?? 0) > 0 ? "blocked" : "neutral",
      value: String(summary.blockedCli ?? 0),
    },
    {
      detail: "Safe next steps visible to Studio but not exposed as web mutations.",
      label: "CLI-only",
      tone: "neutral",
      value: String(summary.cliOnly ?? 0),
    },
  ];
}

function actionContractFacts(status: StudioActionServiceStatus): ActionOverviewFact[] {
  return [
    {
      detail: "Ready CLI/core contracts exposed through guarded Studio routes.",
      label: "Guarded web routes",
      tone: "ready",
      value: `${status.webReadyCount}/${status.readyForCliCount}`,
    },
    {
      detail: "Ready contracts that still require terminal fallback or a different review surface.",
      label: "CLI fallbacks",
      tone: status.cliFallbackCount > 0 ? "warning" : "neutral",
      value: String(status.cliFallbackCount),
    },
    {
      detail: "Route security findings must remain zero before adding new web actions.",
      label: "Route findings",
      tone: status.findings.length > 0 ? "blocked" : "neutral",
      value: String(status.findings.length),
    },
    {
      detail: "Upload or publish-style contracts intentionally unavailable from Studio.",
      label: "External disabled",
      tone: "blocked",
      value: String(status.riskyExternalCount),
    },
  ];
}

function badgeVariant(tone: ActionOverviewFact["tone"]): "destructive" | "outline" | "secondary" {
  if (tone === "blocked") {
    return "destructive";
  }
  if (tone === "ready") {
    return "secondary";
  }
  return "outline";
}
