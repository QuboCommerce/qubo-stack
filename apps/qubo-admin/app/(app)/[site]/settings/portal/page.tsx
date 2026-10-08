import { AlertCircle, RefreshCw, Unplug } from "lucide-react";
import { DEFAULT_PORTAL_URL, entitlementsFor, getLink } from "@qubo/portal-client";
import { refreshLicence, unlinkPortal } from "@/app/portal-actions";
import { PortalLinkForm } from "@/components/settings/portal-link-form";
import { SettingsGroup, Surface } from "@/components/settings/settings-group";
import { SettingsPage } from "@/components/settings/settings-page";
import { StatusDot } from "@/components/page";
import { Button } from "@/components/ui/button";
import { requireSite } from "@/lib/admin";
import { relativeTime, shortDate } from "@/lib/format";

const planLabel: Record<string, string> = { free: "Free", starter: "Starter", growth: "Growth", agency: "Agency" };
const portalErrors: Record<string, string> = {
  unknown_instance: "The Portal no longer recognises this instance (it was revoked or removed there). Unlink, then link again with a new token",
  bad_signature: "The Portal rejected this instance's signature. Unlink and link again",
  clock_skew: "This server's clock is more than 5 minutes off. Fix NTP and refresh",
  protocol_unsupported: "This Qubo version is too old for the Portal. Update Qubo",
};
const describeError = (raw: string) => {
  const code = raw.match(/^portal \d+ (\S+)/)?.[1];
  return (code && portalErrors[code]) ?? (/fetch|timeout|ECONN|ENOTFOUND/i.test(raw) ? "Could not reach the Portal" : raw);
};
const fmtLimit = (n: number | null) => (n === null ? "Unlimited" : String(n));

export default async function PortalSettings({ params }: { params: Promise<{ site: string }> }) {
  const { site: slug } = await params;
  const { site } = await requireSite(slug);
  const link = await getLink();
  const ent = entitlementsFor(link);
  const portalUrl = process.env.PORTAL_URL || DEFAULT_PORTAL_URL;

  const status =
    ent.source === "licence"
      ? { tone: "success" as const, text: `Licence valid until ${shortDate(new Date(ent.expiresAt! * 1000))}` }
      : ent.source === "grace"
        ? { tone: "warning" as const, text: `Licence expired; grace until ${shortDate(new Date(ent.graceEndsAt! * 1000))}` }
        : ent.source === "expired"
          ? { tone: "warning" as const, text: "Licence expired; running on Free limits" }
          : { tone: "muted" as const, text: "Not linked; running on Free limits" };

  return (
    <SettingsPage
      site={site.slug}
      title="Qubo Portal"
      description="This instance works on its own. Linking a Portal account adds your plan's limits, update notices and fleet visibility; nothing here can switch the instance off."
    >
      <div className="space-y-6 @min-[72rem]:space-y-10">
        <SettingsGroup title="Plan" description="What this instance is entitled to right now.">
          <Surface className="space-y-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className="text-lg font-semibold">{planLabel[ent.plan] ?? ent.plan}</span>
              <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                <StatusDot tone={status.tone} />
                {status.text}
              </span>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
              <div><dt className="text-muted-foreground">Organisations</dt><dd className="font-medium">{fmtLimit(ent.limits.orgs)}</dd></div>
              <div><dt className="text-muted-foreground">Sites (all organisations)</dt><dd className="font-medium">{fmtLimit(ent.limits.sites)}</dd></div>
              <div><dt className="text-muted-foreground">Staff seats</dt><dd className="font-medium">{fmtLimit(ent.limits.seats)}</dd></div>
              <div><dt className="text-muted-foreground">Domains per site</dt><dd className="font-medium">{fmtLimit(ent.limits.customDomainsPerSite)}</dd></div>
              <div><dt className="text-muted-foreground">Apps per site</dt><dd className="font-medium">{fmtLimit(ent.limits.cubiclesPerSite)}</dd></div>
              <div><dt className="text-muted-foreground">Features</dt><dd className="font-medium">{ent.features.length ? ent.features.join(", ") : "—"}</dd></div>
            </dl>
            {ent.source === "unlinked" && (
              <p className="text-sm text-muted-foreground">Need more than one site? Link an account on the Growth plan at <a className="underline" href={portalUrl} target="_blank" rel="noreferrer">{portalUrl.replace(/^https?:\/\//, "")}</a>.</p>
            )}
          </Surface>
        </SettingsGroup>

        {link ? (
          <SettingsGroup title="Linked instance" description="Heartbeats run every 6 hours from the API and refresh the licence.">
            <Surface className="space-y-4">
              <dl className="grid gap-y-2 text-sm sm:grid-cols-2 sm:gap-x-6">
                <div><dt className="text-muted-foreground">Portal</dt><dd className="font-medium">{link.portalUrl}</dd></div>
                <div><dt className="text-muted-foreground">Instance ID</dt><dd className="font-mono text-[13px]">{link.instanceId}</dd></div>
                <div><dt className="text-muted-foreground">Last heartbeat</dt><dd className="font-medium">{link.lastHeartbeatAt ? relativeTime(link.lastHeartbeatAt) : "Never"}</dd></div>
                <div><dt className="text-muted-foreground">Licence fetched</dt><dd className="font-medium">{link.licenseFetchedAt ? relativeTime(link.licenseFetchedAt) : "Never"}</dd></div>
              </dl>
              {link.lastError && (
                <p className="flex items-start gap-2 text-sm text-muted-foreground">
                  <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-600" strokeWidth={1.8} />
                  {describeError(link.lastError)}. The instance keeps running on its cached licence.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <form action={refreshLicence}>
                  <input type="hidden" name="site" value={site.slug} />
                  <Button size="sm" variant="outline" type="submit"><RefreshCw className="size-3.5" strokeWidth={2} /> Refresh now</Button>
                </form>
                <form action={unlinkPortal}>
                  <input type="hidden" name="site" value={site.slug} />
                  <Button size="sm" variant="ghost" type="submit" title="Back to Free limits; the Portal keeps the instance record until you revoke it there"><Unplug className="size-3.5" strokeWidth={2} /> Unlink</Button>
                </form>
              </div>
            </Surface>
          </SettingsGroup>
        ) : (
          <SettingsGroup title="Link this instance" description="Create a registration token in the Portal (Instances → Add instance) and paste it here. Tokens are single-use.">
            <Surface>
              <PortalLinkForm site={site.slug} siteName={site.name} defaultPortalUrl={portalUrl} />
            </Surface>
          </SettingsGroup>
        )}
      </div>
    </SettingsPage>
  );
}
