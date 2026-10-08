/**
 * Three-way merge for admin forms. A form is rendered with a *base* snapshot
 * of its values (hidden `_base`); on save the action compares base, the
 * submitted values (mine) and the current row (theirs). Fields only one side
 * changed resolve automatically; fields both sides changed differently are
 * returned as a conflict for the merge sheet. Values use the form's own
 * representation: strings, "on"/"" for switches, sorted arrays for multi.
 */
export type FormValue = string | string[];
export type FormValues = Record<string, FormValue>;

export type FieldSpec = { label: string; multi?: boolean; format?: (v: FormValue) => string };
export type MergeSpec = Record<string, FieldSpec>;

export type ConflictField = { name: string; label: string; mine: FormValue; theirs: FormValue; mineText: string; theirsText: string };

export type Conflict = {
  /** The current row: the new base once resolved. */
  theirs: FormValues;
  /** Values to submit: mine where only I changed, theirs where only they did. */
  merged: FormValues;
  fields: ConflictField[];
  /** Fields they changed that merge without asking. */
  auto: string[];
  by: string | null;
};

const norm = (v: FormValue | undefined): FormValue =>
  Array.isArray(v) ? [...v].map(String).sort() : String(v ?? "").replace(/\r\n?/g, "\n").trim();

export function same(a: FormValue | undefined, b: FormValue | undefined) {
  const x = norm(a);
  const y = norm(b);
  return Array.isArray(x) || Array.isArray(y) ? JSON.stringify(x) === JSON.stringify(y) : x === y;
}

export function readForm(fd: FormData, spec: MergeSpec): FormValues {
  const out: FormValues = {};
  for (const [name, f] of Object.entries(spec)) {
    out[name] = f.multi ? fd.getAll(name).map(String).sort() : String(fd.get(name) ?? "");
  }
  return out;
}

export function parseBase(fd: FormData): FormValues | null {
  const raw = fd.get("_base");
  if (typeof raw !== "string" || !raw) return null;
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as FormValues) : null;
  } catch {
    return null;
  }
}

const text = (f: FieldSpec, v: FormValue) => {
  if (f.format) return f.format(v);
  if (Array.isArray(v)) return v.length ? v.join(", ") : "None";
  return v === "" ? "Empty" : v;
};

export function threeWay(spec: MergeSpec, base: FormValues, mine: FormValues, theirs: FormValues) {
  const merged: FormValues = {};
  const fields: ConflictField[] = [];
  const auto: string[] = [];
  for (const [name, f] of Object.entries(spec)) {
    const b = base[name];
    const m = mine[name];
    const t = theirs[name];
    if (same(m, t)) merged[name] = m;
    else if (same(m, b)) {
      merged[name] = t;
      auto.push(name);
    } else if (same(t, b)) merged[name] = m;
    else {
      merged[name] = m;
      fields.push({ name, label: f.label, mine: m, theirs: t, mineText: text(f, m), theirsText: text(f, t) });
    }
  }
  return { merged, fields, auto };
}

/** Replaces the spec'd fields of `fd` with `values` ("" switch = unchecked). */
export function applyValues(fd: FormData, values: FormValues) {
  for (const [name, v] of Object.entries(values)) {
    fd.delete(name);
    if (Array.isArray(v)) for (const x of v) fd.append(name, x);
    else if (v !== "") fd.set(name, v);
  }
  return fd;
}
