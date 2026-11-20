import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/page";
import { Surface } from "@/components/settings/settings-group";
import { SettingsPage } from "@/components/settings/settings-page";
import { findSection } from "@/components/settings/sections";
import { requireSite } from "@/lib/admin";

/** Sections that are planned but not built yet. */
export default async function PlannedSettings({ params }: { params: Promise<{ site: string; section: string }> }) {
  const t = await getTranslations("settings");
  const { site: slug, section } = await params;
  const { site } = await requireSite(slug);
  const s = findSection(section);
  if (!s || (s.requires && !(site.capabilities ?? []).includes(s.requires as never))) notFound();

  return (
    <SettingsPage site={site.slug} title={t(`sections.${s.slug}.label`)} description={t(`sections.${s.slug}.description`)}>
      <Surface flush>
        <EmptyState icon={s.icon} title={t("comingSoon.title")} description={t("comingSoon.description", { name: t(`sections.${s.slug}.label`) })} />
      </Surface>
    </SettingsPage>
  );
}
