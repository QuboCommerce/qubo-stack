import { Bot, ClipboardList, Mail, MessageCircle, Ticket } from "lucide-react";

/** One icon per origin, shared by list badges, the thread toolbar and the sidebar lenses. */
export const channelIcon = { form: ClipboardList, email: Mail, chat: MessageCircle, portal: Ticket, system: Bot } as const;
export const ticketIcon = Ticket;

export const statusDot: Record<string, string> = {
  open: "bg-sky-500/70",
  pending: "bg-amber-500/70",
  snoozed: "bg-violet-500/60",
  resolved: "bg-emerald-600/60",
};

/** A form thread's default subject is "<form> · <who>"; the badge already says the form. */
export function shortSubject(subject: string, formName: string | null | undefined): string {
  return formName && subject.startsWith(`${formName} · `) ? subject.slice(formName.length + 3) : subject;
}
