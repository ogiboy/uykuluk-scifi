import * as Sentry from "@sentry/nextjs";
import { sentrySampleRate } from "./lib/observability/sentrySampleRate";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  defaultIntegrations: false,
  dsn,
  enabled: Boolean(dsn),
  sendDefaultPii: false,
  tracesSampleRate: sentrySampleRate(process.env.SENTRY_TRACES_SAMPLE_RATE),
});
