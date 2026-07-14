import type { StudioVisualSummary } from "@/lib/runs/visualSummaries";

/** Keeps exact manifest and revision evidence available without crowding the primary review UI. */
export function RunVisualManifestEvidence({ summary }: Readonly<{ summary: StudioVisualSummary }>) {
  if (!summary.manifestDigest) return null;
  return (
    <details className='text-muted-foreground text-xs'>
      <summary className='cursor-pointer font-medium'>Advanced manifest evidence</summary>
      <div className='mt-2 grid gap-1 break-all'>
        <p>Manifest digest: {summary.manifestDigest}</p>
        <p>Updated: {summary.updatedAt}</p>
        <p>Active revisions: {JSON.stringify(summary.activeRevisions)}</p>
      </div>
    </details>
  );
}
