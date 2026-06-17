import { defineRouting } from "next-intl/routing";

import { STUDIO_DEFAULT_LOCALE, STUDIO_LOCALES } from "./locales";

export const routing = defineRouting({
  defaultLocale: STUDIO_DEFAULT_LOCALE,
  localePrefix: "never",
  locales: STUDIO_LOCALES,
});
