import {
  StudioRouteBoundaryCard,
  StudioRouteBoundaryHeader,
} from "@/components/studio/StudioRouteBoundaryCard";
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
      <StudioRouteBoundaryHeader copy={studioNotFoundCopy} />

      <StudioRouteBoundaryCard
        description={studioNotFoundCopy.description}
        headingId={studioNotFoundCopy.recoveryHeadingId}
        title={studioNotFoundCopy.recoveryTitle}
      />
    </StudioShell>
  );
}
