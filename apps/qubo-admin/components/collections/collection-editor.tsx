"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { AlertTriangle, ArrowDown, ArrowUp, Check, Hand, ImagePlus, Loader2, Plus, Search, Sparkles, X } from "lucide-react";
import { RULE_FIELDS, type CollectionRule, type CollectionSort, type RuleField, type RuleOp } from "@qubo/db/collection-rules";
import { previewCollection, searchCollectionProducts } from "@/app/collection-actions";
import { QuickPick } from "@/components/media/quick-pick";
import { ProductThumb } from "@/components/products/product-thumb";
import { Field, RadioCard, Select, SwitchRow, TextArea, TextInput, control } from "@/components/settings/controls";
import { Surface } from "@/components/settings/settings-group";
import { Button } from "@/components/ui/button";
import { describeRules } from "@/lib/collection-summary";
import type { ProductCard } from "@/lib/collections";
import { cn } from "@qubo/shared/utils";

export type CollectionEditorValues = {
  name: string;
  slug: string;
  description: string;
  image: string;
  metaTitle: string;
  metaDescription: string;
  kind: "smart" | "manual";
  match: "all" | "any";
  rules: CollectionRule[];
  sort: CollectionSort;
  isPublished: boolean;
};

type Category = { id: string; name: string; slug: string; depth: number };
type Preview = { count: number; items: ProductCard[] };
type Row = CollectionRule & { key: number };
type Draft = { kind: "smart" | "manual"; match: "all" | "any"; rules: CollectionRule[]; productIds: string[]; sort: CollectionSort };

const FIELDS = Object.keys(RULE_FIELDS) as RuleField[];
const FLAGS: RuleField[] = ["onSale", "inStock"];
const SORTS: { value: CollectionSort; key: "featured" | "newest" | "name" | "priceAsc" | "priceDesc" | "manual" }[] = [
  { value: "featured", key: "featured" },
  { value: "newest", key: "newest" },
  { value: "name", key: "name" },
  { value: "price_asc", key: "priceAsc" },
  { value: "price_desc", key: "priceDesc" },
  { value: "manual", key: "manual" },
];
const MAX_PICKS = 500;
const TITLE_MAX = 60;
const DESCRIPTION_MAX = 160;

const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

const serializeRules = (rows: CollectionRule[]) => JSON.stringify(rows.map(({ field, op, value }) => ({ field, op, value })));
const draftKey = (d: Draft) => JSON.stringify([d.kind, d.match, serializeRules(d.rules), d.productIds, d.sort]);

function Card({ title, description, action, children }: { title: string; description?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Surface className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </Surface>
  );
}

/** The value once it has stopped changing for `ms`. */
function useDebounced<T>(value: T, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

type EditorProps = {
  site: { slug: string; id: string; currency: string };
  isNew: boolean;
  initial: CollectionEditorValues;
  initialPicks: ProductCard[];
  initialPreview: Preview;
  categories: Category[];
  brands: string[];
  footer?: React.ReactNode;
};

/**
 * The collection form's interactive part. It lives inside SettingsForm: every value it owns is
 * mirrored into a named input and changes made by buttons tell the form it is dirty. The form's
 * Discard is a native reset, which controlled selects do not follow, so the body remounts instead.
 */
export function CollectionEditor(props: EditorProps) {
  const anchor = useRef<HTMLInputElement>(null);
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    const form = anchor.current?.form;
    if (!form) return;
    const remount = () => setGeneration((g) => g + 1);
    form.addEventListener("reset", remount);
    return () => form.removeEventListener("reset", remount);
  }, []);
  return (
    <>
      <input ref={anchor} type="hidden" name="_editor" value={generation} />
      <EditorBody key={generation} {...props} />
    </>
  );
}

