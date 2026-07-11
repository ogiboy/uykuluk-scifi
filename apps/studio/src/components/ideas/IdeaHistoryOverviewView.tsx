import type { Route } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { StudioIdeaHistoryEntry, StudioIdeaHistoryOverview } from "@/lib/ideaHistoryOverview";

type IdeaHistoryOverviewViewProps = Readonly<{ overview: StudioIdeaHistoryOverview }>;

/**
 * Renders the read-only idea originality surface.
 *
 * @param overview - Runtime idea history summary derived from persisted run artifacts.
 */
export function IdeaHistoryOverviewView({ overview }: IdeaHistoryOverviewViewProps) {
  return (
    <div className='grid gap-5'>
      <section
        aria-labelledby='idea-history-policy-heading'
        className='bg-card/55 grid gap-4 rounded-2xl p-5 shadow-sm shadow-black/10 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,26rem)]'
      >
        <div className='space-y-3'>
          <p className='text-muted-foreground text-xs font-semibold tracking-[0.28em] uppercase'>
            Originality guard
          </p>
          <h2 className='text-xl font-semibold tracking-tight' id='idea-history-policy-heading'>
            Generated and approved titles are both treated as occupied channel idea space.
          </h2>
          <p className='text-muted-foreground max-w-3xl text-sm'>
            Studio shows the same title-only history that idea generation uses as compact prompt
            context. Reusing a normalized historical title is a hard-blocked provider response, so
            the core repairs or fails closed without writing a new idea artifact.
          </p>
        </div>
        <dl className='grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-1'>
          <PolicyFact label='Prompt context' value='Title-only' />
          <PolicyFact label='Hard-block scope' value='Generated + approved' />
          <PolicyFact label='Runtime source' value='runs/*/ideas.json' />
        </dl>
      </section>

      <section className='grid gap-3 md:grid-cols-2 xl:grid-cols-4' aria-label='Idea history facts'>
        <MetricCard
          detail='All persisted generated idea titles.'
          label='Tracked titles'
          value={overview.totalCount}
        />
        <MetricCard
          detail='Titles selected through explicit approval.'
          label='Approved'
          value={overview.approvedCount}
        />
        <MetricCard
          detail='Generated but not selected yet.'
          label='Generated only'
          value={overview.generatedOnlyCount}
        />
        <MetricCard
          detail='Historical duplicates visible in existing artifacts.'
          label='Duplicate signatures'
          value={overview.duplicateTitleCount}
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Runtime idea history</CardTitle>
          <CardDescription>
            Read-only title index. Premises are shown only as short operator context and are not fed
            into the next planner prompt.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {overview.entries.length ? (
            <IdeaHistoryList entries={overview.entries} />
          ) : (
            <EmptyIdeas />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  detail,
  label,
  value,
}: Readonly<{ detail: string; label: string; value: number }>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-muted-foreground text-sm font-medium'>{label}</CardTitle>
      </CardHeader>
      <CardContent className='space-y-2'>
        <p className='text-3xl font-semibold tracking-tight'>{value}</p>
        <p className='text-muted-foreground text-sm'>{detail}</p>
      </CardContent>
    </Card>
  );
}

function PolicyFact({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className='bg-background/45 rounded-xl p-3'>
      <dt className='text-muted-foreground text-xs font-semibold tracking-[0.18em] uppercase'>
        {label}
      </dt>
      <dd className='mt-1 font-medium'>{value}</dd>
    </div>
  );
}

function IdeaHistoryList({ entries }: Readonly<{ entries: readonly StudioIdeaHistoryEntry[] }>) {
  return (
    <div className='overflow-x-auto'>
      <table className='min-w-full text-left text-sm'>
        <thead className='text-muted-foreground text-xs tracking-[0.18em] uppercase'>
          <tr className='border-border/35 border-b'>
            <th className='py-3 pr-4 font-medium'>Title</th>
            <th className='py-3 pr-4 font-medium'>Status</th>
            <th className='py-3 pr-4 font-medium'>Run</th>
            <th className='py-3 pr-4 font-medium'>Context</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr
              className='border-border/20 border-b last:border-b-0'
              key={`${entry.runId}:${entry.ideaId}`}
            >
              <td className='max-w-88 py-3 pr-4 align-top'>
                <p className='font-medium'>{entry.title}</p>
                <p className='text-muted-foreground mt-1 text-xs'>{entry.ideaId}</p>
              </td>
              <td className='py-3 pr-4 align-top'>
                <Badge variant={entry.status === "approved" ? "secondary" : "outline"}>
                  {entry.status}
                </Badge>
              </td>
              <td className='py-3 pr-4 align-top'>
                <Link
                  className='font-medium underline-offset-4 hover:underline'
                  href={`/runs/${entry.runId}` as Route}
                >
                  {entry.runId}
                </Link>
                <p className='text-muted-foreground mt-1 text-xs'>{entry.state}</p>
              </td>
              <td className='text-muted-foreground max-w-120 py-3 pr-4 align-top'>
                {entry.premise ?? "No premise stored."}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyIdeas() {
  return (
    <div className='border-border/50 text-muted-foreground rounded-xl border border-dashed p-6 text-sm'>
      No persisted idea artifacts yet. Start with{" "}
      <code className='bg-muted/30 rounded px-1.5 py-0.5'>pnpm producer ideas</code> or the guarded
      Studio run action, then return here to review title history.
    </div>
  );
}
