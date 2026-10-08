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
  const { site: slug } = await params;
  const { site, siteId } = await requireSite(slug);
  const readOnly = !canManage(site.memberRole);
  const [settings, org] = await Promise.all([
    db.query.siteSettings.findFirst({ where: eq(siteSettings.siteId, siteId) }),
    db.query.organization.findFirst({ where: eq(organization.id, site.organizationId) }),
  ]);
  if (!org) return null;
  const hours = expandHours(settings?.openingHours ?? []);
  const typeKnown = businessTypes.some((t) => t.value === (settings?.businessType ?? ""));

  return (
    <SettingsPage site={site.slug} title="Business & SEO" description="Who runs this site, where to find you and how pages introduce themselves to search engines and AI assistants.">
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

        <SettingsGroup title="Search appearance" description="The site title ends every page title, so keep it short and say what you do and where. The home page uses it alone.">
          <Surface className="space-y-4">
            <Field label="Site title" htmlFor="metaTitle" hint={`Example: "${site.name}, matériel horeca à Bruxelles". Page titles become "Page | ${settings?.metaTitle || site.name}".`}>
              <TextInput id="metaTitle" name="metaTitle" defaultValue={settings?.metaTitle ?? ""} maxLength={120} placeholder={site.name} autoComplete="off" />
            </Field>
            <Field label="Site description" htmlFor="metaDescription" hint="Shown under the title in search results when a page has no description of its own. One or two sentences.">
              <TextArea id="metaDescription" name="metaDescription" defaultValue={settings?.metaDescription ?? ""} maxLength={320} rows={3} placeholder={site.description ?? ""} />
            </Field>
          </Surface>
        </SettingsGroup>

        <SettingsGroup title="Contact" description="Published on the storefront as structured data, so search engines and maps show the right number and hours. Leave a field empty to keep it private.">
          <Surface className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Phone" htmlFor="phone">
                <TextInput id="phone" name="phone" type="tel" defaultValue={settings?.phone ?? ""} maxLength={40} placeholder="+32 2 000 00 00" autoComplete="off" />
              </Field>
              <Field label="Email" htmlFor="email">
                <TextInput id="email" name="email" type="email" defaultValue={settings?.email ?? ""} maxLength={120} autoComplete="off" />
              </Field>
            </div>
            <Field label="Business type" htmlFor="businessType" hint="The schema.org category that best describes the place. General is fine when none fits.">
              <Select id="businessType" name="businessType" defaultValue={settings?.businessType ?? ""}>
                {businessTypes.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
                {!typeKnown && settings?.businessType ? <option value={settings.businessType}>{settings.businessType}</option> : null}
              </Select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Latitude" htmlFor="latitude" hint="Decimal degrees, from the map pin of your address.">
                <TextInput id="latitude" name="latitude" inputMode="decimal" defaultValue={settings?.latitude ?? ""} placeholder="50.8355" autoComplete="off" />
              </Field>
              <Field label="Longitude" htmlFor="longitude">
                <TextInput id="longitude" name="longitude" inputMode="decimal" defaultValue={settings?.longitude ?? ""} placeholder="4.3127" autoComplete="off" />
              </Field>
            </div>
          </Surface>
        </SettingsGroup>

        <SettingsGroup title="Opening hours" description="When the shop or office is open to visitors. Days that are off stay unlisted.">
          <Surface flush className="divide-y">
            <OpeningHoursRows hours={hours} disabled={readOnly} />
          </Surface>
        </SettingsGroup>

        <SettingsGroup
          title="Legal entity"
          description={`The company behind ${org.name}. Shared by every site this organisation runs; printed on legal pages and invoices.`}
        >
          <Surface className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
              <Field label="Legal name" htmlFor="legalName">
                <TextInput id="legalName" name="legalName" defaultValue={org.legalName ?? ""} maxLength={160} autoComplete="off" />
              </Field>
              <Field label="Legal form" htmlFor="legalForm">
                <TextInput id="legalForm" name="legalForm" defaultValue={org.legalForm ?? ""} maxLength={40} placeholder="SA, SRL, BV" autoComplete="off" />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Company number" htmlFor="companyNumber" hint="Enterprise number as registered (KBO/BCE in Belgium).">
                <TextInput id="companyNumber" name="companyNumber" defaultValue={org.companyNumber ?? ""} maxLength={40} autoComplete="off" />
              </Field>
              <Field label="VAT number" htmlFor="vatNumber">
                <TextInput id="vatNumber" name="vatNumber" defaultValue={org.vatNumber ?? ""} maxLength={40} placeholder="BE 0000.000.000" autoComplete="off" />
              </Field>
            </div>
            <Field label="Address" htmlFor="addressLine1">
              <TextInput id="addressLine1" name="addressLine1" defaultValue={org.addressLine1 ?? ""} maxLength={160} autoComplete="off" />
            </Field>
            <Field label="Address line 2" htmlFor="addressLine2">
              <TextInput id="addressLine2" name="addressLine2" defaultValue={org.addressLine2 ?? ""} maxLength={160} autoComplete="off" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-[8rem_1fr_6rem]">
              <Field label="Postal code" htmlFor="postalCode">
                <TextInput id="postalCode" name="postalCode" defaultValue={org.postalCode ?? ""} maxLength={20} autoComplete="off" />
              </Field>
              <Field label="City" htmlFor="city">
                <TextInput id="city" name="city" defaultValue={org.city ?? ""} maxLength={80} autoComplete="off" />
              </Field>
              <Field label="Country" htmlFor="country" hint="ISO code">
                <TextInput id="country" name="country" defaultValue={org.country ?? ""} maxLength={2} placeholder="BE" className="uppercase" autoComplete="off" />
              </Field>
            </div>
          </Surface>
        </SettingsGroup>
      </SettingsForm>
    </SettingsPage>
  );
}
