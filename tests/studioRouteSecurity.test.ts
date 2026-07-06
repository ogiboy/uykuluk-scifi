import { readdir } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  disabledStudioActionRoutes,
  enabledStudioActionRoutes,
  readOnlyStudioRoutes,
  routeSecurityFindings,
  studioSessionRoutes,
} from "../apps/studio/src/lib/routeSecurity";

const appRoot = path.join(process.cwd(), "apps/studio/src/app");

describe("Studio route security contract", () => {
  it("keeps App Router route boundary files explicit and covered", async () => {
    await expect(discoverBoundaryFiles(appRoot)).resolves.toEqual(
      ["error.tsx", "not-found.tsx", "runs/[runId]/error.tsx", "runs/[runId]/not-found.tsx"].map(
        (routePath) => path.join(appRoot, routePath),
      ),
    );
  });

  it("keeps every current Studio page route read-only and covered by the contract", async () => {
    const pageRoutes = await discoverPageRoutes(appRoot);
    const contractedRoutes = readOnlyStudioRoutes
      .map((route) => route.path)
      .filter((routePath) => !routePath.includes("/media/"))
      .sort(routeSort);

    expect(pageRoutes).toEqual(contractedRoutes);
    expect(readOnlyStudioRoutes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          allowedMethods: ["GET"],
          enabled: true,
          path: "/",
          risk: "read-only",
        }),
        expect.objectContaining({ path: "/runs/[runId]" }),
        expect.objectContaining({ path: "/runs/[runId]/media/[...artifactPath]" }),
        expect.objectContaining({ path: "/analytics" }),
        expect.objectContaining({ path: "/doctor" }),
        expect.objectContaining({ path: "/eval" }),
        expect.objectContaining({ path: "/forbidden" }),
        expect.objectContaining({ path: "/prompts" }),
        expect.objectContaining({ path: "/unauthorized" }),
      ]),
    );
  });

  it("exposes only guarded local approval/review action routes", async () => {
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
        "actions/review-render-plan/route.ts",
        "actions/review-render/route.ts",
        "actions/review-script/route.ts",
        "actions/review-voice/route.ts",
        "actions/revise-package-artifact/route.ts",
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
        "runs/[runId]/media/[...artifactPath]/route.ts",
      ].map((routePath) => path.join(appRoot, routePath)),
    );
    expect(routeSecurityFindings()).toEqual([]);
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
        expect.objectContaining({
          path: "/actions/approve-script",
          requiredApproval: "script",
          serviceContractId: "script.approve",
        }),
        expect.objectContaining({
          path: "/actions/revise-script",
          requiredApproval: "script",
          serviceContractId: "script.revise",
        }),
        expect.objectContaining({
          path: "/actions/revise-package-artifact",
          requiredApproval: "script",
          serviceContractId: "package-artifact.revise",
        }),
        expect.objectContaining({
          path: "/actions/approve-cost",
          requiredApproval: "cost",
          serviceContractId: "cost.approve",
        }),
        expect.objectContaining({
          path: "/actions/approve-render",
          requiredApproval: "render",
          serviceContractId: "render.approve",
        }),
        expect.objectContaining({
          path: "/actions/decide-render",
          requiredApproval: "review",
          serviceContractId: "render.decide",
        }),
        expect.objectContaining({
          path: "/actions/decide-channel-handoff",
          requiredApproval: "review",
          serviceContractId: "channel-handoff.decide",
        }),
        expect.objectContaining({
          path: "/actions/analytics-import",
          requiredApproval: "analytics",
          serviceContractId: "analytics.import",
        }),
        expect.objectContaining({
          path: "/actions/analytics-report",
          requiredApproval: "analytics",
          serviceContractId: "analytics.report",
        }),
        expect.objectContaining({
          path: "/actions/run-render-plan",
          requiredApproval: "workflow",
          serviceContractId: "render-plan.run",
        }),
        expect.objectContaining({
          path: "/actions/run-doctor",
          requiredApproval: "workflow",
          serviceContractId: "doctor.run",
        }),
        expect.objectContaining({
          path: "/actions/run-model-eval",
          requiredApproval: "workflow",
          serviceContractId: "model-eval.run",
        }),
        expect.objectContaining({
          path: "/actions/run-model-eval-candidates",
          requiredApproval: "workflow",
          serviceContractId: "model-eval-candidates.run",
        }),
        expect.objectContaining({
          path: "/actions/run-ideas",
          requiredApproval: "workflow",
          serviceContractId: "ideas.run",
        }),
        expect.objectContaining({
          path: "/actions/review-render",
          requiredApproval: "workflow",
          serviceContractId: "render.review",
        }),
        expect.objectContaining({
          path: "/actions/run-channel-handoff",
          requiredApproval: "workflow",
          serviceContractId: "channel-handoff.run",
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
  });
});

async function discoverBoundaryFiles(root: string): Promise<string[]> {
  const files = await listFiles(root);
  return files.filter((file) => /\/(?:error|not-found)\.tsx$/.test(file)).sort(routeSort);
}

async function discoverPageRoutes(root: string): Promise<string[]> {
  const files = await listFiles(root);
  return files
    .filter((file) => file.endsWith("/page.tsx"))
    .map(pageFileToRoute)
    .sort(routeSort);
}

async function discoverRouteHandlers(root: string): Promise<string[]> {
  const files = await listFiles(root);
  return files.filter((file) => /\/route\.(ts|tsx|js|jsx)$/.test(file)).sort(routeSort);
}

async function listFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(root, entry.name);
      return entry.isDirectory() ? listFiles(fullPath) : [fullPath];
    }),
  );
  return files.flat();
}

function pageFileToRoute(file: string): string {
  const relative = path.relative(appRoot, file).replaceAll(path.sep, "/");
  const route = relative.replace(/\/page\.tsx$/, "").replace(/^page\.tsx$/, "");
  return route.length === 0 ? "/" : `/${route}`;
}

function routeSort(left: string, right: string): number {
  return left.localeCompare(right);
}
