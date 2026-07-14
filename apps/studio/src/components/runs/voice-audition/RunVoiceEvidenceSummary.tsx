import { Badge } from "@/components/ui/badge";
import type { StudioVoiceAuditionSummary } from "@/lib/runs/voiceAuditionSummaries";
import { RunVoiceAdvancedEvidence } from "./RunVoiceAdvancedEvidence";

type RunVoiceEvidenceSummaryProps = Readonly<{ summary: StudioVoiceAuditionSummary }>;

/** Renders operator-level production status and progressively disclosed voice evidence. */
export function RunVoiceEvidenceSummary({ summary }: RunVoiceEvidenceSummaryProps) {
  const production = summary.production;
  return (
    <div className='grid gap-4'>
      <section className='grid gap-3' aria-labelledby='voice-production-status-heading'>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <h3 className='text-sm font-semibold' id='voice-production-status-heading'>
            Production gate summary
          </h3>
          <Badge variant={productionStatusVariant(summary)}>Core remains authoritative</Badge>
        </div>
        <dl className='grid gap-3 sm:grid-cols-2 xl:grid-cols-3'>
          <StatusFact
            detail={quoteDetail(production.quote)}
            label='Quote and budget'
            status={production.quote.status}
          />
          <StatusFact
            detail={production.approval.detail}
            label='Cost approval'
            status={production.approval.status}
          />
          <StatusFact
            detail={quotaDetail(production.quota)}
            label='Provider quota'
            status={production.quota && production.quota.remaining > 0 ? "ready" : "missing"}
          />
          <StatusFact
            detail={production.synthesis.detail}
            label='Production synthesis'
            status={production.synthesis.status}
          />
          <StatusFact
            detail={production.alignment.detail}
            label='Alignment review'
            status={production.alignment.status}
          />
          <StatusFact
            detail='Render approval and production execution are handled by the guarded action rail.'
            label='Next controlled step'
            status='pending'
          />
        </dl>
      </section>

      <SelectionHistory summary={summary} />
      <RunVoiceAdvancedEvidence summary={summary} />
    </div>
  );
}

function StatusFact({
  detail,
  label,
  status,
}: Readonly<{ detail: string; label: string; status: string }>) {
  return (
    <div className='bg-muted/10 ring-border/5 grid min-w-0 gap-2 rounded-lg p-3 ring-1'>
      <dt className='flex flex-wrap items-center justify-between gap-2'>
        <span className='text-muted-foreground text-xs font-medium tracking-wide uppercase'>
          {label}
        </span>
        <Badge className='capitalize' variant={statusVariant(status)}>
          {status}
        </Badge>
      </dt>
      <dd className='text-sm'>{detail}</dd>
    </div>
  );
}

function SelectionHistory({ summary }: RunVoiceEvidenceSummaryProps) {
  return (
    <section className='grid gap-3' aria-labelledby='voice-selection-history-heading'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <h3 className='text-sm font-semibold' id='voice-selection-history-heading'>
          Selection history
        </h3>
        <Badge variant='outline'>{summary.history.length} recorded</Badge>
      </div>
      {summary.history.length > 0 ? (
        <ol className='grid gap-2'>
          {summary.history.map((item) => (
            <li
              className='bg-muted/10 ring-border/5 grid gap-2 rounded-lg p-3 ring-1 sm:grid-cols-[minmax(0,1fr)_auto]'
              key={item.selectionDigest}
            >
              <div className='min-w-0'>
                <div className='flex flex-wrap items-center gap-2'>
                  <strong>{item.name}</strong>
                  <Badge className='capitalize' variant={statusVariant(item.status)}>
                    {item.status}
                  </Badge>
                </div>
                <p className='text-muted-foreground mt-1 text-sm'>{item.notes}</p>
                {item.reason ? (
                  <p className='mt-1 text-sm text-amber-800 dark:text-amber-200'>
                    Reselection reason: {item.reason}
                  </p>
                ) : null}
              </div>
              <div className='text-muted-foreground text-xs sm:text-right'>
                <p>{item.reviewedBy}</p>
                <time dateTime={item.selectedAt}>{formatTimestamp(item.selectedAt)}</time>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className='bg-muted/10 text-muted-foreground rounded-lg p-3 text-sm'>
          No attributable voice selection has been recorded.
        </p>
      )}
    </section>
  );
}

function quoteDetail(quote: StudioVoiceAuditionSummary["production"]["quote"]): string {
  if (quote.status === "missing") return "No exact paid-generation quote has been persisted.";
  if (quote.estimatedUsd === undefined) return "The persisted quote cannot be trusted.";
  return `${formatUsd(quote.estimatedUsd)} estimated for TTS · budget ${quote.budgetAllowed ? "allowed" : "blocked"}.`;
}

function quotaDetail(quota: StudioVoiceAuditionSummary["production"]["quota"]): string {
  if (!quota) return "Quota appears after an operator-requested catalog refresh.";
  return `${quota.remaining.toLocaleString()} remaining of ${quota.limit.toLocaleString()} characters · ${quota.tier} tier.`;
}

function productionStatusVariant(
  summary: StudioVoiceAuditionSummary,
): "destructive" | "outline" | "secondary" {
  if (
    summary.production.quote.status === "blocked" ||
    summary.production.approval.status === "blocked"
  ) {
    return "destructive";
  }
  return summary.production.synthesis.status === "ready" ? "secondary" : "outline";
}

function statusVariant(status: string): "destructive" | "outline" | "secondary" {
  if (["blocked", "failed", "invalid"].includes(status)) return "destructive";
  if (["approved", "current", "fresh", "ready"].includes(status)) return "secondary";
  return "outline";
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function formatTimestamp(value: string): string {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toLocaleString() : value;
}
