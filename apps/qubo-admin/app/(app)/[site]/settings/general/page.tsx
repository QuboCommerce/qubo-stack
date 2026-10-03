import Link from "next/link";
import { siteTypes } from "@qubo/blocks";
import { siteTypePresets } from "@qubo/blocks/presets";
import { updateSiteGeneral } from "@/app/settings-actions";
import { capabilityMeta } from "@/components/settings/capabilities";
import { Field, RadioCard, Select, SwitchRow, TextArea, TextInput } from "@/components/settings/controls";
import { ReadOnlyNote, canManage } from "@/components/settings/read-only-note";
import { SettingsForm } from "@/components/settings/settings-form";
import { SettingsGroup, Surface } from "@/components/settings/settings-group";
import { SettingsPage } from "@/components/settings/settings-page";
import { requireSite } from "@/lib/admin";
import { localeLabel } from "@/lib/format";
import { siteTypeIcon } from "@/lib/site-type-icons";

const currencies = [
  ["EUR", "Euro (€)"],
  ["USD", "US dollar ($)"],
  ["GBP", "British pound (£)"],
  ["CHF", "Swiss franc (CHF)"],
] as const;

const capabilityOrder = ["commerce", "catalog", "accounts", "booking", "leads", "blog", "locales"] as const;

export default async function GeneralSettings({ params }: { params: Promise<{ site: string }> }) {
  const { site: slug } = await params;
  const { site } = await requireSite(slug);
  const readOnly = !canManage(site.memberRole);
  const caps = new Set(site.capabilities ?? []);

  return (
    <SettingsPage site={site.slug} title="General" description="How this site is named, what it does and how it formats money.">
      {readOnly && <ReadOnlyNote />}
      <SettingsForm action={updateSiteGeneral} readOnly={readOnly} className="space-y-6 @min-[72rem]:space-y-10">
        <input type="hidden" name="site" value={site.slug} />

        <SettingsGroup title="Details" description="Shown in the admin, browser tabs and search results.">
          <Surface className="space-y-4">
            <Field label="Site name" htmlFor="name">
              <TextInput id="name" name="name" defaultValue={site.name} required minLength={2} maxLength={80} autoComplete="off" />
            </Field>
            <Field label="Short description" htmlFor="description" hint="One sentence about the business. Used as the default meta description.">
              <TextArea id="description" name="description" defaultValue={site.description ?? ""} maxLength={300} rows={2} />
            </Field>
          </Surface>
        </SettingsGroup>

        <SettingsGroup title="Site type" description="The starting point this site was built from. Switching it never deletes data.">
          <div className="grid gap-2.5 px-3 xs:px-0 sm:grid-cols-2 @min-[96rem]:grid-cols-3">
            {siteTypes.map((t) => {
              const p = siteTypePresets[t];
              const Icon = siteTypeIcon[t];
              return <RadioCard key={t} name="type" value={t} defaultChecked={site.type === t} title={p.label} description={p.description} icon={<Icon className="size-4" />} />;
            })}
          </div>
        </SettingsGroup>

        <SettingsGroup title="Features" description="Turning a feature off hides it from navigation and the storefront. Nothing is deleted.">
          <Surface flush className="divide-y">
            {capabilityOrder.map((c) => {
              const m = capabilityMeta[c];
              return (
                <SwitchRow
                  key={c}
                  name="capabilities"
                  value={c}
                  defaultChecked={caps.has(c)}
                  label={m.label}
                  description={m.description}
                  icon={<m.icon className="size-4" strokeWidth={1.8} />}
                />
              );
            })}
          </Surface>
        </SettingsGroup>

        <SettingsGroup title="Formats" description="Defaults for prices and dates.">
          <Surface className="grid gap-4 sm:grid-cols-2">
            <Field label="Currency" htmlFor="currency">
              <Select id="currency" name="currency" defaultValue={site.currency}>
                {currencies.map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Primary language"
              hint={
                <Link href={`/${site.slug}/settings/languages`} className="font-medium text-foreground underline-offset-2 hover:underline">
                  Manage languages
                </Link>
              }
            >
              <div className="flex h-9 items-center rounded-lg border border-dashed px-3 text-sm text-muted-foreground">{localeLabel[site.locale] ?? site.locale}</div>
            </Field>
          </Surface>
        </SettingsGroup>
      </SettingsForm>
    </SettingsPage>
  );
}
