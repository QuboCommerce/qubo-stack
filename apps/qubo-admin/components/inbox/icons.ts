import { Bot, FileText, Mail, MessageCircle, Ticket } from "lucide-react";

export const channelIcon = { form: FileText, email: Mail, chat: MessageCircle, portal: Ticket, system: Bot } as const;

export const statusDot: Record<string, string> = {
  open: "bg-sky-500/70",
  pending: "bg-amber-500/70",
  snoozed: "bg-violet-500/60",
  resolved: "bg-emerald-600/60",
};
