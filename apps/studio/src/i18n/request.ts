import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

import { normalizeStudioLocale, STUDIO_LOCALE_COOKIE } from "./locales";
import { STUDIO_MESSAGES } from "./messages";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const locale = normalizeStudioLocale(cookieStore.get(STUDIO_LOCALE_COOKIE)?.value);

  return {
    locale,
    messages: STUDIO_MESSAGES[locale],
    timeZone: "UTC",
  };
});
