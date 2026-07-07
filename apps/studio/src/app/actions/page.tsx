import { ServiceContractPanel } from "@/components/ServiceContractPanel";
import { StudioActionOverviewPanel } from "@/components/studio/StudioActionOverviewPanel";
import { StudioCommandPalette } from "@/components/studio/StudioCommandPalette";
import { StudioControlDesk } from "@/components/studio/StudioControlDesk";
import { StudioPageHeader } from "@/components/studio/StudioPageHeader";
import { StudioShell } from "@/components/studio/StudioShell";
import { StudioWorkflowMatrixPanel } from "@/components/studio/actions/StudioWorkflowMatrixPanel";
import { Badge } from "@/components/ui/badge";
import { getStudioActionServiceStatus } from "@/lib/actionServiceStatus";
import { getStudioDoctorOverview } from "@/lib/doctorOverview";
import { listStudioRuns } from "@/lib/runSummaries";

export const dynamic = "force-dynamic";

/**
 * Renders the guarded Studio action surface.
 *
 * @returns The operator control desk focused on guarded local actions.
 */
export default async function ActionsPage() {
  const actionStatus = getStudioActionServiceStatus();
  const [doctorOverview, runs] = await Promise.all([getStudioDoctorOverview(), listStudioRuns()]);

  return (
    <StudioShell>
      <StudioPageHeader
        actions={
          <>
            <StudioCommandPalette runs={runs} />
            <Badge variant='secondary'>Guarded local routes</Badge>
          </>
        }
        eyebrow='Approval-gated operator controls'
        title='Actions'
      />
      <StudioActionOverviewPanel runs={runs} status={actionStatus} />
      <StudioWorkflowMatrixPanel status={actionStatus} />
      <StudioControlDesk actionStatus={actionStatus} doctorOverview={doctorOverview} runs={runs} />
      <ServiceContractPanel status={actionStatus} />
    </StudioShell>
  );
}
