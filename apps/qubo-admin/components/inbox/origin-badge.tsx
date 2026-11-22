import type { ReactNode } from "react";
import { channelIcon } from "@/components/inbox/icons";
import { cn } from "@qubo/shared/utils";

/** Where a conversation came from: the form's name for form posts, else the channel. */
export function OriginBadge({ channel, label, className }: { channel: keyof typeof channelIcon; label: ReactNode; className?: string }) {
  const Icon = channelIcon[channel];
  return (
    <span className={cn("inline-flex h-5 shrink-0 items-center gap-1 rounded-md bg-muted px-1.5 text-[11px] font-medium text-muted-foreground", className)}>
      <Icon className="size-3 shrink-0" />
      <span className="truncate">{label}</span>
    </span>
  );
}
