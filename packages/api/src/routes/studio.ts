import { Elysia, t } from "elysia";
import * as studio from "@qubo/studio";
import { tenancy } from "../plugins/tenancy";
import { assertSiteAccess } from "../lib/tenancy";
import { db } from "@qubo/db/client";
import { siteSettings } from "@qubo/db/schema";
import { eq } from "drizzle-orm";

/**
 * Studio documents, themes and translations. Thin HTTP adapter over
 * @qubo/studio — qubo-admin calls the same services directly from
 * server actions, so rules (tenancy, versions, validation) live there.
 *
 * Draft saves use HTTP preconditions: `If-Match: <draftVersion>`; a stale
 * version returns 409 with the current version.
 */
function fail(error: unknown, status: (code: number, body: unknown) => unknown) {
  if (error instanceof studio.ConflictError) return status(409, { error: "conflict", current: error.current });
  if (error instanceof studio.ValidationError) return status(422, { error: "invalid", issues: error.issues });
  if (studio.isStudioError(error)) return status(error.status, { error: error.code, message: error.message });
  throw error;
}

const version = (h: string | undefined) => {
  const n = Number(h?.replace(/"/g, ""));
  return Number.isInteger(n) && n > 0 ? n : null;
};

export const studioRoutes = new Elysia({ prefix: "/studio" })
  .use(tenancy)
  .resolve(async ({ site, actor, status }) => {
    if (!site) return status(400, { error: "site_not_resolved" });
    if (!actor || !(await assertSiteAccess(actor, site))) return status(403, { error: "forbidden" });
    return { scope: { siteId: site.id, userId: actor.id } satisfies studio.Scope, siteSlug: site.slug };
  })

  .get("/views", ({ scope }) => studio.viewIndex(scope))

  // ------------------------------------------------------------ documents ---
  .get("/documents/:id", async ({ scope, params, status, set }) => {
    try {
      const doc = await studio.getDocument(scope, params.id);
      set.headers.etag = `"${doc.draftVersion}"`;
      return doc;
    } catch (e) {
      return fail(e, status);
    }
  })
  .put(
    "/documents/:id/draft",
    async ({ scope, params, body, headers, status, set }) => {
      const base = version(headers["if-match"]);
      if (!base) return status(428, { error: "precondition_required", message: "Send If-Match: <draftVersion>." });
      try {
        const res = await studio.saveDraft(scope, { id: params.id, data: body, baseVersion: base });
        set.headers.etag = `"${res.version}"`;
        return res;
      } catch (e) {
        return fail(e, status);
      }
    },
    { body: t.Object({ root: t.Any(), content: t.Array(t.Any()), zones: t.Optional(t.Any()) }, { additionalProperties: true }) },
  )
  .post(
    "/documents/:id/publish",
    async ({ scope, siteSlug, params, body, status }) => {
      try {
        const res = await studio.publish(scope, { id: params.id, label: body?.label, baseVersion: body?.baseVersion });
        await studio.notifyRevalidate(siteSlug, [studio.documentTag(params.id)]);
        return res;
      } catch (e) {
        return fail(e, status);
      }
    },
    { body: t.Optional(t.Object({ label: t.Optional(t.String({ maxLength: 120 })), baseVersion: t.Optional(t.Integer()) })) },
  )
  .post(
    "/documents/:id/discard",
    async ({ scope, params, status }) => {
      try {
        return await studio.discardDraft(scope, params.id);
      } catch (e) {
        return fail(e, status);
      }
    },
  )
  .get("/documents/:id/revisions", async ({ scope, params, status }) => {
    try {
      return { revisions: await studio.listRevisions(scope, params.id) };
    } catch (e) {
      return fail(e, status);
    }
  })
  .get("/documents/:id/revisions/:revisionId", async ({ scope, params, status }) => {
    try {
      return await studio.getRevision(scope, params.id, params.revisionId);
    } catch (e) {
      return fail(e, status);
    }
  })
  .post(
    "/documents/:id/checkpoints",
    async ({ scope, params, body, status }) => {
      try {
        return await studio.createCheckpoint(scope, { id: params.id, label: body?.label });
      } catch (e) {
        return fail(e, status);
      }
    },
    { body: t.Optional(t.Object({ label: t.Optional(t.String({ maxLength: 120 })) })) },
  )
  .post("/documents/:id/revisions/:revisionId/restore", async ({ scope, params, status }) => {
    try {
      return await studio.restoreRevision(scope, { id: params.id, revisionId: params.revisionId });
    } catch (e) {
      return fail(e, status);
    }
  })
  .post("/documents/:id/revisions/:revisionId/rollback", async ({ scope, siteSlug, params, status }) => {
    try {
      const res = await studio.rollback(scope, { id: params.id, revisionId: params.revisionId });
      await studio.notifyRevalidate(siteSlug, [studio.documentTag(params.id)]);
      return res;
    } catch (e) {
      return fail(e, status);
    }
  })
  .post("/documents/:id/preview-token", async ({ scope, params, status }) => {
    try {
      await studio.getDocument(scope, params.id);
      return { token: studio.createPreviewToken({ siteId: scope.siteId, documentId: params.id }) };
    } catch (e) {
      return fail(e, status);
    }
  })

  // --------------------------------------------------------- translations ---
  .get(
    "/documents/:id/translations/:locale",
    async ({ scope, params, status }) => {
      try {
        return { entries: await studio.listDocumentTranslations(scope, params.id, params.locale) };
      } catch (e) {
        return fail(e, status);
      }
    },
  )
  .put(
    "/documents/:id/translations/:locale",
    async ({ scope, params, body, status }) => {
      try {
        return await studio.upsertDocumentTranslations(scope, {
          documentId: params.id,
          locale: params.locale,
          entries: body.entries,
        });
      } catch (e) {
        return fail(e, status);
      }
    },
    {
      body: t.Object({
        entries: t.Array(
          t.Object({
            path: t.String(),
            value: t.String({ maxLength: 20_000 }),
            status: t.Optional(t.Union([t.Literal("draft"), t.Literal("done")])),
          }),
          { maxItems: 500 },
        ),
      }),
    },
  )

  .get(
    "/translations/stale",
    async ({ scope, query }) => ({ entries: await studio.listStaleTranslations(scope, query.locale) }),
    { query: t.Object({ locale: t.Optional(t.String()) }) },
  )

  // ---------------------------------------------------- pages & templates ---
  .get("/pages", async ({ scope }) => ({ pages: await studio.listPages(scope) }))
  .post(
    "/pages",
    async ({ scope, body, status }) => {
      try {
        return await studio.createPage(scope, body);
      } catch (e) {
        return fail(e, status);
      }
    },
    {
      body: t.Object({
        title: t.String({ minLength: 1, maxLength: 200 }),
        slug: t.Optional(t.String({ maxLength: 200 })),
        templateHandle: t.Optional(t.Nullable(t.String())),
        metaDescription: t.Optional(t.String({ maxLength: 320 })),
      }),
    },
  )
  .patch(
    "/pages/:id",
    async ({ scope, params, body, status }) => {
      try {
        return await studio.updatePage(scope, params.id, body);
      } catch (e) {
        return fail(e, status);
      }
    },
    {
      body: t.Object({
        title: t.Optional(t.String({ maxLength: 200 })),
        slug: t.Optional(t.String({ maxLength: 200 })),
        metaTitle: t.Optional(t.Nullable(t.String({ maxLength: 200 }))),
        metaDescription: t.Optional(t.Nullable(t.String({ maxLength: 320 }))),
        templateHandle: t.Optional(t.Nullable(t.String())),
      }),
    },
  )
  .delete("/pages/:id", async ({ scope, params, status }) => {
    try {
      await studio.deletePage(scope, params.id);
      return { ok: true };
    } catch (e) {
      return fail(e, status);
    }
  })
  .post(
    "/templates",
    async ({ scope, body, status }) => {
      const kinds: string[] = studio.viewGroups.flatMap((g) => g.kinds);
      if (!kinds.includes(body.resourceKind)) return status(422, { error: "invalid", message: "Unknown resource kind." });
      try {
        return await studio.createTemplate(scope, { ...body, resourceKind: body.resourceKind as studio.ResourceKind });
      } catch (e) {
        return fail(e, status);
      }
    },
    {
      body: t.Object({
        resourceKind: t.String(),
        handle: t.String({ minLength: 1, maxLength: 60 }),
        name: t.String({ maxLength: 120 }),
        copyFromTemplateId: t.Optional(t.String()),
      }),
    },
  )
  .delete("/templates/:id", async ({ scope, params, status }) => {
    try {
      await studio.deleteTemplate(scope, params.id);
      return { ok: true };
    } catch (e) {
      return fail(e, status);
    }
  })

  // --------------------------------------------------------------- themes ---
  .get("/themes", ({ scope }) => studio.listThemes(scope).then((themes) => ({ themes })))
  .get("/themes/:id", async ({ scope, params, status }) => {
    try {
      return await studio.getTheme(scope, params.id);
    } catch (e) {
      return fail(e, status);
    }
  })
  .put(
    "/themes/:id/draft",
    async ({ scope, params, body, headers, status }) => {
      const base = version(headers["if-match"]);
      if (!base) return status(428, { error: "precondition_required", message: "Send If-Match: <draftVersion>." });
      try {
        return await studio.saveThemeDraft(scope, { id: params.id, data: body, baseVersion: base });
      } catch (e) {
        return fail(e, status);
      }
    },
    { body: t.Record(t.String(), t.Any()) },
  )
  .post("/themes/:id/publish", async ({ scope, siteSlug, params, status }) => {
    try {
      const res = await studio.publishTheme(scope, { id: params.id });
      await studio.notifyRevalidate(siteSlug, [studio.themeTag(scope.siteId)]);
      return res;
    } catch (e) {
      return fail(e, status);
    }
  })
  .post("/themes/:id/activate", async ({ scope, siteSlug, params, status }) => {
    try {
      await studio.activateTheme(scope, params.id);
      await studio.notifyRevalidate(siteSlug, [studio.themeTag(scope.siteId)]);
      return { ok: true };
    } catch (e) {
      return fail(e, status);
    }
  })
  .get("/themes/:id/revisions", async ({ scope, params, status }) => {
    try {
      return { revisions: await studio.listThemeRevisions(scope, params.id) };
    } catch (e) {
      return fail(e, status);
    }
  });

/**
 * Anonymous storefront reads: published documents (with locale overlay), the
 * live theme, and draft previews via signed token.
 */
/**
 * Site preview (`preview.<domain>`): the storefront forwards the visitor's
 * unlocked token as `x-qubo-preview`; when it checks out, render routes serve
 * drafts. Anything else (missing, forged, PIN regenerated) is plain published.
 */
async function previewGranted(siteId: string, headers: Record<string, string | undefined>): Promise<boolean> {
  const token = headers["x-qubo-preview"];
  if (!token) return false;
  const settings = await db.query.siteSettings.findFirst({ where: eq(siteSettings.siteId, siteId), columns: { previewPin: true } });
  return studio.verifySitePreviewToken(token, { id: siteId, pin: settings?.previewPin ?? null });
}

export const studioPublic = new Elysia({ prefix: "/render" })
  .use(tenancy)
  .post(
    "/preview/unlock",
    async ({ site, body, status }) => {
      if (!site) return status(400, { error: "site_not_resolved" });
      const settings = await db.query.siteSettings.findFirst({ where: eq(siteSettings.siteId, site.id), columns: { previewPin: true } });
      if (!settings?.previewPin || settings.previewPin !== body.pin.trim()) return status(403, { error: "invalid_pin" });
      return { token: studio.createSitePreviewToken({ siteId: site.id, pin: settings.previewPin }), maxAge: studio.SITE_PREVIEW_TTL_SECONDS };
    },
    { body: t.Object({ pin: t.String({ maxLength: 16 }) }) },
  )
  .get("/preview/check", async ({ site, headers, status }) => {
    if (!site) return status(400, { error: "site_not_resolved" });
    return { granted: await previewGranted(site.id, headers) };
  })
  .get(
    "/documents/:id",
    async ({ site, params, query, status, headers }) => {
      if (!site) return status(400, { error: "site_not_resolved" });
      if (await previewGranted(site.id, headers)) {
        const data = await studio.renderableDocument(site.id, params.id, query.locale, { draft: true });
        if (!data) return status(404, { error: "not_found" });
        return { data, draft: true };
      }
      if (query.preview) {
        const grant = studio.verifyPreviewToken(query.preview);
        if (!grant || grant.siteId !== site.id || grant.documentId !== params.id) {
          return status(403, { error: "invalid_preview_token" });
        }
        const doc = await studio.getDocument({ siteId: site.id }, params.id);
        return { data: doc.draft, draft: true };
      }
      const data = await studio.renderableDocument(site.id, params.id, query.locale);
      if (!data) return status(404, { error: "not_found" });
      return { data, draft: false };
    },
    { query: t.Object({ locale: t.Optional(t.String()), preview: t.Optional(t.String()) }) },
  )
  .get(
    "/templates/:kind",
    async ({ site, params, query, status, headers }) => {
      if (!site) return status(400, { error: "site_not_resolved" });
      const id = await studio.templateDocumentId(site.id, params.kind as studio.ResourceKind, query.handle);
      if (!id) return status(404, { error: "not_found" });
      const data = await studio.renderableDocument(site.id, id, query.locale, { draft: await previewGranted(site.id, headers) });
      if (!data) return status(404, { error: "not_found" });
      return { documentId: id, data };
    },
    { query: t.Object({ locale: t.Optional(t.String()), handle: t.Optional(t.String()) }) },
  )
  .get(
    "/layout",
    async ({ site, query, status, headers }) => {
      if (!site) return status(400, { error: "site_not_resolved" });
      const draft = await previewGranted(site.id, headers);
      const load = async (kind: studio.SectionGroupKind) => {
        const id = await studio.sectionGroupDocumentId(site.id, kind);
        return id ? studio.renderableDocument(site.id, id, query.locale, { draft }) : null;
      };
      const [header, footer, theme, settings] = await Promise.all([
        load("header"),
        load("footer"),
        studio.getLiveTheme(site.id),
        db.query.siteSettings.findFirst({ where: eq(siteSettings.siteId, site.id) }),
      ]);
      const endsAt = settings?.maintenanceEnd ?? null;
      const maintenance = {
        active: Boolean(settings?.maintenanceMode) && !(endsAt && endsAt < new Date()),
        message: settings?.maintenanceMessage ?? null,
        endsAt,
      };
      return { site, header, footer, theme, maintenance };
    },
    { query: t.Object({ locale: t.Optional(t.String()) }) },
  )
  .get(
    "/pages/*",
    async ({ site, params, query, status, headers }) => {
      if (!site) return status(400, { error: "site_not_resolved" });
      const draft = await previewGranted(site.id, headers);
      const found = await studio.publishedPage(site.id, decodeURIComponent(params["*"] ?? "").replace(/^\/+|\/+$/g, ""), { includeDrafts: draft });
      if (!found?.documentId) return status(404, { error: "not_found" });
      const data = await studio.renderableDocument(site.id, found.documentId, query.locale, { draft });
      if (!data) return status(404, { error: "not_found" });
      return { documentId: found.documentId, title: found.title, metaTitle: found.metaTitle, metaDescription: found.metaDescription, data };
    },
    { query: t.Object({ locale: t.Optional(t.String()) }) },
  )
  .get("/theme.css", async ({ site, status, set, headers }) => {
    if (!site) return status(400, { error: "site_not_resolved" });
    const compiled = await studio.liveThemeCss(site.id);
    if (!compiled) return status(404, { error: "not_found" });
    const etag = `"${compiled.hash}"`;
    set.headers.etag = etag;
    set.headers["cache-control"] = "public, max-age=60, stale-while-revalidate=600";
    if (headers["if-none-match"] === etag) return status(304, "");
    set.headers["content-type"] = "text/css; charset=utf-8";
    return compiled.css;
  })
  .get("/theme", async ({ site, status }) => {
    if (!site) return status(400, { error: "site_not_resolved" });
    const theme = await studio.getLiveTheme(site.id);
    if (!theme) return status(404, { error: "not_found" });
    return { theme };
  });
