import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { siteTypes } from "@qubo/blocks";
import { updateSiteGeneral } from "@/app/settings-actions";
import { capabilityMeta } from "@/components/settings/capabilities";
import { Field, RadioCard, Select, SwitchRow, TextArea, TextInput } from "@/components/settings/controls";
import { ReadOnlyNote, canManage } from "@/components/settings/read-only-note";
import { SettingsForm } from "@/components/settings/settings-form";
import { SettingsGroup, Surface } from "@/components/settings/settings-group";
import { SettingsPage } from "@/components/settings/settings-page";
import { requireSite } from "@/lib/admin";
import { getFormatters } from "@/lib/format-server";
import { siteGeneralValues } from "@/lib/form-specs";
import { siteTypeIcon } from "@/lib/site-type-icons";

const currencies = ["EUR", "USD", "GBP", "CHF"] as const;

const capabilityOrder = ["commerce", "catalog", "accounts", "booking", "leads", "blog", "locales"] as const;

export default async function GeneralSettings({ params }: { params: Promise<{ site: string }> }) {
  const t = await getTranslations("settings");
  const f = await getFormatters();
  const { site: slug } = await params;
  const { site, siteId } = await requireSite(slug);
  const readOnly = !canManage(site.memberRole);
  const caps = new Set(site.capabilities ?? []);

  return (
    <SettingsPage site={site.slug} title={t("general.title")} description={t("general.description")}>
      {readOnly && <ReadOnlyNote />}
      <SettingsForm
        action={updateSiteGeneral}
        readOnly={readOnly}
        className="space-y-6 @min-[72rem]:space-y-10"
        noun="site"
        base={siteGeneralValues(site)}
        watch={{ table: "site", id: siteId }}
      >
        <input type="hidden" name="site" value={site.slug} />

        <SettingsGroup title={t("general.details")} description={t("general.detailsHelp")}>
          <Surface className="space-y-4">
            <Field label={t("fields.siteName")} htmlFor="name">
              <TextInput id="name" name="name" defaultValue={site.name} required minLength={2} maxLength={80} autoComplete="off" />
            </Field>
            <Field label={t("fields.shortDescription")} htmlFor="description" hint={t("general.descriptionHint")}>
              <TextArea id="description" name="description" defaultValue={site.description ?? ""} maxLength={300} rows={2} />
            </Field>
          </Surface>
        </SettingsGroup>

        <SettingsGroup title={t("fields.siteType")} description={t("general.siteTypeHelp")}>
          <div className="grid gap-2.5 px-3 xs:px-0 sm:grid-cols-2 @min-[96rem]:grid-cols-3">
            {siteTypes.map((type) => {
              const Icon = siteTypeIcon[type];
              return <RadioCard key={type} name="type" value={type} defaultChecked={site.type === type} title={t(`siteTypes.${type}.label`)} description={t(`siteTypes.${type}.description`)} icon={<Icon className="size-4" />} />;
            })}
          </div>
        </SettingsGroup>

        <SettingsGroup title={t("fields.features")} description={t("general.featuresHelp")}>
          <Surface flush className="divide-y">
            {capabilityOrder.map((c) => {
              const m = capabilityMeta[c];
              return (
                <SwitchRow
                  key={c}
                  name="capabilities"
                  value={c}
                  defaultChecked={caps.has(c)}
                  label={t(`capabilities.${c}.label`)}
                  description={t(`capabilities.${c}.description`)}
                  icon={<m.icon className="size-4" strokeWidth={1.8} />}
                />
              );
            })}
          </Surface>
        </SettingsGroup>

        <SettingsGroup title={t("general.formats")} description={t("general.formatsHelp")}>
          <Surface className="grid gap-4 sm:grid-cols-2">
            <Field label={t("fields.currency")} htmlFor="currency">
              <Select id="currency" name="currency" defaultValue={site.currency}>
                {currencies.map((code) => (
                  <option key={code} value={code}>
                    {t(`currencies.${code}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label={t("general.primaryLanguage")}
              hint={
                <Link href={`/${site.slug}/settings/languages`} className="font-medium text-foreground underline-offset-2 hover:underline">
                  {t("general.manageLanguages")}
                </Link>
              }
            >
              <div className="flex h-9 items-center rounded-lg border border-dashed px-3 text-sm text-muted-foreground">{f.localeName(site.locale)}</div>
            </Field>
          </Surface>
        </SettingsGroup>
      </SettingsForm>
    </SettingsPage>
  );
}
