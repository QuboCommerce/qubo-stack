import { UserPlus } from "lucide-react";
import { SettingsGroup, Surface } from "@/components/settings/settings-group";
import { SettingsPage } from "@/components/settings/settings-page";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { requireSite } from "@/lib/admin";
import { shortDate } from "@/lib/format";
import { getMembers } from "@/lib/queries";

const roles = [
  { role: "OWNER", label: "Owner", description: "Everything, including billing and removing the organization." },
  { role: "ADMIN", label: "Admin", description: "All settings, team and content. No billing." },
  { role: "STAFF", label: "Staff", description: "Day-to-day work: orders, products, customers and content." },
  { role: "VIEWER", label: "Viewer", description: "Read-only access to the admin." },
] as const;

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export default async function UserSettings({ params }: { params: Promise<{ site: string }> }) {
  const { site: slug } = await params;
  const { site, user } = await requireSite(slug);
  const members = await getMembers(site.organizationId);
  const label = Object.fromEntries(roles.map((r) => [r.role, r.label]));

  return (
    <SettingsPage
      site={site.slug}
      title="Users & permissions"
      description="People with access to every site in this organization."
      actions={
        <Button size="sm" variant="outline" disabled title="Invitations arrive with transactional email">
          <UserPlus /> Invite
        </Button>
      }
    >
      <div className="space-y-6 @min-[72rem]:space-y-10">
        <SettingsGroup title="Team" description={`${members.length} ${members.length === 1 ? "person has" : "people have"} access.`}>
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
                    {m.email === user.email && <span className="ml-1.5 font-normal text-muted-foreground">(you)</span>}
                  </p>
                  <p className="truncate text-[13px] text-muted-foreground">{m.email}</p>
                </div>
                <span className="hidden text-xs text-muted-foreground sm:block">Since {shortDate(m.since)}</span>
                <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium">{label[m.role] ?? m.role}</span>
              </div>
            ))}
          </Surface>
        </SettingsGroup>
        <SettingsGroup title="Roles" description="What each role can do.">
          <Surface flush className="divide-y">
            {roles.map((r) => (
              <div key={r.role} className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:items-baseline sm:gap-4 sm:px-5">
                <span className="w-20 shrink-0 text-sm font-medium">{r.label}</span>
                <span className="text-[13px] text-muted-foreground">{r.description}</span>
              </div>
            ))}
          </Surface>
        </SettingsGroup>
      </div>
    </SettingsPage>
  );
}
