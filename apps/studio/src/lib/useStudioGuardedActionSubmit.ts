"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { writeStudioLastMutationResult } from "./studioLastMutationResult";
import type { StudioMutationRecordSummary } from "./studioMutationResultSummary";
import { submitStudioJsonMutation } from "./studioMutationSubmit";

export type StudioGuardedActionSubmitState =
  | { kind: "idle"; message: string }
  | { action: StudioGuardedActionMetadata; kind: "submitting"; message: string }
  | {
      action: StudioGuardedActionMetadata;
      kind: "success";
      message: string;
      recordSummary: StudioMutationRecordSummary | null;
    }
  | {
      action: StudioGuardedActionMetadata;
      kind: "blocked";
      message: string;
      recordSummary: StudioMutationRecordSummary | null;
      status: number;
    }
  | { action: StudioGuardedActionMetadata; kind: "error"; message: string; status?: number };

export type StudioGuardedActionMetadata = Readonly<{
  actionId: string;
  refreshedPersistedState: boolean;
  routePath: string;
}>;

export type StudioGuardedActionSubmitInput = Readonly<{
  actionId: string;
  body: unknown;
  errorToastTitle: string;
  fallbackError: string;
  routePath: string;
  submittingMessage: string;
  successMessage: string;
  successToastTitle: string;
}>;

/**
 * Tracks the guarded Studio mutation submit lifecycle shared by action panels: state
 * transitions, operator-facing toasts, and refreshing the persisted run detail on success.
 *
 * @param idleMessage - The initial idle-state operator message.
 * @returns The current submit state and a `submit` function that runs a guarded mutation.
 */
export function useStudioGuardedActionSubmit(idleMessage: string) {
  const router = useRouter();
  const [state, setState] = useState<StudioGuardedActionSubmitState>({
    kind: "idle",
    message: idleMessage,
  });

  async function submit(input: StudioGuardedActionSubmitInput): Promise<void> {
    const startedAction = actionMetadata(input, false);
    setState({ action: startedAction, kind: "submitting", message: input.submittingMessage });
    const result = await submitStudioJsonMutation({
      actionId: input.actionId,
      body: input.body,
      fallbackError: input.fallbackError,
      routePath: input.routePath,
    });
    if (result.kind === "blocked") {
      const blockedAction = actionMetadata(input, true);
      setState({
        action: blockedAction,
        kind: "blocked",
        message: result.message,
        recordSummary: result.recordSummary,
        status: result.status,
      });
      writeLastMutationResult("blocked", blockedAction, result.message, result.recordSummary, {
        status: result.status,
      });
      toast.warning(input.errorToastTitle, {
        description: `${result.message} Studio is refreshing persisted local state.`,
      });
      router.refresh();
      return;
    }
    if (result.kind === "error") {
      setState({
        action: startedAction,
        kind: "error",
        message: result.message,
        status: result.status,
      });
      writeLastMutationResult("error", startedAction, result.message, null, {
        status: result.status,
      });
      toast.error(input.errorToastTitle, { description: result.message });
      return;
    }
    const completedAction = actionMetadata(input, true);
    setState({
      action: completedAction,
      kind: "success",
      message: input.successMessage,
      recordSummary: result.recordSummary,
    });
    writeLastMutationResult("success", completedAction, input.successMessage, result.recordSummary);
    toast.success(input.successToastTitle, {
      description: "Studio is refreshing the persisted run detail.",
    });
    router.refresh();
  }

  return { state, submit };
}

function writeLastMutationResult(
  kind: "blocked" | "error" | "success",
  action: StudioGuardedActionMetadata,
  message: string,
  recordSummary: StudioMutationRecordSummary | null,
  options: Readonly<{ status?: number }> = {},
): void {
  writeStudioLastMutationResult({
    actionId: action.actionId,
    facts: recordSummary?.facts ?? [],
    kind,
    message,
    recordedAtIso: new Date().toISOString(),
    refreshedPersistedState: action.refreshedPersistedState,
    routePath: action.routePath,
    runId: recordSummary?.runId ?? null,
    status: options.status,
  });
}

function actionMetadata(
  input: StudioGuardedActionSubmitInput,
  refreshedPersistedState: boolean,
): StudioGuardedActionMetadata {
  return {
    actionId: input.actionId,
    refreshedPersistedState,
    routePath: input.routePath,
  };
}
