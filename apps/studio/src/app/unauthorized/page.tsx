import { StudioTrustBoundaryPage } from "@/components/studio/StudioTrustBoundaryPage";

/**
 * Renders a stable Studio unauthorized boundary route.
 *
 * @returns Operator-facing guidance for missing local web-control session proof.
 */
export default function StudioUnauthorizedPage() {
  return (
    <StudioTrustBoundaryPage
      description='Studio could not verify a valid local web-control session. Refresh the local session from the operator desk before retrying any approval or review action. No producer state was changed.'
      eyebrow='401 trust boundary'
      headingId='studio-unauthorized-recovery-heading'
      statusLabel='Session required'
      title='Local web session required'
    />
  );
}
