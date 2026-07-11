"use client";

import { StudioMutationResultPanel } from "@/components/studio/StudioMutationResultPanel";
import { Button } from "@/components/ui/button";
import { useStudioGuardedActionSubmit } from "@/lib/useStudioGuardedActionSubmit";

type AnalyticsReportActionPanelProps = Readonly<{ compact?: boolean; showResult?: boolean }>;

/**
 * Renders the guarded Studio action that refreshes the manual analytics report.
 *
 * @param compact - Whether the panel is embedded in a compact status card.
 * @param showResult - Whether mutation feedback should render after the button.
 */
export function AnalyticsReportActionPanel({
  compact = false,
  showResult = true,
}: AnalyticsReportActionPanelProps) {
  const { state, submit } = useStudioGuardedActionSubmit(
    "Refreshes the local analytics report from saved operator-provided analytics data.",
  );

  async function refreshReport(): Promise<void> {
    await submit({
      actionId: "analytics.report",
      body: {},
      errorToastTitle: "Analytics report refresh was blocked",
      fallbackError: "Analytics report could not be refreshed.",
      routePath: "/actions/analytics-report",
      submittingMessage: "Refreshing analytics report...",
      successMessage: "Analytics report refreshed from saved local data.",
      successToastTitle: "Analytics report refreshed",
    });
  }

  return (
    <div className='grid gap-3'>
      <Button
        disabled={state.kind === "submitting"}
        type='button'
        variant={compact ? "secondary" : "default"}
        onClick={() => void refreshReport()}
      >
        {state.kind === "submitting" ? "Refreshing report..." : "Refresh analytics report"}
      </Button>
      {showResult && state.kind !== "idle" ? <StudioMutationResultPanel state={state} /> : null}
    </div>
  );
}
