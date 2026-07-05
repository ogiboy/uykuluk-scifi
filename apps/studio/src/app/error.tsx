"use client";

import { useEffect } from "react";

import {
  StudioRouteBoundaryCard,
  StudioRouteBoundaryHeader,
} from "@/components/studio/StudioRouteBoundaryCard";
import { Button } from "@/components/ui/button";
import { studioErrorCopy } from "@/lib/studioRouteBoundaryCopy";

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
    <main
      className='mx-auto grid min-h-screen max-w-5xl content-start gap-6 px-6 py-8 text-foreground md:px-10'
      aria-labelledby='studio-error-heading'
    >
      <StudioRouteBoundaryHeader copy={studioErrorCopy} headingId='studio-error-heading' />

      <StudioRouteBoundaryCard
        description={studioErrorCopy.description}
        headingId={studioErrorCopy.recoveryHeadingId}
        title={studioErrorCopy.recoveryTitle}
      >
        <Button onClick={reset} type='button' variant='secondary'>
          Retry local read
        </Button>
      </StudioRouteBoundaryCard>

      {error.digest ? (
        <p className='text-sm text-muted-foreground'>Boundary digest: {error.digest}</p>
      ) : null}
    </main>
  );
}
