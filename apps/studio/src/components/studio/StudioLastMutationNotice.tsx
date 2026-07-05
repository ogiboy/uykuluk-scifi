"use client";

import { useMemo, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import {
  clearStudioLastMutationResult,
  parseStudioLastMutationResult,
  readStudioLastMutationResultSnapshot,
  studioLastMutationResultEventName,
  type StudioLastMutationResult,
} from "@/lib/studioLastMutationResult";

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
    <section
      className='panel compact-panel last-mutation-notice'
      aria-labelledby='last-action-heading'
    >
      <div className='artifact-preview-header'>
        <div>
          <h3 id='last-action-heading'>Latest web action</h3>
          <p className='artifact-description'>{lastMutationTone(result)}</p>
        </div>
        <Button type='button' variant='ghost' onClick={clearStudioLastMutationResult}>
          Clear
        </Button>
      </div>
      <p>{result.message}</p>
      <dl className='decision-list'>
        <div>
          <dt>Action</dt>
          <dd>{result.actionId}</dd>
        </div>
        <div>
          <dt>Route</dt>
          <dd>{result.routePath}</dd>
        </div>
        <div>
          <dt>Refresh</dt>
          <dd>{result.refreshedPersistedState ? "Requested" : "Not requested"}</dd>
        </div>
        {result.status ? (
          <div>
            <dt>HTTP</dt>
            <dd>{result.status}</dd>
          </div>
        ) : null}
      </dl>
      {result.facts.length > 0 ? (
        <ul className='last-mutation-facts' aria-label='Latest action facts'>
          {result.facts.map((fact) => (
            <li key={fact}>{fact}</li>
          ))}
        </ul>
      ) : null}
      <time dateTime={result.recordedAtIso}>{result.recordedAtIso}</time>
    </section>
  );
}

function subscribeStudioLastMutationResult(onStoreChange: () => void): () => void {
  window.addEventListener(studioLastMutationResultEventName, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(studioLastMutationResultEventName, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
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
