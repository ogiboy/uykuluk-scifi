import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = dirname(dirname(workspaceRoot));

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  experimental: { extensionAlias: { ".js": [".ts", ".tsx", ".js", ".jsx"] }, externalDir: true },
  async headers() {
    return [
      {
        headers: [
          {
            key: "Content-Security-Policy",
            value: "base-uri 'self'; frame-ancestors 'none'; object-src 'none'",
          },
          { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=()" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
        source: "/:path*",
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "ui.shadcn.com" },
    ],
  },
  outputFileTracingRoot: repoRoot,
  poweredByHeader: false,
  typedRoutes: true,
};

const withNextIntl = createNextIntlPlugin({ requestConfig: "./src/i18n/request.ts" });
const localizedNextConfig = withNextIntl(nextConfig);
const sentryBuildCredentialsConfigured = [
  process.env.SENTRY_AUTH_TOKEN,
  process.env.SENTRY_ORG,
  process.env.SENTRY_PROJECT,
].every((value) => typeof value === "string" && value.trim().length > 0);

export default sentryBuildCredentialsConfigured
  ? withSentryConfig(localizedNextConfig, {
      authToken: process.env.SENTRY_AUTH_TOKEN,
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      silent: !process.env.CI,
      telemetry: false,
    })
  : localizedNextConfig;