function EditorBody({
  site,
  isNew,
  initial,
  initialPicks,
  initialPreview,
  categories,
  brands,
  footer,
}: EditorProps) {
  const t = useTranslations("collections");
  const format = useFormatter();
  const locale = useLocale();
  const anchor = useRef<HTMLInputElement>(null);
  const nextKey = useRef(0);

  const [name, setName] = useState(initial.name);
  const [slug, setSlug] = useState(initial.slug);
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [kind, setKind] = useState(initial.kind);
  const [match, setMatch] = useState(initial.match);
  const [rows, setRows] = useState<Row[]>(() => initial.rules.map((r) => ({ ...r, key: nextKey.current++ })));
  const [picks, setPicks] = useState<ProductCard[]>(initialPicks);
  const [sort, setSort] = useState<CollectionSort>(initial.sort);
  const [image, setImage] = useState(initial.image);
  const [metaTitle, setMetaTitle] = useState(initial.metaTitle);
  const [metaDescription, setMetaDescription] = useState(initial.metaDescription);

  const money = (v: number | string) => format.number(Number(v), { style: "currency", currency: site.currency });
  const rulesJson = serializeRules(rows);
  const picksJson = JSON.stringify(picks.map((p) => p.id));
  const initialRulesJson = useMemo(() => serializeRules(initial.rules), [initial.rules]);
  const initialPicksJson = useMemo(() => JSON.stringify(initialPicks.map((p) => p.id)), [initialPicks]);

  // Button-driven changes fire no input event, so tell SettingsForm about them.
  const owned = `${rulesJson}|${picksJson}|${image}`;
  const initialOwned = `${initialRulesJson}|${initialPicksJson}|${initial.image}`;
  useEffect(() => {
    if (owned !== initialOwned) anchor.current?.form?.dispatchEvent(new Event("change", { bubbles: true }));
  }, [owned, initialOwned]);

  const clash = categories.find((c) => c.slug === slug);
  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? t("rules.deletedCategory");
  const summary = kind === "smart" ? describeRules(rows, match, { locale, phrase: (key, values) => t(`rules.phrases.${key}`, values), categoryName, money }) : null;
  const draft: Draft = { kind, match, rules: rows.map(({ field, op, value }) => ({ field, op, value })), productIds: picks.map((p) => p.id), sort };
  const initialDraft: Draft = { kind: initial.kind, match: initial.match, rules: initial.rules, productIds: initialPicks.map((p) => p.id), sort: initial.sort };

  return (
    <div className="grid items-start gap-4 @min-[64rem]:grid-cols-[minmax(0,1fr)_20rem] @min-[96rem]:grid-cols-[minmax(0,1fr)_24rem]">
      <input ref={anchor} type="hidden" name="kind" value={kind} />
      <input type="hidden" name="match" value={match} />
      <input type="hidden" name="rules" value={rulesJson} />
      <input type="hidden" name="productIds" value={picksJson} />

      <div className="min-w-0 space-y-4">
        <Card title={t("editor.cards.details")}>
          <Field label={t("editor.fields.name")} htmlFor="name">
            <TextInput
              id="name"
              name="name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slugTouched) setSlug(slugify(e.target.value));
              }}
              required
              maxLength={120}
              placeholder={t("editor.fields.namePlaceholder")}
            />
          </Field>
          <Field label={t("editor.fields.handle")} htmlFor="slug" hint={t("editor.fields.handleHint", { path: `/collections/${slug || "…"}` })}>
            <TextInput
              id="slug"
              name="slug"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setSlugTouched(true);
              }}
              maxLength={80}
              className="font-mono"
            />
          </Field>
          {clash && (
            <p role="status" className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-[13px]">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
              {t("editor.categoryClash", { name: clash.name })}
            </p>
          )}
          <Field label={t("editor.fields.description")} htmlFor="description" hint={t("editor.fields.descriptionHint")}>
            <TextArea id="description" name="description" defaultValue={initial.description} rows={4} maxLength={5000} />
          </Field>
        </Card>

        <Card title={t("editor.cards.products")}>
          <div className="grid gap-2 @min-[36rem]:grid-cols-2">
            <RadioCard
              name="_kind"
              value="smart"
              checked={kind === "smart"}
              onChange={() => {
                setKind("smart");
                if (sort === "manual") setSort("featured");
              }}
              icon={<Sparkles className="size-4" />}
              title={t("editor.kind.smart")}
              description={t("editor.kind.smartHint")}
            />
            <RadioCard
              name="_kind"
              value="manual"
              checked={kind === "manual"}
              onChange={() => setKind("manual")}
              icon={<Hand className="size-4" />}
              title={t("editor.kind.manual")}
              description={t("editor.kind.manualHint")}
            />
          </div>

          {kind === "smart" ? (
            <RuleBuilder
              rows={rows}
              setRows={setRows}
              match={match}
              setMatch={setMatch}
              nextKey={() => nextKey.current++}
              categories={categories}
              brands={brands}
              currency={site.currency}
            />
          ) : (
            <ProductPicker site={site.slug} picks={picks} setPicks={setPicks} money={money} />
          )}

          <Field label={t("editor.fields.sort")} htmlFor="sort" className="max-w-xs">
            <Select id="sort" name="sort" value={sort} onChange={(e) => setSort(e.target.value as CollectionSort)}>
              {SORTS.filter((s) => s.value !== "manual" || kind === "manual").map((s) => (
                <option key={s.value} value={s.value}>
                  {t(`sort.${s.key}`)}
                </option>
              ))}
            </Select>
          </Field>
        </Card>

        <Card title={t("editor.cards.seo")}>
          <Field label={t("editor.fields.metaTitle")} htmlFor="metaTitle" hint={t("editor.fields.length", { count: metaTitle.length, max: TITLE_MAX })}>
            <TextInput id="metaTitle" name="metaTitle" value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} maxLength={120} placeholder={name} />
          </Field>
          <Field
            label={t("editor.fields.metaDescription")}
            htmlFor="metaDescription"
            hint={t("editor.fields.length", { count: metaDescription.length, max: DESCRIPTION_MAX })}
          >
            <TextArea id="metaDescription" name="metaDescription" value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} maxLength={320} rows={3} />
          </Field>
        </Card>
      </div>

      <div className="space-y-4 @min-[64rem]:sticky @min-[64rem]:top-4">
        <Surface flush>
          <SwitchRow name="isPublished" defaultChecked={initial.isPublished} label={t("editor.publish.label")} description={t("editor.publish.hint")} />
        </Surface>
        <PreviewPanel site={site.slug} draft={draft} initialKey={draftKey(initialDraft)} initialPreview={initialPreview} summary={summary} money={money} />
        <ImageCard site={site} image={image} setImage={setImage} />
        {footer}
      </div>
    </div>
  );
}

