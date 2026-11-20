import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { db } from "@qubo/db/client";
import { collection, product } from "@qubo/db/schema";
import { parseRules } from "@qubo/db/collection-rules";
import { and, asc, eq, isNotNull, ne } from "drizzle-orm";
import { saveCollection } from "@/app/collection-actions";
import { CollectionEditor, type CollectionEditorValues } from "@/components/collections/collection-editor";
import { DeleteCollectionButton } from "@/components/collections/delete-collection-button";
import { Page } from "@/components/page";
import { SettingsForm } from "@/components/settings/settings-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireSite } from "@/lib/admin";
import { getCategoryTree } from "@/lib/categories";
import { collectionValues, pickedCards, pickedIds, previewDraft } from "@/lib/collections";

const uuid = /^[0-9a-f-]{36}$/i;

export async function generateMetadata() {
  const t = await getTranslations("collections.editor");
  return { title: t("metaTitle") };
}

export default async function CollectionPage({ params }: { params: Promise<{ site: string; id: string }> }) {
  const { site: slug, id } = await params;
  const { site, siteId } = await requireSite(slug);
  const isNew = id === "new";
  if (!isNew && !uuid.test(id)) notFound();

  const [[row], tree, brands, t, format] = await Promise.all([
    isNew ? Promise.resolve([null]) : db.select().from(collection).where(and(eq(collection.id, id), eq(collection.siteId, siteId))).limit(1),
    getCategoryTree(siteId),
    db
      .selectDistinct({ brand: product.brand })
      .from(product)
      .where(and(eq(product.siteId, siteId), isNotNull(product.brand), ne(product.brand, "")))
      .orderBy(asc(product.brand))
      .limit(300),
    getTranslations("collections"),
    getFormatter(),
  ]);
  if (!isNew && !row) notFound();

  const ids = row ? await pickedIds(row.id) : [];
  const initial: CollectionEditorValues = row
    ? {
        name: row.name,
        slug: row.slug,
        description: row.description ?? "",
        image: row.image ?? "",
        metaTitle: row.metaTitle ?? "",
        metaDescription: row.metaDescription ?? "",
        kind: row.kind,
        match: row.match,
        rules: parseRules(row.rules),
        sort: row.sort,
        isPublished: row.isPublished,
      }
    : {
        name: "",
        slug: "",
        description: "",
        image: "",
        metaTitle: "",
        metaDescription: "",
        kind: "smart",
        match: "all",
        rules: [{ field: "sku", op: "startsWith", value: "" }],
        sort: "featured",
        isPublished: false,
      };
  const [picks, preview] = await Promise.all([
    pickedCards(siteId, ids),
    previewDraft(siteId, { kind: initial.kind, match: initial.match, rules: initial.rules, productIds: ids, sort: initial.sort }),
  ]);
  const liveUrl = row?.isPublished && site.url ? `${site.url}/collections/${row.slug}` : null;

  return (
    <Page
      title={row?.name ?? t("editor.newTitle")}
      backHref={`/${site.slug}/products/collections`}
      width="wide"
      badge={
        row ? (
          row.isPublished ? (
            <Badge className="border-transparent bg-success/15 text-success">{t("status.published")}</Badge>
          ) : (
            <Badge variant="secondary">{t("status.draft")}</Badge>
          )
        ) : undefined
      }
      actions={
        row ? (
          <>
            {liveUrl && (
              <Button variant="outline" size="sm" asChild>
                <a href={liveUrl} target="_blank" rel="noreferrer">
                  <ExternalLink /> {t("editor.viewOnSite")}
                </a>
              </Button>
            )}
            <DeleteCollectionButton site={site.slug} id={row.id} name={row.name} />
          </>
        ) : undefined
      }
    >
      <SettingsForm
        action={saveCollection}
        className="@container"
        noun="collection"
        base={row ? collectionValues(row, ids) : undefined}
        watch={row ? { table: "collection", id: row.id } : undefined}
      >
        <input type="hidden" name="site" value={site.slug} />
        <input type="hidden" name="id" value={id} />
        <CollectionEditor
          site={{ slug: site.slug, id: siteId, currency: site.currency ?? "EUR" }}
          isNew={isNew}
          initial={initial}
          initialPicks={picks}
          initialPreview={preview}
          categories={tree.map(({ id, name, slug, depth }) => ({ id, name, slug, depth }))}
          brands={brands.map((b) => b.brand ?? "").filter(Boolean)}
          footer={
            row ? <p className="px-1 text-xs text-muted-foreground">{t("editor.updated", { time: format.relativeTime(new Date(row.updatedAt)) })}</p> : undefined
          }
        />
      </SettingsForm>
    </Page>
  );
}
