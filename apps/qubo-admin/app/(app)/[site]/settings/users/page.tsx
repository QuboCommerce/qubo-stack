import { UserPlus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { SettingsGroup, Surface } from "@/components/settings/settings-group";
import { SettingsPage } from "@/components/settings/settings-page";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { requireSite } from "@/lib/admin";
import { getFormatters } from "@/lib/format-server";
import { getMembers } from "@/lib/queries";

const roles = ["OWNER", "ADMIN", "STAFF", "VIEWER"] as const;

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export default async function UserSettings({ params }: { params: Promise<{ site: string }> }) {
  const t = await getTranslations("settings");
  const f = await getFormatters();
  const { site: slug } = await params;
  const { site, user } = await requireSite(slug);
  const members = await getMembers(site.organizationId);

  return (
    <SettingsPage
      site={site.slug}
      title={t("users.title")}
      description={t("users.description")}
      actions={
        <Button size="sm" variant="outline" disabled title={t("users.inviteHelp")}>
          <UserPlus /> {t("users.invite")}
        </Button>
      }
    >
      <div className="space-y-6 @min-[72rem]:space-y-10">
        <SettingsGroup title={t("users.team")} description={t("users.teamCount", { count: members.length })}>
          <Surface flush className="divide-y">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <Avatar className="size-8">
                  {m.image && <AvatarImage src={m.image} alt="" />}
                  <AvatarFallback className="text-[11px] font-medium">{initials(m.name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {m.name}
                    {m.email === user.email && <span className="ml-1.5 font-normal text-muted-foreground">{t("users.you")}</span>}
                  </p>
                  <p className="truncate text-[13px] text-muted-foreground">{m.email}</p>
                </div>
                <span className="hidden text-xs text-muted-foreground sm:block">{t("users.since", { date: f.shortDate(m.since) })}</span>
                <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium">{(roles as readonly string[]).includes(m.role) ? t(`roles.${m.role as (typeof roles)[number]}`) : m.role}</span>
              </div>
            ))}
          </Surface>
        </SettingsGroup>
        <SettingsGroup title={t("users.roles")} description={t("users.rolesHelp")}>
          <Surface flush className="divide-y">
            {roles.map((r) => (
              <div key={r} className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:items-baseline sm:gap-4 sm:px-5">
                <span className="w-32 shrink-0 text-sm font-medium">{t(`roles.${r}`)}</span>
                <span className="text-[13px] text-muted-foreground">{t(`roleDescriptions.${r}`)}</span>
              </div>
            ))}
          </Surface>
        </SettingsGroup>
      </div>
    </SettingsPage>
  );
}
