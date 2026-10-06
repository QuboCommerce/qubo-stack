import Link from "next/link";
import { Info } from "lucide-react";
import { translationCoverage, type TranslationCoverage } from "@qubo/studio";
import { AddLanguage, LanguageRowActions } from "@/components/settings/languages/language-actions";
import { LocaleMark } from "@/components/settings/languages/locale-mark";
import { ReadOnlyNote, canManage } from "@/components/settings/read-only-note";
import { SettingsGroup, Surface } from "@/components/settings/settings-group";
import { SettingsPage } from "@/components/settings/settings-page";
import { StatusDot } from "@/components/page";
import { requireSite } from "@/lib/admin";
import { localeLabel, supportedLocales } from "@/lib/format";
import { getLocales } from "@/lib/queries";

const nameOf = (locale: string) => localeLabel[locale] ?? locale;

/** Translated share of the site's texts; the stale part is shown apart in amber. */
function Coverage({ c }: { c: TranslationCoverage | undefined }) {
  if (!c || c.total === 0) return <span>Nothing to translate yet</span>;
  const pct = (n: number) => `${(n / c.total) * 100}%`;
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="relative hidden h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-muted sm:block" aria-hidden>
        <span className="absolute inset-y-0 left-0 rounded-full bg-success" style={{ width: pct(c.done) }} />
        <span className="absolute inset-y-0 rounded-full bg-warning" style={{ left: pct(c.done), width: pct(c.stale) }} />
      </span>
      <span className="truncate">
        <span className="sm:hidden">{c.done}/{c.total} translated</span>
        <span className="hidden sm:inline">{c.done} of {c.total} texts translated</span>
        {c.stale > 0 && <span className="text-warning"> · {c.stale} to review</span>}
      </span>
    </span>
  );
}

export default async function LanguageSettings({ params }: { params: Promise<{ site: string }> }) {
  const { site: slug } = await params;
  const { site, siteId } = await requireSite(slug);
  const [locales, coverage] = await Promise.all([getLocales(siteId), translationCoverage(siteId)]);
  const manage = canManage(site.memberRole);
  const primary = locales.find((l) => l.isPrimary);
  const others = locales.filter((l) => !l.isPrimary);
  const available = supportedLocales.filter((l) => !locales.some((x) => x.locale === l)).map((l) => ({ locale: l, label: nameOf(l) }));
  const multilingual = (site.capabilities ?? []).includes("locales");

  return (
    <SettingsPage site={site.slug} title="Languages" description="The languages this site is written in. Visitors see the primary one first.">
      {!manage && <ReadOnlyNote />}
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
        <SettingsGroup title="Primary language" description="Content is written in this language first. Every translation is compared against it.">
          <Surface flush>
            {primary ? (
              <div className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
                <LocaleMark locale={primary.locale} primary />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{nameOf(primary.locale)}</span>
                    <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10.5px] font-medium">Primary</span>
                  </div>
                  <p className="font-mono text-[11.5px] text-muted-foreground">{primary.locale}</p>
                </div>
              </div>
            ) : (
              <p className="px-5 py-4 text-sm text-muted-foreground">No primary language set.</p>
            )}
          </Surface>
        </SettingsGroup>

        <SettingsGroup title="Other languages" description="New languages start unpublished. Publish one when its translation is complete.">
          <Surface flush className="divide-y">
            {others.map((l) => (
              <div key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3.5 sm:px-5">
                <LocaleMark locale={l.locale} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{nameOf(l.locale)}</span>
                    <span className="font-mono text-[11.5px] text-muted-foreground">{l.locale}</span>
                  </div>
                  <div className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-muted-foreground">
                    <StatusDot tone={l.isPublished ? "success" : "muted"} />
                    <span className="sr-only shrink-0 sm:not-sr-only">{l.isPublished ? "Published" : "Unpublished"}</span>
                    <span aria-hidden className="hidden sm:inline">·</span>
                    <Coverage c={coverage[l.locale]} />
                  </div>
                </div>
                <LanguageRowActions site={site.slug} locale={l.locale} label={nameOf(l.locale)} published={l.isPublished} canManage={manage} />
              </div>
            ))}
            {others.length === 0 && <p className="px-5 py-4 text-sm text-muted-foreground">Only the primary language is set up.</p>}
            {manage && available.length > 0 && <AddLanguage site={site.slug} available={available} />}
          </Surface>
          <p className="mt-3 flex items-start gap-2 px-3 text-[12.5px] text-muted-foreground xs:px-1">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            <span>
              A published language is served under its own prefix (for example /nl) with a switcher in the header and hreflang tags. Translating page
              content in the Studio is still in development; translations added by other means carry over.
            </span>
          </p>
        </SettingsGroup>
      </div>
    </SettingsPage>
  );
}
