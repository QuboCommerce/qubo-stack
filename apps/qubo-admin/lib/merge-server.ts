import "server-only";
import { db } from "@qubo/db/client";
import { sql, type AnyColumn } from "drizzle-orm";
import { applyValues, parseBase, readForm, threeWay, type Conflict, type FormValues, type MergeSpec } from "@/lib/merge";

/** Name of whoever last saved this row, from the event log. */
async function lastEditor(siteId: string, table: string, id: string) {
  const rows = await db.execute<{ name: string | null }>(sql`
    select payload->'by'->>'name' as name from platform_event
    where type = 'entity.updated' and site_id = ${siteId} and payload->>'table' = ${table} and payload->>'id' = ${id}
    order by id desc limit 1`);
  return rows[0]?.name ?? null;
}

/**
 * Merges a submitted form with the row's current values. Returns the form
 * data to save (theirs-only fields folded in) or a conflict for the merge
 * sheet. `_preview=1` always returns the conflict shape without saving.
 * Forms without `_base` (new rows) pass through untouched.
 */
export async function reconcile(
  formData: FormData,
  spec: MergeSpec,
  theirs: FormValues,
  row: { siteId: string; table: string; id: string },
): Promise<{ formData: FormData } | { conflict: Conflict }> {
  const base = parseBase(formData);
  if (!base) return { formData };
  const { merged, fields, auto } = threeWay(spec, base, readForm(formData, spec), theirs);
  if (fields.length || formData.get("_preview") === "1") {
    return {
      conflict: {
        theirs,
        merged,
        fields,
        auto: auto.map((n) => spec[n]!.label),
        by: fields.length || auto.length ? await lastEditor(row.siteId, row.table, row.id) : null,
      },
    };
  }
  return { formData: applyValues(formData, merged) };
}

export const RACE = "Someone saved this at the same moment. Save again to merge their changes.";

/** CAS on a timestamp column read earlier (JS dates carry ms, Postgres µs). */
export const unchangedSince = (column: AnyColumn, seen: Date) =>
  sql`date_trunc('milliseconds', ${column}) = ${seen.toISOString()}::timestamp`;
