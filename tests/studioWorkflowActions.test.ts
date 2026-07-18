import { describe, expect, it } from "vitest";

import { getStudioActionServiceStatus } from "../apps/studio/src/lib/actionServiceStatus";
import { studioWorkflowActionSteps } from "../apps/studio/src/lib/actions/studioWorkflowActions";
import { studioMutationActionIds } from "../src/studio/actionServiceMetadata";

describe("Studio workflow action matrix", () => {
  it("orders guarded web controls by the v1 production workflow", () => {
    const steps = studioWorkflowActionSteps(getStudioActionServiceStatus());

    expect(steps.map((step) => step.label)).toEqual([
      "Idea intake",
      "Script review",
      "Production planning",
      "Proof and readiness",
      "Voice and visual audition",
      "Production media review",
      "Final local decision",
      "Feedback and evaluation",
      "Deferred external actions",
    ]);
    expect(steps[0].actions.map((action) => action.actionId)).toEqual([
      "doctor.run",
      "settings.save",
      "promptProfiles.save",
      "episodes.create",
      "providers.elevenlabs.smoke",
      "idea.approve",
    ]);
    expect(
      steps
        .flatMap((step) => step.actions)
        .filter(
          (action) =>
            action.actionId === "upload.private" || action.actionId === "publish.schedule",
        )
        .map((action) => action.status),
    ).toEqual(["disabled", "disabled"]);
    expect(
      steps.flatMap((step) => step.actions).filter((action) => action.status === "unrouted"),
    ).toEqual([]);
    const actualActionIds = steps.flatMap((step) => step.actions).map((action) => action.actionId);
    const expectedActionIds = studioMutationActionIds.filter(
      (actionId) => actionId !== "ideas.run",
    );
    actualActionIds.sort((left, right) => left.localeCompare(right, "en"));
    expectedActionIds.sort((left, right) => left.localeCompare(right, "en"));
    expect(actualActionIds).toEqual(expectedActionIds);
  });
});
