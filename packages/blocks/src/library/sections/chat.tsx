import { defineBlock, f } from "../../core";
import { ChatWidget } from "../chat";

const text = (label: string, value: string, multiline = false) => f.text({ label, default: value, inline: false, multiline });

/**
 * Floating live chat for the whole page. Put it in the footer layout to have it
 * on every page. Messages land in the admin inbox; staff replies come back live.
 */
export const ChatLauncher = defineBlock({
  name: "ChatLauncher",
  label: "Live chat",
  description: "Floating chat button. Visitors' messages land in the inbox and staff replies appear live. Add it to the footer to show it site-wide.",
  category: "leads",
  icon: "message-circle",
  requires: ["leads"],
  keywords: ["chat", "live chat", "support", "messenger", "help", "contact"],
  fields: {
    title: text("Panel title", "Chat with us"),
    greeting: text("Greeting", "Hi! How can we help? We usually reply within a few hours.", true),
    launcher: text("Button label (screen readers, wide screens)", "Chat with us"),
    position: f.select(["right", "left"], { label: "Position", default: "right", group: "style" }),
    askContact: f.select(
      [
        { label: "Ask for name and e-mail (optional)", value: "optional" },
        { label: "Require an e-mail address", value: "required" },
        { label: "Don't ask", value: "off" },
      ],
      { label: "Contact details", default: "optional" },
    ),
    labels: f.group(
      {
        placeholder: text("Message field", "Type your message…"),
        send: text("Send button", "Send"),
        name: text("Name field", "Your name"),
        email: text("E-mail field", "E-mail"),
        contactHint: text("Contact hint", "Leave your e-mail and we'll also reply there if you've left.", true),
        error: text("Send error", "Your message wasn't sent. Please try again."),
        close: text("Close button (screen readers)", "Close chat"),
      },
      { label: "Labels", collapsed: true },
    ),
  },
  render: (p, ctx) => {
    const siteId = ctx.metadata.site?.id;
    const editing = ctx.isEditing || !siteId;
    return (
      <ChatWidget
        siteId={siteId ?? "preview"}
        preview={editing}
        position={p.position}
        askContact={p.askContact}
        labels={{ ...p.labels, title: p.title, greeting: p.greeting, launcher: p.launcher }}
      />
    );
  },
});

export const chatBlocks = [ChatLauncher];
