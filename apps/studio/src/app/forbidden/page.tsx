import { StudioTrustBoundaryPage } from "@/components/studio/StudioTrustBoundaryPage";

/**
 * Renders a stable Studio forbidden boundary route.
 *
 * @returns Operator-facing guidance for rejected unsafe web-control attempts.
 */
export default function StudioForbiddenPage() {
  return (
    <StudioTrustBoundaryPage
      description='Studio rejected this web-control attempt before it reached CLI/core execution. Check same-origin access, the expected action contract, and the current readiness/evidence state before retrying.'
      eyebrow='403 trust boundary'
      headingId='studio-forbidden-recovery-heading'
      statusLabel='Request blocked'
      title='Studio action blocked'
    />
  );
}
