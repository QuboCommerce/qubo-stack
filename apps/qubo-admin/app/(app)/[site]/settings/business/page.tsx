import { getTranslations } from "next-intl/server";
import { db } from "@qubo/db/client";
import { organization, siteSettings } from "@qubo/db/schema";
import { eq } from "drizzle-orm";
import { updateSiteBusiness } from "@/app/settings-actions";
import { Field, Select, TextArea, TextInput } from "@/components/settings/controls";
import { OpeningHoursRows } from "@/components/settings/opening-hours";
import { ReadOnlyNote, canManage } from "@/components/settings/read-only-note";
import { SettingsForm } from "@/components/settings/settings-form";
import { SettingsGroup, Surface } from "@/components/settings/settings-group";
import { SettingsPage } from "@/components/settings/settings-page";
import { requireSite } from "@/lib/admin";
import { businessValues } from "@/lib/form-specs";
import { businessTypes, expandHours } from "@/lib/opening-hours";

export default async function BusinessSettings({ params }: { params: Promise<{ site: string }> }) {
  const t = await getTranslations("settings");
  const { site: slug } = await params;
  const { site, siteId } = await requireSite(slug);
  const readOnly = !canManage(site.memberRole);
  const [settings, org] = await Promise.all([
    db.query.siteSettings.findFirst({ where: eq(siteSettings.siteId, siteId) }),
    db.query.organization.findFirst({ where: eq(organization.id, site.organizationId) }),
  ]);
  if (!org) return null;
  const hours = expandHours(settings?.openingHours ?? []);
  const typeKnown = businessTypes.some((b) => b.value === (settings?.businessType ?? ""));

  return (
    <SettingsPage site={site.slug} title={t("business.title")} description={t("business.description")}>
      {readOnly && <ReadOnlyNote />}
      <SettingsForm
        action={updateSiteBusiness}
        readOnly={readOnly}
        className="space-y-6 @min-[72rem]:space-y-10"
        noun="settings"
        base={businessValues(settings, org)}
        watch={{ table: "site_settings", id: siteId }}
      >
        <input type="hidden" name="site" value={site.slug} />

        <SettingsGroup title={t("business.search")} description={t("business.searchHelp")}>
          <Surface className="space-y-4">
            <Field label={t("fields.siteTitle")} htmlFor="metaTitle" hint={t("business.siteTitleHint", { example: `${site.name}, ${t("business.siteTitleExample")}`, title: settings?.metaTitle || site.name })}>
              <TextInput id="metaTitle" name="metaTitle" defaultValue={settings?.metaTitle ?? ""} maxLength={120} placeholder={site.name} autoComplete="off" />
            </Field>
            <Field label={t("fields.siteDescription")} htmlFor="metaDescription" hint={t("business.siteDescriptionHint")}>
              <TextArea id="metaDescription" name="metaDescription" defaultValue={settings?.metaDescription ?? ""} maxLength={320} rows={3} placeholder={site.description ?? ""} />
            </Field>
          </Surface>
        </SettingsGroup>

        <SettingsGroup title={t("business.contact")} description={t("business.contactHelp")}>
          <Surface className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("fields.phone")} htmlFor="phone">
                <TextInput id="phone" name="phone" type="tel" defaultValue={settings?.phone ?? ""} maxLength={40} placeholder="+32 2 000 00 00" autoComplete="off" />
              </Field>
              <Field label={t("fields.email")} htmlFor="email">
                <TextInput id="email" name="email" type="email" defaultValue={settings?.email ?? ""} maxLength={120} autoComplete="off" />
              </Field>
            </div>
            <Field label={t("fields.businessType")} htmlFor="businessType" hint={t("business.businessTypeHint")}>
              <Select id="businessType" name="businessType" defaultValue={settings?.businessType ?? ""}>
                {businessTypes.map((b) => (
                  <option key={b.value} value={b.value}>
                    {t(`businessTypes.${b.key}`)}
                  </option>
                ))}
                {!typeKnown && settings?.businessType ? <option value={settings.businessType}>{settings.businessType}</option> : null}
              </Select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("fields.latitude")} htmlFor="latitude" hint={t("business.latitudeHint")}>
                <TextInput id="latitude" name="latitude" inputMode="decimal" defaultValue={settings?.latitude ?? ""} placeholder="50.8355" autoComplete="off" />
              </Field>
              <Field label={t("fields.longitude")} htmlFor="longitude">
                <TextInput id="longitude" name="longitude" inputMode="decimal" defaultValue={settings?.longitude ?? ""} placeholder="4.3127" autoComplete="off" />
              </Field>
            </div>
          </Surface>
        </SettingsGroup>

        <SettingsGroup title={t("business.hours")} description={t("business.hoursHelp")}>
          <Surface flush className="divide-y">
            <OpeningHoursRows hours={hours} disabled={readOnly} />
          </Surface>
        </SettingsGroup>

        <SettingsGroup
          title={t("business.legal")}
          description={t("business.legalHelp", { name: org.name })}
        >
          <Surface className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
              <Field label={t("fields.legalName")} htmlFor="legalName">
                <TextInput id="legalName" name="legalName" defaultValue={org.legalName ?? ""} maxLength={160} autoComplete="off" />
              </Field>
              <Field label={t("fields.legalForm")} htmlFor="legalForm">
                <TextInput id="legalForm" name="legalForm" defaultValue={org.legalForm ?? ""} maxLength={40} placeholder={t("business.legalFormPlaceholder")} autoComplete="off" />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("fields.companyNumber")} htmlFor="companyNumber" hint={t("business.companyNumberHint")}>
                <TextInput id="companyNumber" name="companyNumber" defaultValue={org.companyNumber ?? ""} maxLength={40} autoComplete="off" />
              </Field>
              <Field label={t("fields.vatNumber")} htmlFor="vatNumber">
                <TextInput id="vatNumber" name="vatNumber" defaultValue={org.vatNumber ?? ""} maxLength={40} placeholder="BE 0000.000.000" autoComplete="off" />
              </Field>
            </div>
            <Field label={t("fields.address")} htmlFor="addressLine1">
              <TextInput id="addressLine1" name="addressLine1" defaultValue={org.addressLine1 ?? ""} maxLength={160} autoComplete="off" />
            </Field>
            <Field label={t("fields.addressLine2")} htmlFor="addressLine2">
              <TextInput id="addressLine2" name="addressLine2" defaultValue={org.addressLine2 ?? ""} maxLength={160} autoComplete="off" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-[8rem_1fr_6rem]">
              <Field label={t("fields.postalCode")} htmlFor="postalCode">
                <TextInput id="postalCode" name="postalCode" defaultValue={org.postalCode ?? ""} maxLength={20} autoComplete="off" />
              </Field>
              <Field label={t("fields.city")} htmlFor="city">
                <TextInput id="city" name="city" defaultValue={org.city ?? ""} maxLength={80} autoComplete="off" />
              </Field>
              <Field label={t("fields.country")} htmlFor="country" hint={t("business.countryHint")}>
                <TextInput id="country" name="country" defaultValue={org.country ?? ""} maxLength={2} placeholder="BE" className="uppercase" autoComplete="off" />
              </Field>
            </div>
          </Surface>
        </SettingsGroup>
      </SettingsForm>
    </SettingsPage>
  );
}
