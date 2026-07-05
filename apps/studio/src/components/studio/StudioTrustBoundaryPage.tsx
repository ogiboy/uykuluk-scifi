import { StudioRouteBoundaryCard } from "./StudioRouteBoundaryCard";
import { StudioShell } from "./StudioShell";
import type { StudioRouteBoundaryCopy } from "@/lib/studioRouteBoundaryCopy";

type StudioTrustBoundaryPageProps = Readonly<{
  copy: StudioRouteBoundaryCopy;
}>;

/**
 * Renders stable Studio trust-boundary pages without enabling experimental Next auth interrupts.
 *
 * @param copy - Operator-facing boundary copy shared with route tests.
 */
export function StudioTrustBoundaryPage({ copy }: StudioTrustBoundaryPageProps) {
  return (
    <StudioShell>
      <header className='studio-header'>
        <div>
          <p className='eyebrow'>{copy.eyebrow}</p>
          <h1>{copy.heading}</h1>
        </div>
        <span className='status-pill blocked'>{copy.status}</span>
      </header>

      <StudioRouteBoundaryCard
        description={copy.description}
        headingId={copy.recoveryHeadingId}
        title={copy.recoveryTitle}
      />
    </StudioShell>
  );
}
