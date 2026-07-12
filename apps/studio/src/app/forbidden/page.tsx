import { StudioTrustBoundaryPage } from "@/components/studio/StudioTrustBoundaryPage";
import { studioForbiddenCopy } from "@/lib/routing/studioRouteBoundaryCopy";

/**
 * Renders a stable Studio forbidden boundary route.
 *
 * @returns Operator-facing guidance for rejected unsafe web-control attempts.
 */
export default function StudioForbiddenPage() {
  return <StudioTrustBoundaryPage copy={studioForbiddenCopy} />;
}
