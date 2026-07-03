import { StudioRouteBoundaryCard } from "@/components/studio/StudioRouteBoundaryCard";
import { StudioShell } from "@/components/studio/StudioShell";

/**
 * Renders the run-detail not-found boundary.
 *
 * @returns Safe recovery guidance when a run id cannot be resolved to a local run record.
 */
export default function RunDetailNotFoundPage() {
  return (
    <StudioShell>
      <header className='studio-header'>
        <div>
          <p className='eyebrow'>Run review boundary</p>
          <h1>Run not found</h1>
        </div>
        <span className='status-pill blocked'>No action taken</span>
      </header>

      <StudioRouteBoundaryCard
        description='Studio could not resolve this local run record. Missing run files never imply approval, readiness, upload permission, or publish permission. Return to the run queue and choose a current run before taking the next operator action.'
        headingId='run-detail-not-found-recovery-heading'
        title='Safe next step'
      />
    </StudioShell>
  );
}
