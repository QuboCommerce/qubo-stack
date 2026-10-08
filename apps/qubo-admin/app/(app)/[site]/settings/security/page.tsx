import { Laptop, Monitor, Smartphone, Tablet } from "lucide-react";
import { GEO_ATTRIBUTION, flag, placeLabel } from "@qubo/geo";
import { SettingsGroup, Surface } from "@/components/settings/settings-group";
import { SettingsPage } from "@/components/settings/settings-page";
import { Button } from "@/components/ui/button";
import { revokeOtherSessions, revokeSession } from "@/app/security-actions";
import { requireSite } from "@/lib/admin";
import { ago } from "@/lib/relative";
import { listDevices, type DeviceRow } from "@/lib/sessions";

const icon = (label: string) => (/iPhone|Android/.test(label) ? Smartphone : /iPad/.test(label) ? Tablet : /macOS|Windows|Linux|ChromeOS/.test(label) ? Laptop : Monitor);

const endedLabel: Record<string, string> = { takeover: "Replaced by a new sign-in", revoked: "Signed out remotely", signed_out: "Signed out" };

function where(d: DeviceRow) {
  const place = placeLabel({ city: d.city, country: d.country, local: d.isLocal }) ?? "Unknown location";
  return `${flag(d.countryCode)} ${place}`.trim();
}

export default async function SecuritySettings({ params }: { params: Promise<{ site: string }> }) {
  const { site: slug } = await params;
  const { site, user } = await requireSite(slug);
  const devices = await listDevices(user.id);
  const live = devices.filter((d) => d.live);
  const past = devices.filter((d) => !d.live).slice(0, 10);
  const others = live.filter((d) => d.sessionId !== user.sessionId).length;

  return (
    <SettingsPage
      site={site.slug}
      title="Security & sessions"
      description="Devices signed in to your account. Signing in on a new device asks before ending another open session."
      actions={
        others > 0 ? (
          <form action={revokeOtherSessions}>
            <input type="hidden" name="site" value={site.slug} />
            <Button size="sm" variant="outline" type="submit">Sign out other devices</Button>
          </form>
        ) : undefined
      }
    >
      <div className="space-y-6 @min-[72rem]:space-y-10">
        <SettingsGroup title="Signed in" description={`${live.length} active ${live.length === 1 ? "session" : "sessions"}.`}>
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
                      {current && <span className="ml-2 rounded-md bg-success/15 px-1.5 py-0.5 text-[11px] font-medium text-success">This device</span>}
                    </p>
                    <p className="truncate text-[13px] text-muted-foreground">
                      {where(d)} · {current ? "active now" : `last active ${ago(d.lastActiveAt)}`}
                      {!current && d.isFocused ? " · tab in focus" : ""}
                    </p>
                  </div>
                  {!current && (
                    <form action={revokeSession}>
                      <input type="hidden" name="site" value={site.slug} />
                      <input type="hidden" name="sessionId" value={d.sessionId} />
                      <Button size="sm" variant="ghost" type="submit">Sign out</Button>
                    </form>
                  )}
                </div>
              );
            })}
          </Surface>
        </SettingsGroup>

        {past.length > 0 && (
          <SettingsGroup title="Recent activity" description="Sessions that ended in the last 30 days.">
            <Surface flush className="divide-y">
              {past.map((d) => (
                <div key={d.sessionId} className="flex items-center gap-3 px-4 py-3 text-[13px] sm:px-5">
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium">{d.deviceLabel}</span> <span className="text-muted-foreground">· {where(d)}</span>
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    {endedLabel[d.revokedReason ?? ""] ?? "Signed out or expired"} · {ago(d.endedAt ?? d.lastActiveAt)}
                  </span>
                </div>
              ))}
            </Surface>
          </SettingsGroup>
        )}

        <p className="text-xs text-muted-foreground">
          Locations are approximate and looked up on this server.{" "}
          <a href={GEO_ATTRIBUTION.url} className="underline" target="_blank" rel="noreferrer">{GEO_ATTRIBUTION.label}</a>.
        </p>
      </div>
    </SettingsPage>
  );
}
