import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDocument, getTheme, isStudioError, resolveView, viewIndex } from "@peltier/studio";
import { ThemeSchema, type Theme } from "@peltier/stylekit";
import { requireSite } from "@/lib/admin";
import { getActiveTheme } from "@/lib/queries";
import { siteMeta } from "@/lib/studio";
import { StudioEditor } from "@/components/studio/studio-editor";

type Params = { site: string; view?: string[] };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { site } = await params;
  const { site: current } = await requireSite(site);
  return { title: current.name };
}

export default async function StudioPage({ params }: { params: Promise<Params> }) {
  const { site: slug, view: segments = [] } = await params;
  const { user, site, siteId } = await requireSite(slug);
  const scope = { siteId, userId: user.id };

  const index = await viewIndex(scope);
  const key = segments.length === 2 ? `${segments[0]}:${segments[1]}` : segments.length === 0 ? index.groups[0]?.entries[0]?.key : null;
  if (!key) notFound();

  const view = await resolveView(scope, key).catch((e) => {
    if (isStudioError(e)) notFound();
    throw e;
  });
  const [doc, themeRow] = await Promise.all([getDocument(scope, view.documentId), getActiveTheme(siteId)]);

  // Studio previews the theme draft, so theme edits show up before they go live.
  const parsed = ThemeSchema.safeParse(themeRow?.draft);
  const theme: Theme | null = parsed.success ? parsed.data : ((themeRow?.published as Theme | null) ?? null);
  const themeView = themeRow && parsed.success ? await getTheme(scope, themeRow.id) : null;

  return (
    <StudioEditor
      key={view.key}
      site={{ ...siteMeta(site), slug: site.slug }}
      index={index}
      view={view}
      document={{
        id: doc.id,
        data: doc.draft,
        version: doc.draftVersion,
        hasUnpublishedChanges: doc.hasUnpublishedChanges,
      }}
      theme={theme}
      themeRecord={
        themeView && parsed.success
          ? {
              id: themeView.id,
              version: themeView.draftVersion,
              hasUnpublishedChanges: themeView.hasUnpublishedChanges,
              publishedAt: themeView.publishedAt?.toISOString() ?? null,
              data: parsed.data,
            }
          : null
      }
      audience={user.role === "ADMIN" ? "builder" : "merchant"}
      canPublish={site.memberRole === "OWNER" || site.memberRole === "ADMIN"}
      locale={site.locale}
    />
  );
}
