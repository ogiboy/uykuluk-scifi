import {
  StudioRouteBoundaryCard,
  StudioRouteBoundaryHeader,
} from "@/components/studio/StudioRouteBoundaryCard";
import { StudioShell } from "@/components/studio/StudioShell";
import { runDetailNotFoundCopy } from "@/lib/studioRouteBoundaryCopy";

/**
 * Renders the run-detail not-found boundary.
 *
 * @returns Safe recovery guidance when a run id cannot be resolved to a local run record.
 */
export default function RunDetailNotFoundPage() {
  return (
    <StudioShell>
      <StudioRouteBoundaryHeader copy={runDetailNotFoundCopy} />

      <StudioRouteBoundaryCard
        description={runDetailNotFoundCopy.description}
        headingId={runDetailNotFoundCopy.recoveryHeadingId}
        title={runDetailNotFoundCopy.recoveryTitle}
      />
    </StudioShell>
  );
}
