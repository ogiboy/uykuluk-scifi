import path from "node:path";
import { describe, expect, it } from "vitest";
import { readOnlyStudioRoutes } from "../apps/studio/src/lib/routeSecurity";
import { expectStudioActionRouteContract } from "./studioRouteSecurityActionExpectations";
import { discoverBoundaryFiles, discoverPageRoutes, routeSort } from "./studioRouteSecurityHelpers";

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
      .filter(
        (routePath) =>
          !routePath.includes("/media/") &&
          !routePath.includes("/visuals/") &&
          !routePath.includes("/provider-smokes/"),
      )
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
        ...[
          "/runs/[runId]",
          "/runs/[runId]/media/[...artifactPath]",
          "/ideas",
          "/ideas/new",
          "/analytics",
          "/doctor",
          "/eval",
          "/forbidden",
          "/prompts",
          "/settings",
          "/unauthorized",
        ].map((path) => expect.objectContaining({ path })),
      ]),
    );
  });

  it("exposes only guarded local approval/review action routes", async () => {
    await expectStudioActionRouteContract(appRoot);
  });
});
