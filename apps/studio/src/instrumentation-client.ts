import * as Sentry from "@sentry/nextjs";
import { sentrySampleRate } from "./lib/observability/sentrySampleRate";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  defaultIntegrations: false,
  dsn,
  enabled: Boolean(dsn),
  sendDefaultPii: false,
  tracesSampleRate: sentrySampleRate(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE),
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
