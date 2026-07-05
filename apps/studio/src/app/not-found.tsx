import { StudioRouteBoundaryCard } from "@/components/studio/StudioRouteBoundaryCard";
import { StudioShell } from "@/components/studio/StudioShell";
import { studioNotFoundCopy } from "@/lib/studioRouteBoundaryCopy";

/**
 * Renders the Studio route-level not-found boundary.
 *
 * @returns Safe recovery guidance for unknown Studio routes or missing local run resources.
 */
export default function StudioNotFoundPage() {
  return (
    <StudioShell>
      <header className='studio-header'>
        <div>
          <p className='eyebrow'>{studioNotFoundCopy.eyebrow}</p>
          <h1>{studioNotFoundCopy.heading}</h1>
        </div>
        <span className='status-pill blocked'>{studioNotFoundCopy.status}</span>
      </header>

      <StudioRouteBoundaryCard
        description={studioNotFoundCopy.description}
        headingId={studioNotFoundCopy.recoveryHeadingId}
        title={studioNotFoundCopy.recoveryTitle}
      />
    </StudioShell>
  );
}
