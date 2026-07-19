import path from "node:path";
import { expect } from "vitest";
import {
  disabledStudioActionRoutes,
  enabledStudioActionRoutes,
  readOnlyStudioRoutes,
  routeSecurityFindings,
  studioSessionRoutes,
} from "../apps/studio/src/lib/routeSecurity";
import { discoverRouteHandlers } from "./studioRouteSecurityHelpers";

/**
 * Verifies that discovered Studio action route handlers and their security metadata match the expected contract.
 *
 * @param appRoot - The root directory of the Studio application
 */
export async function expectStudioActionRouteContract(appRoot: string): Promise<void> {
  await expect(discoverRouteHandlers(appRoot)).resolves.toEqual(
    [
      "actions/analytics-import/route.ts",
      "actions/analytics-report/route.ts",
      "actions/approve-cost/route.ts",
      "actions/approve-idea/route.ts",
      "actions/approve-render/route.ts",
      "actions/approve-script/route.ts",
      "actions/decide-channel-handoff/route.ts",
      "actions/decide-render/route.ts",
      "actions/elevenlabs-smoke/route.ts",
      "actions/episode-create/route.ts",
      "actions/local-models-execute/route.ts",
      "actions/local-models-prepare/route.ts",
      "actions/prompt-profiles-save/route.ts",
      "actions/review-render-plan/route.ts",
      "actions/review-render/route.ts",
      "actions/review-script/route.ts",
      "actions/review-voice/route.ts",
      "actions/revise-package-artifact/route.ts",
      "actions/revise-render/route.ts",
      "actions/revise-script/route.ts",
      "actions/run-channel-handoff/route.ts",
      "actions/run-doctor/route.ts",
      "actions/run-estimate/route.ts",
      "actions/run-evidence/route.ts",
      "actions/run-ideas/route.ts",
      "actions/run-model-eval-candidates/route.ts",
      "actions/run-model-eval/route.ts",
      "actions/run-package/route.ts",
      "actions/run-readiness/route.ts",
      "actions/run-render-plan/route.ts",
      "actions/run-render/route.ts",
      "actions/run-review-bundle/route.ts",
      "actions/run-script/route.ts",
      "actions/run-voice/route.ts",
      "actions/session/route.ts",
      "actions/settings-save/route.ts",
      "actions/soundtrack-analyze/route.ts",
      "actions/soundtrack-configure/route.ts",
      "actions/soundtrack-decide/route.ts",
      "actions/soundtrack-import/route.ts",
      "actions/soundtrack-prepare/route.ts",
      "actions/visuals-activate-revision/route.ts",
      "actions/visuals-decide/route.ts",
      "actions/visuals-generate-hosted/route.ts",
      "actions/visuals-generate-local/route.ts",
      "actions/visuals-import/route.ts",
      "actions/visuals-plan-hosted/route.ts",
      "actions/visuals-prepare/route.ts",
      "actions/visuals-regenerate/route.ts",
      "actions/voice-candidates/route.ts",
      "actions/voice-preview/route.ts",
      "actions/voice-reselect/route.ts",
      "actions/voice-select/route.ts",
      "provider-smokes/elevenlabs/[operationId]/audio/route.ts",
      "runs/[runId]/media/[...artifactPath]/route.ts",
      "runs/[runId]/visuals/[sceneIndex]/route.ts",
    ].map((routePath) => path.join(appRoot, routePath)),
  );
  expect(routeSecurityFindings()).toEqual([]);
  expect(readOnlyStudioRoutes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        allowedMethods: ["GET"],
        enabled: true,
        path: "/provider-smokes/elevenlabs/[operationId]/audio",
        requiredApproval: "none",
        risk: "read-only",
      }),
    ]),
  );
  expect(enabledStudioActionRoutes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        allowedMethods: ["POST"],
        disabledReason: null,
        enabled: true,
        path: "/actions/approve-idea",
        requiredApproval: "idea",
        requiresCoreServiceContract: true,
        requiresCsrfProtection: true,
        requiresEvidenceWrite: true,
        risk: "local-mutation",
        serviceContractId: "idea.approve",
      }),
      ...approvalAndWorkflowRouteExpectations(),
      expect.objectContaining({
        path: "/actions/visuals-generate-hosted",
        requiredApproval: "cost",
        risk: "external-side-effect",
        serviceContractId: "visuals.generate-hosted",
      }),
      expect.objectContaining({
        path: "/actions/visuals-regenerate",
        requiredApproval: "review",
        serviceContractId: "visuals.regenerate",
      }),
      expect.objectContaining({
        path: "/actions/visuals-generate-local",
        requiredApproval: "review",
        serviceContractId: "visuals.generate-local",
      }),
      expect.objectContaining({
        path: "/actions/visuals-activate-revision",
        requiredApproval: "review",
        serviceContractId: "visuals.activate-revision",
      }),
      expect.objectContaining({
        path: "/actions/local-models-prepare",
        requiredApproval: "diagnostic",
        serviceContractId: "localModels.prepare",
      }),
      expect.objectContaining({
        path: "/actions/local-models-execute",
        requiredApproval: "workflow",
        serviceContractId: "localModels.execute",
      }),
    ]),
  );
  expect(enabledStudioActionRoutes.every((route) => route.enabled === true)).toBe(true);
  expect(studioSessionRoutes).toEqual([
    expect.objectContaining({
      allowedMethods: ["GET"],
      enabled: true,
      path: "/actions/session",
      requiredApproval: "none",
      risk: "local-session",
    }),
  ]);
  expect(disabledStudioActionRoutes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        enabled: false,
        path: "/actions/upload-private",
        requiredApproval: "upload",
        requiresCoreServiceContract: true,
        requiresCsrfProtection: true,
        requiresEvidenceWrite: true,
        risk: "external-side-effect",
        serviceContractId: "upload.private",
      }),
      expect.objectContaining({
        enabled: false,
        path: "/actions/publish-schedule",
        requiredApproval: "publish",
        requiresCoreServiceContract: true,
        requiresCsrfProtection: true,
        requiresEvidenceWrite: true,
        risk: "publish-risk",
        serviceContractId: "publish.schedule",
      }),
    ]),
  );
  expect(disabledStudioActionRoutes.every((route) => route.enabled === false)).toBe(true);
}

