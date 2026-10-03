import { Lock } from "lucide-react";

export const canManage = (role: string) => role === "OWNER" || role === "ADMIN";

export function ReadOnlyNote() {
  return (
    <div className="mx-3 flex items-center gap-2 rounded-xl bg-muted px-4 py-2.5 text-[13px] text-muted-foreground xs:mx-0">
      <Lock className="size-3.5 shrink-0" />
      Only owners and admins can change these settings.
    </div>
  );
}
