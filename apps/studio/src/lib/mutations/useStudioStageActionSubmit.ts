"use client";

import { useState } from "react";
import { stageActionForRun } from "../actions/studioStageAction";
import type { StudioRunDetail } from "../runSummaries";
import { useStudioGuardedActionSubmit } from "./useStudioGuardedActionSubmit";

export type StudioStageActionSubmitMessages = Readonly<{
  errorToastTitle: string;
  fallbackError: string;
  idleMessage: string;
  submittingMessage: string;
  successMessage: string;
  successToastTitle: string;
}>;

export type StudioStageActionSubmitRun = Pick<
  StudioRunDetail,
  "nextRecommendedCommand" | "runId" | "state"
>;

/**
 * Shares guarded workflow-stage submit state between full and compact run controls.
 *
 * @param run - The run projection used to resolve and submit the current stage action.
 * @param messages - Operator-facing lifecycle copy for the specific surface.
 * @returns The resolved action, confirmation state, submit state, and submit function.
 */
export function useStudioStageActionSubmit(
  run: StudioStageActionSubmitRun,
  messages: StudioStageActionSubmitMessages,
) {
  const action = stageActionForRun(run);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const { state, submit } = useStudioGuardedActionSubmit(messages.idleMessage);

  async function submitStageAction(): Promise<void> {
    if (!action) return;
    setConfirmationOpen(false);
    await submit({
      actionId: action.actionId,
      body: { runId: run.runId },
      errorToastTitle: messages.errorToastTitle,
      fallbackError: messages.fallbackError,
      routePath: action.routePath,
      submittingMessage: messages.submittingMessage,
      successMessage: messages.successMessage,
      successToastTitle: messages.successToastTitle,
    });
  }

  return { action, confirmationOpen, setConfirmationOpen, state, submitStageAction };
}
