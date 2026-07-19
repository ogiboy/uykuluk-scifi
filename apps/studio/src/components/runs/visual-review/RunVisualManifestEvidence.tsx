import type { StudioLocale } from "@/i18n/locales";
import type { StudioVisualSummary } from "@/lib/runs/visualSummaries";
import { visualReviewCopy } from "./visualReviewCopy";

/** Keeps exact manifest and revision evidence available without crowding the primary review UI. */
export function RunVisualManifestEvidence({
  locale,
  summary,
}: Readonly<{ locale: StudioLocale; summary: StudioVisualSummary }>) {
  if (!summary.manifestDigest) return null;
  const copy = visualReviewCopy(locale);
  return (
    <details className='text-muted-foreground text-xs'>
      <summary className='cursor-pointer font-medium'>{copy.advancedManifest}</summary>
      <div className='mt-2 grid gap-1 break-all'>
        <p>
          {copy.manifestDigest}: {summary.manifestDigest}
        </p>
        <p>
          {copy.updated}: {summary.updatedAt}
        </p>
        <p>
          {copy.activeRevisions}: {JSON.stringify(summary.activeRevisions)}
        </p>
      </div>
    </details>
  );
}
