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
  return (
    <section className='panel' aria-labelledby='final-review-bundle-heading'>
      <h2 id='final-review-bundle-heading'>Final Review Bundle</h2>
      <p>
        <span className={finalReviewBundleStatusClassName(finalReviewBundle.kind)}>
          {finalReviewBundle.kind}
        </span>{" "}
        {finalReviewBundle.message}
      </p>
      {finalReviewBundle.kind === "present" ? (
        <dl className='run-metadata'>
          <div>
            <dt>Status</dt>
            <dd>{finalReviewBundle.bundle.status}</dd>
          </div>
          <div>
            <dt>Review handoff</dt>
            <dd>{finalReviewBundle.reviewPath}</dd>
          </div>
          <div>
            <dt>Timestamped draft map</dt>
            <dd>{finalReviewBundle.bundle.draftRender.reviewPath}</dd>
          </div>
          <div>
            <dt>Created</dt>
            <dd>{finalReviewBundle.bundle.createdAt}</dd>
          </div>
        </dl>
      ) : null}
      {finalReviewBundle.nextAction ? (
        <p className='artifact-action'>Next action: {finalReviewBundle.nextAction}</p>
      ) : null}
      <p>Read-only display. Upload and public publishing remain disabled.</p>
    </section>
  );
}

function finalReviewBundleStatusClassName(
  status: StudioRunDetail["finalReviewBundle"]["kind"],
): string {
  if (status === "present") {
    return "status-pill small";
  }
  if (status === "missing") {
    return "status-pill small warning";
  }
  return "status-pill small blocked";
}
