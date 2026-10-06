import { theme, themeRevision, user } from "@qubo/db/schema";
import { ThemeSchema, diagnoseTheme, type DoctorReport, type Theme, type ThemeInput } from "@qubo/stylekit";
import { and, desc, eq, max, sql } from "drizzle-orm";
import { sameContent } from "./content";
import { db, type Executor, type Scope } from "./db";
import { ConflictError, NotFoundError, ValidationError } from "./errors";

export type StudioTheme = {
  id: string;
  siteId: string;
  name: string;
  isActive: boolean;
  draft: ThemeInput;
  draftVersion: number;
  published: ThemeInput | null;
  publishedAt: Date | null;
  health: number | null;
  richness: string | null;
  hasUnpublishedChanges: boolean;
  updatedAt: Date;
};


/** Compares themes after defaults are applied, so authored vs. normalised copies of the same theme are equal. */
function sameTheme(a: unknown, b: unknown) {
  const pa = ThemeSchema.safeParse(a);
  const pb = ThemeSchema.safeParse(b);
  return pa.success && pb.success ? sameContent(pa.data, pb.data) : sameContent(a, b);
}

function view(row: typeof theme.$inferSelect): StudioTheme {
  return {
    id: row.id,
    siteId: row.siteId,
    name: row.name,
    isActive: row.isActive,
    draft: row.draft as ThemeInput,
    draftVersion: row.draftVersion,
    published: (row.published as ThemeInput | null) ?? null,
    publishedAt: row.publishedAt,
    health: row.health,
    richness: row.richness,
    hasUnpublishedChanges: row.published == null || !sameTheme(row.draft, row.published),
    updatedAt: row.updatedAt,
  };
}

async function load(ex: Executor, scope: Scope, id: string, lock = false) {
  const q = ex
    .select()
    .from(theme)
    .where(and(eq(theme.id, id), eq(theme.siteId, scope.siteId)))
    .limit(1);
  const [row] = lock ? await q.for("update") : await q;
  if (!row) throw new NotFoundError("Theme");
  return row;
}

/** Parses a theme through StyleKit's schema and runs the Palette Doctor. */
export function checkTheme(input: unknown): { theme: Theme; report: DoctorReport } {
  const parsed = ThemeSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
  }
  return { theme: parsed.data, report: diagnoseTheme(parsed.data) };
}

export async function listThemes(scope: Scope): Promise<StudioTheme[]> {
  const rows = await db.select().from(theme).where(eq(theme.siteId, scope.siteId)).orderBy(desc(theme.isActive), theme.name);
  return rows.map(view);
}

export async function getTheme(scope: Scope, id: string) {
  return view(await load(db, scope, id));
}

/**
 * The theme storefronts render: the active theme's published copy. With
 * `draft` (a granted preview only) the unpublished draft wins, so the preview
 * host shows draft pages and the draft theme together.
 */
export async function getLiveTheme(siteId: string, opts: { draft?: boolean } = {}): Promise<ThemeInput | null> {
  const [row] = await db
    .select({ published: theme.published, draft: theme.draft })
    .from(theme)
    .where(and(eq(theme.siteId, siteId), eq(theme.isActive, true)))
    .limit(1);
  const pick = opts.draft ? (row?.draft ?? row?.published) : row?.published;
  return (pick as ThemeInput | null) ?? null;
}

export async function saveThemeDraft(scope: Scope, input: { id: string; data: unknown; baseVersion: number }) {
  // Draft input is stored as authored (ThemeInput), not the parsed/default-filled output.
  const { report } = checkTheme(input.data);
  const [row] = await db
    .update(theme)
    .set({
      draft: input.data as ThemeInput,
      draftVersion: sql`${theme.draftVersion} + 1`,
      health: report.health,
      richness: report.richness.tier,
      updatedAt: new Date(),
    })
    .where(and(eq(theme.id, input.id), eq(theme.siteId, scope.siteId), eq(theme.draftVersion, input.baseVersion)))
    .returning({ version: theme.draftVersion, updatedAt: theme.updatedAt });
  if (!row) {
    const current = await load(db, scope, input.id);
    throw new ConflictError({ version: current.draftVersion, updatedAt: current.updatedAt, updatedById: null });
  }
  return { ...row, report };
}

export async function publishTheme(scope: Scope, input: { id: string; label?: string }) {
  return db.transaction(async (tx) => {
    const row = await load(tx, scope, input.id, true);
    checkTheme(row.draft);
    const [r] = await tx.select({ v: max(themeRevision.version) }).from(themeRevision).where(eq(themeRevision.themeId, row.id));
    const version = (r?.v ?? 0) + 1;
    const publishedAt = new Date();
    const [rev] = await tx
      .insert(themeRevision)
      .values({ themeId: row.id, version, data: row.draft, label: input.label?.trim() || null, createdById: scope.userId ?? null })
      .returning({ id: themeRevision.id });
    await tx.update(theme).set({ published: row.draft, publishedAt }).where(eq(theme.id, row.id));
    return { revisionId: rev!.id, version, publishedAt };
  });
}

/** Makes a published theme the live one; exactly one theme per site is active. */
export async function activateTheme(scope: Scope, id: string) {
  return db.transaction(async (tx) => {
    const row = await load(tx, scope, id, true);
    if (row.published == null) throw new ValidationError([{ path: "", message: "Publish the theme before making it live." }]);
    await tx.update(theme).set({ isActive: false }).where(eq(theme.siteId, scope.siteId));
    await tx.update(theme).set({ isActive: true }).where(eq(theme.id, id));
  });
}

export async function duplicateTheme(scope: Scope, id: string, name?: string) {
  const row = await load(db, scope, id);
  const [copy] = await db
    .insert(theme)
    .values({
      siteId: scope.siteId,
      name: name?.trim() || `Copy of ${row.name}`,
      draft: row.draft,
      health: row.health,
      richness: row.richness,
    })
    .returning();
  return view(copy!);
}

export async function listThemeRevisions(scope: Scope, id: string) {
  await load(db, scope, id);
  return db
    .select({
      id: themeRevision.id,
      version: themeRevision.version,
      label: themeRevision.label,
      createdAt: themeRevision.createdAt,
      createdByName: user.name,
    })
    .from(themeRevision)
    .leftJoin(user, eq(user.id, themeRevision.createdById))
    .where(eq(themeRevision.themeId, id))
    .orderBy(desc(themeRevision.version));
}

/** Copies a theme revision into the draft (publish to go live). */
export async function restoreThemeRevision(scope: Scope, input: { id: string; revisionId: string }) {
  const row = await load(db, scope, input.id);
  const [rev] = await db
    .select()
    .from(themeRevision)
    .where(and(eq(themeRevision.id, input.revisionId), eq(themeRevision.themeId, row.id)))
    .limit(1);
  if (!rev) throw new NotFoundError("Revision");
  return saveThemeDraft(scope, { id: row.id, data: rev.data, baseVersion: row.draftVersion });
}
