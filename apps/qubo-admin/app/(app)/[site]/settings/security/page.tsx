import { getTranslations } from "next-intl/server";
import { Laptop, Monitor, Smartphone, Tablet } from "lucide-react";
import { GEO_ATTRIBUTION, flag, placeLabel } from "@qubo/geo";
import { SettingsGroup, Surface } from "@/components/settings/settings-group";
import { SettingsPage } from "@/components/settings/settings-page";
import { Button } from "@/components/ui/button";
import { revokeOtherSessions, revokeSession } from "@/app/security-actions";
import { requireSite } from "@/lib/admin";
import { getFormatters } from "@/lib/format-server";
import { listDevices, type DeviceRow } from "@/lib/sessions";

const icon = (label: string) => (/iPhone|Android/.test(label) ? Smartphone : /iPad/.test(label) ? Tablet : /macOS|Windows|Linux|ChromeOS/.test(label) ? Laptop : Monitor);

const endedKeys = ["takeover", "revoked", "signed_out"] as const;

function where(d: DeviceRow, unknown: string) {
  const place = placeLabel({ city: d.city, country: d.country, local: d.isLocal }) ?? unknown;
  return `${flag(d.countryCode)} ${place}`.trim();
}

export default async function SecuritySettings({ params }: { params: Promise<{ site: string }> }) {
  const t = await getTranslations("security");
  const f = await getFormatters();
  const { site: slug } = await params;
  const { site, user } = await requireSite(slug);
  const devices = await listDevices(user.id);
  const live = devices.filter((d) => d.live);
  const past = devices.filter((d) => !d.live).slice(0, 10);
  const others = live.filter((d) => d.sessionId !== user.sessionId).length;

  return (
    <SettingsPage
      site={site.slug}
      title={t("title")}
      description={t("description")}
      actions={
        others > 0 ? (
          <form action={revokeOtherSessions}>
            <input type="hidden" name="site" value={site.slug} />
            <Button size="sm" variant="outline" type="submit">{t("signOutOthers")}</Button>
          </form>
        ) : undefined
      }
    >
      <div className="space-y-6 @min-[72rem]:space-y-10">
        <SettingsGroup title={t("signedIn")} description={t("activeSessions", { count: live.length })}>
          <Surface flush className="divide-y">
            {live.map((d) => {
              const Icon = icon(d.deviceLabel);
              const current = d.sessionId === user.sessionId;
              return (
                <div key={d.sessionId} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3.5 sm:px-5">
                  <Icon className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {d.deviceLabel}
                      {current && <span className="ml-2 rounded-md bg-success/15 px-1.5 py-0.5 text-[11px] font-medium text-success">{t("thisDevice")}</span>}
                    </p>
                    <p className="truncate text-[13px] text-muted-foreground">
                      {where(d, t("unknownLocation"))} · {current ? t("activeNow") : t("lastActive", { ago: f.ago(d.lastActiveAt) })}
                      {!current && d.isFocused ? ` · ${t("tabInFocus")}` : ""}
                    </p>
                  </div>
                  {!current && (
                    <form action={revokeSession}>
                      <input type="hidden" name="site" value={site.slug} />
                      <input type="hidden" name="sessionId" value={d.sessionId} />
                      <Button size="sm" variant="ghost" type="submit">{t("signOut")}</Button>
                    </form>
                  )}
                </div>
              );
            })}
          </Surface>
        </SettingsGroup>

        {past.length > 0 && (
          <SettingsGroup title={t("recent")} description={t("recentHelp")}>
            <Surface flush className="divide-y">
              {past.map((d) => (
                <div key={d.sessionId} className="flex items-center gap-3 px-4 py-3 text-[13px] sm:px-5">
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium">{d.deviceLabel}</span> <span className="text-muted-foreground">· {where(d, t("unknownLocation"))}</span>
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    {(endedKeys as readonly string[]).includes(d.revokedReason ?? "") ? t(`ended.${d.revokedReason as (typeof endedKeys)[number]}`) : t("ended.other")} · {f.ago(d.endedAt ?? d.lastActiveAt)}
                  </span>
                </div>
              ))}
            </Surface>
          </SettingsGroup>
        )}

        <p className="text-xs text-muted-foreground">
          {t("locationsNote")}{" "}
          <a href={GEO_ATTRIBUTION.url} className="underline" target="_blank" rel="noreferrer">{GEO_ATTRIBUTION.label}</a>.
        </p>
      </div>
    </SettingsPage>
  );
}
