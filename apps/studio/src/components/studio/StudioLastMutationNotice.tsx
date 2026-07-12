"use client";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  clearStudioLastMutationResult,
  parseStudioLastMutationResult,
  readStudioLastMutationResultSnapshot,
  studioLastMutationResultEventName,
  type StudioLastMutationResult,
} from "@/lib/mutations/studioLastMutationResult";
import {
  studioMutationResultHref,
  studioMutationResultLinkLabel,
} from "@/lib/mutations/studioMutationResultNavigation";
import type { Route } from "next";
import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";

/**
 * Shows the latest guarded web action result after route refreshes.
 */
export function StudioLastMutationNotice() {
  const snapshot = useSyncExternalStore(
    subscribeStudioLastMutationResult,
    readStudioLastMutationResultSnapshot,
    emptyMutationSnapshot,
  );
  const result = useMemo(() => parseSnapshot(snapshot), [snapshot]);

  if (!result) {
    return null;
  }

  return (
    <section aria-labelledby='last-action-heading'>
      <Card>
        <CardHeader className='gap-4 sm:grid-cols-[1fr_auto]'>
          <div className='space-y-2'>
            <CardTitle id='last-action-heading'>Latest web action</CardTitle>
            <p className='text-muted-foreground text-sm'>{lastMutationTone(result)}</p>
          </div>
          <Button
            className='justify-self-start sm:justify-self-end'
            type='button'
            variant='ghost'
            onClick={clearStudioLastMutationResult}
          >
            Clear
          </Button>
        </CardHeader>
        <CardContent className='space-y-4'>
          <p className='text-sm'>{result.message}</p>
          <dl className='grid gap-3 text-sm sm:grid-cols-2'>
            <div className='bg-muted/20 ring-border/10 space-y-1 rounded-lg p-3 ring-1'>
              <dt className='text-muted-foreground font-medium'>Action</dt>
              <dd className='break-all'>{result.actionId}</dd>
            </div>
            <div className='bg-muted/20 ring-border/10 space-y-1 rounded-lg p-3 ring-1'>
              <dt className='text-muted-foreground font-medium'>Route</dt>
              <dd className='break-all'>{result.routePath}</dd>
            </div>
            <div className='bg-muted/20 ring-border/10 space-y-1 rounded-lg p-3 ring-1'>
              <dt className='text-muted-foreground font-medium'>Refresh</dt>
              <dd>{result.refreshedPersistedState ? "Requested" : "Not requested"}</dd>
            </div>
            {result.status ? (
              <div className='bg-muted/20 ring-border/10 space-y-1 rounded-lg p-3 ring-1'>
                <dt className='text-muted-foreground font-medium'>HTTP</dt>
                <dd>{result.status}</dd>
              </div>
            ) : null}
          </dl>
          {result.runId ? (
            <Link
              className={buttonVariants({ variant: "secondary" })}
              href={studioMutationResultHref(result.runId, result.actionId) as Route}
            >
              {studioMutationResultLinkLabel(result.actionId)}
            </Link>
          ) : null}
          {result.facts.length > 0 ? (
            <ul className='grid gap-2 text-sm' aria-label='Latest action facts'>
              {result.facts.map((fact) => (
                <li className='bg-muted/20 ring-border/10 rounded-md px-3 py-2 ring-1' key={fact}>
                  {fact}
                </li>
              ))}
            </ul>
          ) : null}
        </CardContent>
        <CardFooter className='items-center justify-between gap-3'>
          <Badge variant={mutationBadgeVariant(result)}>{result.kind}</Badge>
          <time className='text-muted-foreground text-xs' dateTime={result.recordedAtIso}>
            {result.recordedAtIso}
          </time>
        </CardFooter>
      </Card>
    </section>
  );
}

function subscribeStudioLastMutationResult(onStoreChange: () => void): () => void {
  globalThis.addEventListener(studioLastMutationResultEventName, onStoreChange);
  globalThis.addEventListener("storage", onStoreChange);
  return () => {
    globalThis.removeEventListener(studioLastMutationResultEventName, onStoreChange);
    globalThis.removeEventListener("storage", onStoreChange);
  };
}

function emptyMutationSnapshot(): string {
  return "";
}

function parseSnapshot(snapshot: string): StudioLastMutationResult | null {
  if (!snapshot) {
    return null;
  }
  try {
    return parseStudioLastMutationResult(JSON.parse(snapshot));
  } catch {
    return null;
  }
}

function lastMutationTone(result: StudioLastMutationResult): string {
  switch (result.kind) {
    case "success":
      return "Guarded route completed and refreshed local state.";
    case "blocked":
      return "CLI/core blocked the action after route checks passed.";
    case "error":
      return "The guarded route failed before a completed local action.";
  }
}

function mutationBadgeVariant(result: StudioLastMutationResult): "destructive" | "secondary" {
  if (result.kind === "success") {
    return "secondary";
  }
  return "destructive";
}