function RuleBuilder({
  rows,
  setRows,
  match,
  setMatch,
  nextKey,
  categories,
  brands,
  currency,
}: {
  rows: Row[];
  setRows: (fn: (rows: Row[]) => Row[]) => void;
  match: "all" | "any";
  setMatch: (m: "all" | "any") => void;
  nextKey: () => number;
  categories: Category[];
  brands: string[];
  currency: string;
}) {
  const t = useTranslations("collections");
  const update = (key: number, patch: Partial<CollectionRule>) => setRows((all) => all.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const fresh = (field: RuleField): Partial<CollectionRule> => ({
    field,
    op: RULE_FIELDS[field][0] as RuleOp,
    value: FLAGS.includes(field) ? "true" : field === "createdWithinDays" ? "30" : "",
  });
  const add = () => setRows((all) => [...all, { key: nextKey(), field: "sku", op: "startsWith", value: "" }]);

  return (
    <div className="space-y-3 rounded-xl border bg-muted/20 p-3 sm:p-4">
      {rows.length > 1 && (
        <label className="flex flex-wrap items-center gap-2 text-[13px]">
          {t("editor.match.label")}
          <Select value={match} onChange={(e) => setMatch(e.target.value as "all" | "any")} className="h-8 w-auto">
            <option value="all">{t("editor.match.all")}</option>
            <option value="any">{t("editor.match.any")}</option>
          </Select>
        </label>
      )}
      {rows.length === 0 && <p className="text-[13px] text-muted-foreground">{t("editor.noRules")}</p>}
      {rows.length > 0 && (
        <ul className="space-y-2">
          {rows.map((r) => {
            const ops = RULE_FIELDS[r.field] as readonly RuleOp[];
            const flag = FLAGS.includes(r.field);
            return (
              <li
                key={r.key}
                className="grid gap-2 rounded-lg border bg-card p-2 @min-[40rem]:grid-cols-[11rem_11rem_minmax(0,1fr)_auto] @min-[40rem]:items-center"
              >
                <Select aria-label={t("rules.aria.field")} value={r.field} onChange={(e) => update(r.key, fresh(e.target.value as RuleField))}>
                  {FIELDS.map((f) => (
                    <option key={f} value={f}>
                      {t(`rules.fields.${f}`)}
                    </option>
                  ))}
                </Select>
                {flag ? (
                  <p className="px-1 text-[13px] text-muted-foreground @min-[40rem]:col-span-2">{t(`rules.flags.${r.field as "onSale" | "inStock"}`)}</p>
                ) : (
                  <>
                    {ops.length > 1 ? (
                      <Select aria-label={t("rules.aria.operator")} value={r.op} onChange={(e) => update(r.key, { op: e.target.value as RuleOp })}>
                        {ops.map((op) => (
                          <option key={op} value={op}>
                            {opLabel(t, r.field, op)}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <span className="px-1 text-[13px] text-muted-foreground">{opLabel(t, r.field, r.op)}</span>
                    )}
                    <RuleValue rule={r} onChange={(value) => update(r.key, { value })} categories={categories} brands={brands} currency={currency} />
                  </>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="justify-self-end text-muted-foreground"
                  onClick={() => setRows((all) => all.filter((x) => x.key !== r.key))}
                  aria-label={t("editor.removeRule")}
                >
                  <X />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      <Button type="button" variant="outline" size="sm" onClick={add}>
        <Plus /> {t("editor.addRule")}
      </Button>
    </div>
  );
}

type CollectionsT = ReturnType<typeof useTranslations<"collections">>;

function opLabel(t: CollectionsT, field: RuleField, op: RuleOp) {
  switch (field) {
    case "category":
      return t(`rules.ops.category.${op as "is" | "isNot"}`);
    case "sku":
      return t(`rules.ops.sku.${op as "startsWith" | "contains" | "equals"}`);
    case "name":
      return t(`rules.ops.name.${op as "startsWith" | "contains"}`);
    case "brand":
      return t(`rules.ops.brand.${op as "equals" | "contains"}`);
    case "price":
      return t(`rules.ops.price.${op as "gte" | "lte"}`);
    case "createdWithinDays":
      return t("rules.ops.createdWithinDays.lte");
    default:
      return "";
  }
}

function RuleValue({
  rule,
  onChange,
  categories,
  brands,
  currency,
}: {
  rule: CollectionRule;
  onChange: (value: string) => void;
  categories: Category[];
  brands: string[];
  currency: string;
}) {
  const t = useTranslations("collections.rules");
  const label = t("aria.value");
  switch (rule.field) {
    case "category":
      return (
        <Select aria-label={label} value={rule.value} onChange={(e) => onChange(e.target.value)}>
          <option value="">{t("categoryPlaceholder")}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {"\u00a0\u00a0\u00a0".repeat(c.depth)}
              {c.name}
            </option>
          ))}
        </Select>
      );
    case "price":
      return (
        <div className="relative">
          <TextInput aria-label={label} type="number" min={0} step="0.01" inputMode="decimal" value={rule.value} onChange={(e) => onChange(e.target.value)} className="pr-12" />
          <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-xs text-muted-foreground">{currency}</span>
        </div>
      );
    case "createdWithinDays":
      return (
        <div className="flex items-center gap-2">
          <TextInput aria-label={label} type="number" min={1} step={1} inputMode="numeric" value={rule.value} onChange={(e) => onChange(e.target.value)} className="w-24" />
          <span className="text-[13px] text-muted-foreground">{t("days")}</span>
        </div>
      );
    case "brand":
      return (
        <>
          <TextInput aria-label={label} list="qb-collection-brands" value={rule.value} onChange={(e) => onChange(e.target.value)} />
          <datalist id="qb-collection-brands">
            {brands.map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
        </>
      );
    default:
      return (
        <TextInput
          aria-label={label}
          value={rule.value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={rule.field === "sku" ? t("textPlaceholder") : undefined}
          className={rule.field === "sku" ? "font-mono" : undefined}
        />
      );
  }
}

function ProductPicker({
  site,
  picks,
  setPicks,
  money,
}: {
  site: string;
  picks: ProductCard[];
  setPicks: (fn: (picks: ProductCard[]) => ProductCard[]) => void;
  money: (v: string) => string;
}) {
  const t = useTranslations("collections.editor");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProductCard[] | null>(null);
  const [loading, setLoading] = useState(false);
  const debounced = useDebounced(query.trim(), 250);
  const picked = new Set(picks.map((p) => p.id));

  useEffect(() => {
    if (!debounced) {
      setResults(null);
      setLoading(false);
      return;
    }
    let live = true;
    setLoading(true);
    searchCollectionProducts(site, debounced)
      .then((r) => live && setResults(r))
      .catch(() => live && setResults([]))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [debounced, site]);

  const move = (i: number, by: number) =>
    setPicks((all) => {
      const next = [...all];
      const [item] = next.splice(i, 1);
      next.splice(i + by, 0, item!);
      return next;
    });

  return (
    <div className="space-y-3">
      {/* Typing a search is not an edit of the collection: keep it from marking the form dirty. */}
      <div className="relative" data-form-ignore>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
          placeholder={t("search.placeholder")}
          aria-label={t("search.placeholder")}
          className={cn(control, "h-9 pl-9")}
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-label={t("search.searching")} />}
      </div>

      {results && (
        <div className="max-h-72 overflow-y-auto rounded-lg border">
          {results.length === 0 ? (
            <p className="px-3 py-4 text-center text-[13px] text-muted-foreground">{t("search.empty")}</p>
          ) : (
            <ul className="divide-y">
              {results.map((p) => {
                const added = picked.has(p.id);
                return (
                  <li key={p.id} className="flex items-center gap-3 px-3 py-2">
                    <ProductLine product={p} money={money} />
                    <Button
                      type="button"
                      size="xs"
                      variant={added ? "ghost" : "outline"}
                      disabled={added || picks.length >= MAX_PICKS}
                      onClick={() => setPicks((all) => (all.some((x) => x.id === p.id) ? all : [...all, p]))}
                    >
                      {added ? <Check /> : <Plus />} {added ? t("search.added") : t("search.add")}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {picks.length === 0 ? (
        <p className="rounded-lg border border-dashed px-3 py-6 text-center text-[13px] text-muted-foreground">{t("picks.empty")}</p>
      ) : (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">{t("picks.count", { count: picks.length })}</p>
          <ol className="divide-y rounded-lg border">
            {picks.map((p, i) => (
              <li key={p.id} className="flex items-center gap-2 px-3 py-2">
                <span className="w-5 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{i + 1}</span>
                <ProductLine product={p} money={money} />
                <div className="flex shrink-0 items-center">
                  <Button type="button" variant="ghost" size="icon-sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label={t("picks.moveUp")}>
                    <ArrowUp />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-sm" disabled={i === picks.length - 1} onClick={() => move(i, 1)} aria-label={t("picks.moveDown")}>
                    <ArrowDown />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground"
                    onClick={() => setPicks((all) => all.filter((x) => x.id !== p.id))}
                    aria-label={t("picks.remove")}
                  >
                    <X />
                  </Button>
                </div>
              </li>
            ))}
          </ol>
          {picks.length >= MAX_PICKS && <p className="text-xs text-warning">{t("picks.limit", { max: MAX_PICKS })}</p>}
        </div>
      )}
    </div>
  );
}

function ProductLine({ product, money }: { product: ProductCard; money: (v: string) => string }) {
  return (
    <>
      <div className="size-10 shrink-0 overflow-hidden rounded-md border bg-white">
        <ProductThumb src={product.image} alt={product.name} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium">{product.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {product.reference && <span className="mr-2 font-mono">{product.reference}</span>}
          <span className="tabular-nums">{money(product.price)}</span>
        </p>
      </div>
    </>
  );
}

function PreviewPanel({
  site,
  draft,
  initialKey,
  initialPreview,
  summary,
  money,
}: {
  site: string;
  draft: Draft;
  initialKey: string;
  initialPreview: Preview;
  summary: string | null;
  money: (v: string) => string;
}) {
  const t = useTranslations("collections");
  const key = draftKey(draft);
  const debounced = useDebounced(key, 400);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const [preview, setPreview] = useState(initialPreview);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (debounced === initialKey) {
      setPreview(initialPreview);
      setFailed(false);
      setLoading(false);
      return;
    }
    let live = true;
    setLoading(true);
    previewCollection(site, draftRef.current)
      .then((p) => {
        if (!live) return;
        setPreview(p);
        setFailed(false);
      })
      .catch(() => live && setFailed(true))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [debounced, initialKey, initialPreview, site]);

  const stale = loading || key !== debounced;
  const more = preview.count - preview.items.length;

  return (
    <Card
      title={t("editor.cards.preview")}
      action={stale ? <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label={t("preview.updating")} /> : undefined}
    >
      <div className={cn("space-y-3 transition-opacity", stale && "opacity-60")} aria-live="polite">
        <div>
          <p className="text-base font-semibold">{t("preview.count", { count: preview.count })}</p>
          {summary && <p className="mt-0.5 text-xs text-muted-foreground">{summary}</p>}
        </div>
        {failed && <p className="text-xs text-destructive">{t("preview.error")}</p>}
        {preview.items.length === 0 ? (
          <p className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
            {draft.kind === "manual" ? t("preview.emptyManual") : t("preview.empty")}
          </p>
        ) : (
          <ul className="grid grid-cols-3 gap-2">
            {preview.items.map((p) => (
              <li key={p.id} className="min-w-0" title={p.name}>
                <div className="aspect-square overflow-hidden rounded-md border bg-white">
                  <ProductThumb src={p.image} alt={p.name} />
                </div>
                <p className="mt-1 line-clamp-2 text-[11px] leading-tight">{p.name}</p>
                <p className="text-[11px] tabular-nums text-muted-foreground">{money(p.price)}</p>
              </li>
            ))}
          </ul>
        )}
        {more > 0 && <p className="text-xs text-muted-foreground">{t("preview.more", { count: more })}</p>}
      </div>
    </Card>
  );
}

function ImageCard({ site, image, setImage }: { site: { slug: string; id: string }; image: string; setImage: (v: string) => void }) {
  const t = useTranslations("collections.editor");
  const [open, setOpen] = useState(false);
  return (
    <Card title={t("cards.image")} description={t("image.hint")}>
      {image ? (
        <div className="relative overflow-hidden rounded-lg border bg-muted/40">
          <div className="aspect-video">
            <ProductThumb src={image} className="object-cover" />
          </div>
          <div className="absolute right-1.5 top-1.5 flex gap-1">
            <Button type="button" size="xs" variant="secondary" onClick={() => setOpen(true)}>
              {t("image.replace")}
            </Button>
            <Button type="button" size="icon-xs" variant="secondary" onClick={() => setImage("")} aria-label={t("image.remove")}>
              <X />
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex aspect-video w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed text-xs text-muted-foreground transition hover:bg-accent/40"
        >
          <ImagePlus className="size-5" />
          {t("image.choose")}
        </button>
      )}
      <Field label={t("image.url")} htmlFor="image">
        <TextInput id="image" name="image" value={image} onChange={(e) => setImage(e.target.value.trim())} placeholder="https://" inputMode="url" />
      </Field>
      <QuickPick
        open={open}
        onOpenChange={setOpen}
        site={site.slug}
        siteId={site.id}
        kind="image"
        title={t("image.pickerTitle")}
        onPick={(items) => items[0] && setImage(items[0].url)}
      />
    </Card>
  );
}
