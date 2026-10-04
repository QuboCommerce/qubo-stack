"use client";

import { updateConversationAction } from "@/app/inbox-actions";

const select = "h-8 rounded-lg border bg-background px-2 text-[13px]";

/** A select that saves on change (one field per form). */
function Field({ site, id, name, value, children, label }: { site: string; id: string; name: string; value: string; children: React.ReactNode; label: string }) {
  return (
    <form action={updateConversationAction}>
      <input type="hidden" name="site" value={site} />
      <input type="hidden" name="id" value={id} />
      <select name={name} defaultValue={value} key={value} aria-label={label} className={select} onChange={(e) => e.currentTarget.form?.requestSubmit()}>
        {children}
      </select>
    </form>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function ThreadControls({
  site,
  id,
  status,
  priority,
  assigneeId,
  members,
}: {
  site: string;
  id: string;
  status: string;
  priority: string;
  assigneeId: string | null;
  members: { id: string; name: string }[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Field site={site} id={id} name="status" value={status} label="Status">
        {["open", "pending", "resolved"].map((s) => (
          <option key={s} value={s}>{cap(s)}</option>
        ))}
        {status === "snoozed" && <option value="snoozed">Snoozed</option>}
      </Field>
      <Field site={site} id={id} name="priority" value={priority} label="Priority">
        {["low", "normal", "high", "urgent"].map((p) => (
          <option key={p} value={p}>{cap(p)}</option>
        ))}
      </Field>
      <Field site={site} id={id} name="assigneeId" value={assigneeId ?? ""} label="Assignee">
        <option value="">Unassigned</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>{m.name}</option>
        ))}
      </Field>
    </div>
  );
}
