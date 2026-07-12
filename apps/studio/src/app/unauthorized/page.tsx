import { StudioTrustBoundaryPage } from "@/components/studio/StudioTrustBoundaryPage";
import { studioUnauthorizedCopy } from "@/lib/routing/studioRouteBoundaryCopy";

/**
 * Renders a stable Studio unauthorized boundary route.
 *
 * @returns Operator-facing guidance for missing local web-control session proof.
 */
export default function StudioUnauthorizedPage() {
  return <StudioTrustBoundaryPage copy={studioUnauthorizedCopy} />;
}