function approvalAndWorkflowRouteExpectations() {
  return [
    ["/actions/approve-script", "script", "script.approve"],
    ["/actions/revise-script", "script", "script.revise"],
    ["/actions/revise-package-artifact", "script", "package-artifact.revise"],
    ["/actions/approve-cost", "cost", "cost.approve"],
    ["/actions/approve-render", "render", "render.approve"],
    ["/actions/decide-render", "review", "render.decide"],
    ["/actions/decide-channel-handoff", "review", "channel-handoff.decide"],
    ["/actions/analytics-import", "analytics", "analytics.import"],
    ["/actions/analytics-report", "analytics", "analytics.report"],
    ["/actions/run-render-plan", "workflow", "render-plan.run"],
    ["/actions/run-doctor", "workflow", "doctor.run"],
    ["/actions/run-model-eval", "workflow", "model-eval.run"],
    ["/actions/run-model-eval-candidates", "workflow", "model-eval-candidates.run"],
    ["/actions/run-ideas", "workflow", "ideas.run"],
    ["/actions/settings-save", "workflow", "settings.save"],
    ["/actions/prompt-profiles-save", "workflow", "promptProfiles.save"],
    ["/actions/episode-create", "workflow", "episodes.create"],
    ["/actions/soundtrack-prepare", "workflow", "soundtrack.prepare"],
    ["/actions/soundtrack-import", "review", "soundtrack.import"],
    ["/actions/soundtrack-configure", "review", "soundtrack.configure"],
    ["/actions/soundtrack-analyze", "review", "soundtrack.analyze"],
    ["/actions/soundtrack-decide", "review", "soundtrack.decide"],
    ["/actions/voice-select", "review", "voice.select"],
    ["/actions/voice-preview", "workflow", "voice.preview"],
    ["/actions/review-render", "workflow", "render.review"],
    ["/actions/run-channel-handoff", "workflow", "channel-handoff.run"],
  ].map(([path, requiredApproval, serviceContractId]) =>
    expect.objectContaining({ path, requiredApproval, serviceContractId }),
  );
}
