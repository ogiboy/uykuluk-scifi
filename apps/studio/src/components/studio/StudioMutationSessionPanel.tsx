"use client";

import { useMemo, useState } from "react";
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
        "Guarded web actions use a short-lived same-origin local session. Refresh before approval work.",
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
    } catch (error) {
      setState({
        message:
          error instanceof Error ? error.message : "Studio local session could not be established.",
        snapshot: { status: "missing" },
        tone: "error",
      });
    }
  }

  return (
    <section className='panel compact-panel' aria-labelledby='studio-session-heading'>
      <div className='artifact-preview-header'>
        <div>
          <h3 id='studio-session-heading'>Local web control session</h3>
          <p className='artifact-description'>
            Required for same-origin approval and review actions in Studio.
          </p>
        </div>
        <span className={sessionPillClassName(state)}>
          {state.snapshot.status === "ready" ? "ready" : "not ready"}
        </span>
      </div>
      <p>{state.message}</p>
      {state.snapshot.status === "ready" ? (
        <p className='artifact-action'>
          Expires in about {state.snapshot.expiresInSeconds} seconds.
        </p>
      ) : (
        <p className='artifact-action'>
          No mutation is trusted without a matching HttpOnly cookie and session header.
        </p>
      )}
      <button
        className='studio-action-button'
        disabled={state.tone === "refreshing"}
        type='button'
        onClick={refreshSession}
      >
        {state.tone === "refreshing" ? "Refreshing..." : "Refresh local session"}
      </button>
    </section>
  );
}

function sessionPillClassName(state: SessionPanelState): string {
  if (state.tone === "error") {
    return "status-pill small blocked";
  }
  return "status-pill small";
}
