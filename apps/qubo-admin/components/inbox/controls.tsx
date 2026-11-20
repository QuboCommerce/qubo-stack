"use client";

import { SNOOZE_OPTIONS } from "@qubo/inbox";
import { useTranslations } from "next-intl";
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

export function ThreadControls({
  site,
  id,
  status,
  priority,
  assigneeId,
  snoozedUntil,
  members,
}: {
  site: string;
  id: string;
  status: string;
  priority: string;
  assigneeId: string | null;
  /** Pre-formatted wake-up time, shown while snoozed. */
  snoozedUntil?: string | null;
  members: { id: string; name: string }[];
}) {
  const t = useTranslations("inbox");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Field site={site} id={id} name="status" value={status} label={t("controls.status")}>
        {(["open", "pending", "resolved"] as const).map((s) => (
          <option key={s} value={s}>{t(`statuses.${s}`)}</option>
        ))}
        {status === "snoozed" && <option value="snoozed">{t("statuses.snoozed")}</option>}
      </Field>
      {status !== "resolved" && (
        <Field site={site} id={id} name="snooze" value="" label={t("controls.snooze")}>
          <option value="" disabled>
            {status === "snoozed" && snoozedUntil ? t("controls.wakes", { time: snoozedUntil }) : t("controls.snooze")}
          </option>
          {(Object.keys(SNOOZE_OPTIONS) as (keyof typeof SNOOZE_OPTIONS)[]).map((k) => (
            <option key={k} value={k}>{t(`controls.snoozeOptions.${k}`)}</option>
          ))}
        </Field>
      )}
      <Field site={site} id={id} name="priority" value={priority} label={t("controls.priority")}>
        {(["low", "normal", "high", "urgent"] as const).map((p) => (
          <option key={p} value={p}>{t(`priorities.${p}`)}</option>
        ))}
      </Field>
      <Field site={site} id={id} name="assigneeId" value={assigneeId ?? ""} label={t("controls.assignee")}>
        <option value="">{t("controls.unassigned")}</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>{m.name}</option>
        ))}
      </Field>
    </div>
  );
}
