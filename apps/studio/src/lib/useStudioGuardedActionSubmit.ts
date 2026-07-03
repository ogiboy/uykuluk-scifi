"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { submitStudioJsonMutation } from "./studioMutationSubmit";

export type StudioGuardedActionSubmitState =
  | { kind: "idle"; message: string }
  | { kind: "submitting"; message: string }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

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
    setState({ kind: "submitting", message: input.submittingMessage });
    const result = await submitStudioJsonMutation({
      actionId: input.actionId,
      body: input.body,
      fallbackError: input.fallbackError,
      routePath: input.routePath,
    });
    if (result.kind === "error") {
      setState(result);
      toast.error(input.errorToastTitle, { description: result.message });
      return;
    }
    setState({ kind: "success", message: input.successMessage });
    toast.success(input.successToastTitle, {
      description: "Studio is refreshing the persisted run detail.",
    });
    router.refresh();
  }

  return { state, submit };
}