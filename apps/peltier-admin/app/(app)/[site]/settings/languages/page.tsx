import Link from "next/link";
import { Info, Star, Trash2 } from "lucide-react";
import { addLocale, removeLocale, setPrimaryLocale, toggleLocalePublished } from "@/app/settings-actions";
import { ConfirmAction, SubmitButton } from "@/components/settings/action-buttons";
import { Select } from "@/components/settings/controls";
import { ReadOnlyNote, canManage } from "@/components/settings/read-only-note";
import { SettingsGroup, Surface } from "@/components/settings/settings-group";
import { SettingsPage } from "@/components/settings/settings-page";
import { StatusDot } from "@/components/page";
import { Button } from "@/components/ui/button";
import { requireSite } from "@/lib/admin";
import { localeLabel, supportedLocales } from "@/lib/format";
import { getLocales } from "@/lib/queries";

function LocaleName({ locale }: { locale: string }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block truncate text-sm font-medium">{localeLabel[locale] ?? locale}</span>
      <span className="font-mono text-[11px] text-muted-foreground">{locale}</span>
    </span>
  );
}

export default async function LanguageSettings({ params }: { params: Promise<{ site: string }> }) {
  const { site: slug } = await params;
  const { site, siteId } = await requireSite(slug);
  const locales = await getLocales(siteId);
  const readOnly = !canManage(site.memberRole);
  const primary = locales.find((l) => l.isPrimary);
  const others = locales.filter((l) => !l.isPrimary);
  const available = supportedLocales.filter((l) => !locales.some((x) => x.locale === l));
  const multilingual = (site.capabilities ?? []).includes("locales");

  return (
    <SettingsPage site={site.slug} title="Languages" description="English is the admin language. Visitors can switch between published site languages.">
      {readOnly && <ReadOnlyNote />}
      {!multilingual && (
        <div className="mx-3 flex items-start gap-2 rounded-xl bg-warning/10 px-4 py-3 text-[13px] text-foreground xs:mx-0">
          <Info className="mt-0.5 size-4 shrink-0 text-warning" />
          <span>
            <strong className="font-medium">Multiple languages</strong> is turned off, so only the primary language is served.{" "}
            <Link href={`/${site.slug}/settings/general`} className="font-medium underline underline-offset-2">
              Turn it on in General
            </Link>
          </span>
        </div>
      )}

      <div className="space-y-6 @min-[72rem]:space-y-10">
        <SettingsGroup title="Primary language" description="Content is written in this language first. Translations are compared against it.">
          <Surface flush>
            {primary ? (
              <div className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
                <LocaleName locale={primary.locale} />
                <span className="rounded-md bg-foreground px-2 py-0.5 text-[11px] font-medium text-background">Default</span>
              </div>
            ) : (
              <p className="px-5 py-4 text-sm text-muted-foreground">No primary language set.</p>
            )}
          </Surface>
        </SettingsGroup>

        <SettingsGroup title="Other languages" description="Unpublished languages can be translated in the Studio before visitors see them.">
          <Surface flush className="divide-y">
            {others.map((l) => (
              <div key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-5">
                <LocaleName locale={l.locale} />
                <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                  <StatusDot tone={l.isPublished ? "success" : "muted"} />
                  {l.isPublished ? "Published" : "Unpublished"}
                </span>
                <div className="flex items-center gap-1">
                  <form action={toggleLocalePublished}>
                    <input type="hidden" name="site" value={site.slug} />
                    <input type="hidden" name="locale" value={l.locale} />
                    <input type="hidden" name="publish" value={String(!l.isPublished)} />
                    <SubmitButton size="sm" variant="outline" disabled={readOnly}>
                      {l.isPublished ? "Unpublish" : "Publish"}
                    </SubmitButton>
                  </form>
                  <ConfirmAction
                    action={setPrimaryLocale}
                    fields={{ site: site.slug, locale: l.locale }}
                    disabled={readOnly}
                    title={`Make ${localeLabel[l.locale] ?? l.locale} the primary language?`}
                    description="New content will be written in this language first, and existing translations will be compared against it. The current primary language stays available."
                    confirmLabel="Make primary"
                    trigger={
                      <Button size="icon-sm" variant="ghost" aria-label="Make primary" title="Make primary">
                        <Star />
                      </Button>
                    }
                  />
                  <ConfirmAction
                    action={removeLocale}
                    fields={{ site: site.slug, locale: l.locale }}
                    disabled={readOnly}
                    destructive
                    title={`Remove ${localeLabel[l.locale] ?? l.locale}?`}
                    description="Visitors will no longer see this language. Existing translations are kept and come back if you add the language again."
                    confirmLabel="Remove"
                    trigger={
                      <Button size="icon-sm" variant="ghost" aria-label="Remove" title="Remove" className="text-muted-foreground hover:text-destructive">
                        <Trash2 />
                      </Button>
                    }
                  />
                </div>
              </div>
            ))}
            {others.length === 0 && <p className="px-5 py-4 text-sm text-muted-foreground">Only the primary language is set up.</p>}
            {available.length > 0 && !readOnly && (
              <form action={addLocale} className="flex items-center gap-2 bg-muted/40 px-4 py-3 sm:px-5">
                <input type="hidden" name="site" value={site.slug} />
                <Select name="locale" aria-label="Language to add" className="max-w-64 bg-card" defaultValue={available[0]}>
                  {available.map((l) => (
                    <option key={l} value={l}>
                      {localeLabel[l] ?? l}
                    </option>
                  ))}
                </Select>
                <SubmitButton size="sm" variant="outline">
                  Add language
                </SubmitButton>
              </form>
            )}
          </Surface>
        </SettingsGroup>
      </div>
    </SettingsPage>
  );
}
