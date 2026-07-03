"use client";

import { useEffect } from "react";

import { StudioRouteBoundaryCard } from "@/components/studio/StudioRouteBoundaryCard";
import { Button } from "@/components/ui/button";

type StudioRouteErrorPageProps = Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>;

/**
 * Renders the Studio route-level error boundary.
 *
 * @param error - The captured route error. Only the digest is surfaced to avoid leaking paths.
 * @param reset - Next.js reset callback for retrying the local read boundary.
 */
export default function StudioRouteErrorPage({ error, reset }: StudioRouteErrorPageProps) {
  useEffect(() => {
    console.warn("Studio route failed safely.", { digest: error.digest });
  }, [error.digest]);

  return (
    <main className='studio-main page-shell' aria-labelledby='studio-error-heading'>
      <header className='studio-header'>
        <div>
          <p className='eyebrow'>Route boundary</p>
          <h1 id='studio-error-heading'>Studio page failed safely</h1>
        </div>
        <span className='status-pill blocked'>No action taken</span>
      </header>

      <StudioRouteBoundaryCard
        description='The web surface stopped at this route boundary. It did not retry approvals, change run state, upload media, publish content, or infer readiness from local files.'
        headingId='studio-error-recovery-heading'
        title='Safe recovery'
      >
        <Button onClick={reset} variant='secondary'>
          Retry local read
        </Button>
      </StudioRouteBoundaryCard>

      {error.digest ? <p className='artifact-meta'>Boundary digest: {error.digest}</p> : null}
    </main>
  );
}
