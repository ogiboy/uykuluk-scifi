"use client";

import { useEffect } from "react";

import { StudioRouteBoundaryCard } from "@/components/studio/StudioRouteBoundaryCard";
import { Button } from "@/components/ui/button";
import { runDetailErrorCopy } from "@/lib/runRouteBoundaryCopy";

type RunDetailErrorPageProps = Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>;

/**
 * Renders the run-detail route error boundary.
 *
 * @param error - The captured route error. Only the digest is surfaced to avoid leaking local paths.
 * @param reset - Next.js reset callback for retrying the local run read.
 */
export default function RunDetailErrorPage({ error, reset }: RunDetailErrorPageProps) {
  useEffect(() => {
    console.warn("Run detail route failed safely.", { digest: error.digest });
  }, [error.digest]);

  return (
    <main className='studio-main page-shell' aria-labelledby='run-detail-error-heading'>
      <header className='studio-header'>
        <div>
          <p className='eyebrow'>Run review boundary</p>
          <h1 id='run-detail-error-heading'>{runDetailErrorCopy.heading}</h1>
        </div>
        <span className='status-pill blocked'>{runDetailErrorCopy.status}</span>
      </header>

      <StudioRouteBoundaryCard
        description={runDetailErrorCopy.description}
        headingId={runDetailErrorCopy.recoveryHeadingId}
        title={runDetailErrorCopy.recoveryTitle}
      >
        <Button onClick={reset} variant='secondary'>
          Retry local run read
        </Button>
      </StudioRouteBoundaryCard>

      {error.digest ? <p className='artifact-meta'>Boundary digest: {error.digest}</p> : null}
    </main>
  );
}
