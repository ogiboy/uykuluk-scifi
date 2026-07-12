"use client";

import { Button } from "@/components/ui/button";
import { captureStudioUnexpectedError } from "@/lib/observability/studioObservability";
import { useEffect } from "react";

type StudioGlobalErrorProps = Readonly<{ error: Error & { digest?: string }; reset: () => void }>;

/**
 * Captures otherwise-unhandled App Router failures while keeping recovery local and explicit.
 *
 * @param error - The unhandled App Router error.
 * @param reset - Next.js callback for retrying the failed tree.
 */
export default function StudioGlobalError({ error, reset }: StudioGlobalErrorProps) {
  useEffect(() => {
    captureStudioUnexpectedError(error, { boundary: "route-render" });
  }, [error]);

  return (
    <html lang='en'>
      <body>
        <main className='grid min-h-screen place-items-center p-6'>
          <section className='bg-card text-card-foreground grid max-w-lg gap-4 rounded-xl p-6 shadow-sm'>
            <p className='text-muted-foreground text-xs font-semibold tracking-[0.18em] uppercase'>
              Studio boundary
            </p>
            <h1 className='text-xl font-semibold'>Studio stopped safely</h1>
            <p className='text-muted-foreground text-sm'>
              No approval, upload, scheduling, or publish action was inferred from this failure.
            </p>
            <Button type='button' onClick={reset}>
              Retry Studio
            </Button>
          </section>
        </main>
      </body>
    </html>
  );
}
