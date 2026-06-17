import type { StudioLocale } from "./locales";
import type { StudioMessages } from "./messages";

declare module "next-intl" {
  interface AppConfig {
    Locale: StudioLocale;
    Messages: StudioMessages;
  }
}
