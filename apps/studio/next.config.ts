import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = dirname(dirname(workspaceRoot));

const stageSourceAliases = [
  "finalReviewBundleContracts",
  "productionPackagePaths",
  "renderPlanSchemas",
  "statusMediaFacts",
] as const;

const nextConfig: NextConfig = {
  typedRoutes: true,
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "ui.shadcn.com",
      },
    ],
  },
  turbopack: {
    ignoreIssue: [
      {
        path: "**/apps/studio/next.config.ts",
        title: "Encountered unexpected file in NFT list",
        description: /whole project was traced unintentionally/,
      },
    ],
    resolveAlias: Object.fromEntries(
      stageSourceAliases.map((name) => [`./${name}.js`, `../../src/stages/${name}.ts`]),
    ),
    root: repoRoot,
  },
};

const withNextIntl = createNextIntlPlugin({
  requestConfig: "./src/i18n/request.ts",
});

export default withNextIntl(nextConfig);
