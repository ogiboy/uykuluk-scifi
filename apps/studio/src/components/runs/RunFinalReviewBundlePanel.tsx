import {
  RunDetailCard,
  RunDetailStatusBadge,
  RunMetadataList,
  type RunMetadataItem,
} from "@/components/runs/RunDetailCard";
import type { StudioRunDetail } from "@/lib/runSummaries";

type RunFinalReviewBundlePanelProps = Readonly<{
  finalReviewBundle: StudioRunDetail["finalReviewBundle"];
}>;

/**
 * Renders the read-only final review bundle status for a run.
 *
 * @param finalReviewBundle - The Studio final review bundle summary.
 */
export function RunFinalReviewBundlePanel({ finalReviewBundle }: RunFinalReviewBundlePanelProps) {
  const metadataItems =
    finalReviewBundle.kind === "present" ? finalReviewBundleMetadataItems(finalReviewBundle) : [];

  return (
    <RunDetailCard
      headingId='final-review-bundle-heading'
      title='Final Review Bundle'
      description='Read-only display. Upload and public publishing remain disabled.'
    >
      <p className='flex flex-wrap items-center gap-2'>
        <RunDetailStatusBadge tone={finalReviewBundleStatusTone(finalReviewBundle.kind)}>
          {finalReviewBundle.kind}
        </RunDetailStatusBadge>
        <span>{finalReviewBundle.message}</span>
      </p>
      {metadataItems.length > 0 ? <RunMetadataList items={metadataItems} /> : null}
      {finalReviewBundle.nextAction ? (
        <p className='rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-100'>
          Next action: {finalReviewBundle.nextAction}
        </p>
      ) : null}
    </RunDetailCard>
  );
}

function finalReviewBundleStatusTone(
  status: StudioRunDetail["finalReviewBundle"]["kind"],
): "blocked" | "success" | "warning" {
  if (status === "present") {
    return "success";
  }
  if (status === "missing") {
    return "warning";
  }
  return "blocked";
}

function finalReviewBundleMetadataItems(
  finalReviewBundle: Extract<StudioRunDetail["finalReviewBundle"], { kind: "present" }>,
): RunMetadataItem[] {
  return [
    { label: "Status", value: finalReviewBundle.bundle.status },
    { label: "Review handoff", value: finalReviewBundle.reviewPath },
    {
      label: "Timestamped draft map",
      value: finalReviewBundle.bundle.draftRender.reviewPath,
    },
    { label: "Created", value: finalReviewBundle.bundle.createdAt },
  ];
}
