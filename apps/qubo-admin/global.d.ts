import type { AdminLocale } from "./i18n/config";
import type en from "./messages/en";

// English is the source of truth: every `t("...")` key is checked against it.
declare module "next-intl" {
  interface AppConfig {
    Locale: AdminLocale;
    Messages: typeof en;
  }
}
