import { readdir } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  disabledStudioActionRoutes,
  readOnlyStudioRoutes,
  routeSecurityFindings,
} from "../apps/studio/src/lib/routeSecurity";

const appRoot = path.join(process.cwd(), "apps/studio/src/app");

describe("Studio route security contract", () => {
  it("keeps every current Studio page route read-only and covered by the contract", async () => {
    const pageRoutes = await discoverPageRoutes(appRoot);
    const contractedRoutes = readOnlyStudioRoutes.map((route) => route.path).sort(routeSort);

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
        expect.objectContaining({ path: "/analytics" }),
        expect.objectContaining({ path: "/doctor" }),
        expect.objectContaining({ path: "/eval" }),
        expect.objectContaining({ path: "/prompts" }),
      ]),
    );
  });

  it("does not expose Studio route handlers or enabled mutating actions", async () => {
    await expect(discoverRouteHandlers(appRoot)).resolves.toEqual([]);
    expect(routeSecurityFindings()).toEqual([]);
    expect(disabledStudioActionRoutes).toEqual(
      expect.arrayContaining([
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
