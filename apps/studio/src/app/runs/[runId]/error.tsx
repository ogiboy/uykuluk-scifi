"use client";

import { useEffect } from "react";

import { StudioRouteBoundaryCard } from "@/components/studio/StudioRouteBoundaryCard";
import { Button } from "@/components/ui/button";

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
          <h1 id='run-detail-error-heading'>Run review failed safely</h1>
        </div>
        <span className='status-pill blocked'>No action taken</span>
      </header>

      <StudioRouteBoundaryCard
        description='The web surface stopped while reading this run. It did not retry approvals, change run state, trust artifacts without evidence, upload media, or publish content.'
        headingId='run-detail-error-recovery-heading'
        title='Safe recovery'
      >
        <Button onClick={reset} variant='secondary'>
          Retry local run read
        </Button>
      </StudioRouteBoundaryCard>

      {error.digest ? <p className='artifact-meta'>Boundary digest: {error.digest}</p> : null}
    </main>
  );
}
