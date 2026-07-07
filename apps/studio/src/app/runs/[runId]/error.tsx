"use client";

import { useEffect } from "react";

import {
  StudioRouteBoundaryCard,
  StudioRouteBoundaryHeader,
} from "@/components/studio/StudioRouteBoundaryCard";
import { Button } from "@/components/ui/button";
import { runDetailErrorCopy } from "@/lib/studioRouteBoundaryCopy";

type RunDetailErrorPageProps = Readonly<{ error: Error & { digest?: string }; reset: () => void }>;

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
    <main
      className='text-foreground mx-auto grid min-h-screen max-w-5xl content-start gap-6 px-6 py-8 md:px-10'
      aria-labelledby='run-detail-error-heading'
    >
      <StudioRouteBoundaryHeader copy={runDetailErrorCopy} headingId='run-detail-error-heading' />

      <StudioRouteBoundaryCard
        description={runDetailErrorCopy.description}
        headingId={runDetailErrorCopy.recoveryHeadingId}
        title={runDetailErrorCopy.recoveryTitle}
      >
        <Button onClick={reset} type='button' variant='secondary'>
          Retry local run read
        </Button>
      </StudioRouteBoundaryCard>

      {error.digest ? (
        <p className='text-muted-foreground text-sm'>Boundary digest: {error.digest}</p>
      ) : null}
    </main>
  );
}
