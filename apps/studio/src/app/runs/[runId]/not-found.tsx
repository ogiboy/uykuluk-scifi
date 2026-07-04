import { StudioRouteBoundaryCard } from "@/components/studio/StudioRouteBoundaryCard";
import { StudioShell } from "@/components/studio/StudioShell";
import { runDetailNotFoundCopy } from "@/lib/runRouteBoundaryCopy";

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
          <h1>{runDetailNotFoundCopy.heading}</h1>
        </div>
        <span className='status-pill blocked'>{runDetailNotFoundCopy.status}</span>
      </header>

      <StudioRouteBoundaryCard
        description={runDetailNotFoundCopy.description}
        headingId={runDetailNotFoundCopy.recoveryHeadingId}
        title={runDetailNotFoundCopy.recoveryTitle}
      />
    </StudioShell>
  );
}
