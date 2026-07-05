"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  readStudioMutationSessionSnapshot,
  refreshStudioMutationSession,
  type StudioMutationSessionSnapshot,
} from "@/lib/studioMutationClient";

type SessionPanelState = Readonly<{
  message: string;
  snapshot: StudioMutationSessionSnapshot;
  tone: "error" | "idle" | "ready" | "refreshing";
}>;

/**
 * Renders an operator-visible local session control for guarded Studio mutations.
 *
 * @returns The Studio mutation session status and refresh action.
 */
export function StudioMutationSessionPanel() {
  const initialState = useMemo<SessionPanelState>(
    () => ({
      message:
        "Guarded web actions request a short-lived same-origin local session automatically. Refresh manually only after an authorization warning.",
      snapshot: readStudioMutationSessionSnapshot(),
      tone: "idle",
    }),
    [],
  );
  const [state, setState] = useState(initialState);

  async function refreshSession(): Promise<void> {
    setState((current) => ({
      ...current,
      message: "Refreshing local guarded session...",
      tone: "refreshing",
    }));
    try {
      const snapshot = await refreshStudioMutationSession();
      setState({
        message: "Local guarded session ready. Upload and publish remain disabled.",
        snapshot,
        tone: "ready",
      });
      toast.success("Local session ready", {
        description: "Approval and review actions can now submit guarded local mutations.",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Studio local session could not be established.";
      setState({
        message,
        snapshot: { status: "missing" },
        tone: "error",
      });
      toast.error("Local session refresh failed", { description: message });
    }
  }

  return (
    <section aria-labelledby='studio-session-heading'>
      <Card>
        <CardHeader className='gap-4 sm:grid-cols-[1fr_auto]'>
          <div className='space-y-2'>
            <CardTitle id='studio-session-heading'>Local web control session</CardTitle>
            <p className='text-sm text-muted-foreground'>
              Used automatically for same-origin approval and review actions in Studio.
            </p>
          </div>
          <Badge
            className='justify-self-start sm:justify-self-end'
            variant={state.tone === "error" ? "destructive" : "secondary"}
          >
            {state.snapshot.status === "ready" ? "ready" : "not ready"}
          </Badge>
        </CardHeader>
        <CardContent className='space-y-3'>
          <p className='text-sm'>{state.message}</p>
          {state.snapshot.status === "ready" ? (
            <code className='block max-w-full break-all rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground'>
              Expires in about {state.snapshot.expiresInSeconds} seconds.
            </code>
          ) : (
            <p className='text-sm text-muted-foreground'>
              Studio will request a matching HttpOnly cookie and session header before a mutation.
            </p>
          )}
        </CardContent>
        <CardFooter>
          <Button
            disabled={state.tone === "refreshing"}
            type='button'
            variant='secondary'
            onClick={refreshSession}
          >
            {state.tone === "refreshing" ? "Refreshing..." : "Refresh local session"}
          </Button>
        </CardFooter>
      </Card>
    </section>
  );
}
