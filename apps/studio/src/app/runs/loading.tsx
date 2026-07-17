import { StudioLoadingScaffold } from "@/components/studio/StudioLoadingScaffold";
import { normalizeStudioLocale } from "@/i18n/locales";
import { getLocale } from "next-intl/server";

export default async function RunsLoading() {
  const locale = normalizeStudioLocale(await getLocale());
  return (
    <StudioLoadingScaffold
      eyebrow={locale === "tr" ? "Üretim bölümleri" : "Production episodes"}
      layout='shell'
      railPanels={1}
      title={locale === "tr" ? "Üretim bölümleri" : "Producer runs"}
    />
  );
}
