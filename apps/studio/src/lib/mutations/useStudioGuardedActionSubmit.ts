"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { writeStudioLastMutationResult } from "./studioLastMutationResult";
import type { StudioMutationRecordSummary } from "./studioMutationResultSummary";
import { submitStudioJsonMutation, type StudioMutationSubmitResult } from "./studioMutationSubmit";

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
export type StudioGuardedActionClientErrorInput = Readonly<{
  actionId: string;
  message: string;
  routePath: string;
  toastTitle: string;
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

  async function submit(
    input: StudioGuardedActionSubmitInput,
  ): Promise<StudioMutationSubmitResult> {
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
      const blockedMessage = messageWithWarnings(result.message, result.warnings);
      setState({
        action: blockedAction,
        kind: "blocked",
        message: blockedMessage,
        recordSummary: result.recordSummary,
        status: result.status,
      });
      writeLastMutationResult("blocked", blockedAction, blockedMessage, result.recordSummary, {
        status: result.status,
      });
      toast.warning(input.errorToastTitle, {
        description: `${blockedMessage} Studio is refreshing persisted local state.`,
      });
      router.refresh();
      return result;
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
      return result;
    }
    const completedAction = actionMetadata(input, true);
    const completedMessage = messageWithWarnings(input.successMessage, result.warnings);
    setState({
      action: completedAction,
      kind: "success",
      message: completedMessage,
      recordSummary: result.recordSummary,
    });
    writeLastMutationResult("success", completedAction, completedMessage, result.recordSummary);
    if (result.warnings.length > 0) {
      toast.warning(`${input.successToastTitle} with cleanup warning`, {
        description: result.warnings.join(" "),
      });
    } else {
      toast.success(input.successToastTitle, {
        description: "Studio is refreshing the persisted run detail.",
      });
    }
    router.refresh();
    return result;
  }

  function reportError(input: StudioGuardedActionClientErrorInput): void {
    const action = {
      actionId: input.actionId,
      refreshedPersistedState: false,
      routePath: input.routePath,
    };
    setState({ action, kind: "error", message: input.message });
    writeLastMutationResult("error", action, input.message, null);
    toast.error(input.toastTitle, { description: input.message });
  }

  return { reportError, state, submit };
}

function messageWithWarnings(message: string, warnings: readonly string[]): string {
  return warnings.length > 0 ? `${message} ${warnings.join(" ")}` : message;
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
  return { actionId: input.actionId, refreshedPersistedState, routePath: input.routePath };
}
