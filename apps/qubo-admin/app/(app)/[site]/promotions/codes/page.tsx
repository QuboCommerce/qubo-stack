import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Plus, TicketPercent } from "lucide-react";
import { db } from "@qubo/db/client";
import { discount, discountCondition, product, siteSettings } from "@qubo/db/schema";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { deleteDiscount, saveDiscount, toggleDiscount } from "@/app/promotion-actions";
import { td, th } from "@/components/index-table";
import { EmptyState, Page, Panel, StatusDot } from "@/components/page";
import { PromotionsTabs } from "@/components/promotions/promotions-tabs";
import { Field, Select, SwitchRow, TextArea, TextInput } from "@/components/settings/controls";
import { SettingsForm } from "@/components/settings/settings-form";
import { Button } from "@/components/ui/button";
import { requireSite } from "@/lib/admin";
import { getCategoryTree } from "@/lib/categories";
import { DEFAULT_ZONE, toLocalInput } from "@/lib/zoned";

const uuid = /^[0-9a-f-]{36}$/i;
type Row = typeof discount.$inferSelect;
type Status = "paused" | "expired" | "usedUp" | "scheduled" | "active";

function state(d: Row, now = new Date()): { key: Status; tone: "success" | "warning" | "info" | "muted" | "destructive" } {
  if (!d.isActive) return { key: "paused", tone: "muted" };
  if (d.endsAt && d.endsAt <= now) return { key: "expired", tone: "muted" };
  if (d.maxUsesTotal !== null && d.usedCount >= d.maxUsesTotal) return { key: "usedUp", tone: "warning" };
  if (d.startsAt && d.startsAt > now) return { key: "scheduled", tone: "info" };
  return { key: "active", tone: "success" };
}

export default async function DiscountCodesPage({ params, searchParams }: { params: Promise<{ site: string }>; searchParams: Promise<{ id?: string; new?: string }> }) {
  const [{ site: slug }, sp] = await Promise.all([params, searchParams]);
  const { site, siteId } = await requireSite(slug);
  const t = await getTranslations("promotions");
  const format = await getFormatter();
  if (!(site.capabilities ?? []).includes("commerce")) notFound();
  const currency = site.currency ?? "EUR";
  const base = `/${site.slug}/promotions/codes`;
  const money = (v: number | string) => format.number(Number(v), { style: "currency", currency });
  const shortDate = (d: Date) => format.dateTime(d, { day: "numeric", month: "short", year: "numeric" });
  const describe = (d: Row) => {
    if (d.type === "FREE_SHIPPING") return t("codes.describe.freeDelivery");
    if (d.type === "PERCENTAGE") return t("codes.describe.percentOff", { value: format.number(Number(d.value)) });
    return t("codes.describe.amountOff", { amount: money(d.value) });
  };

  const [codes, tree, [settings]] = await Promise.all([
    db.select().from(discount).where(eq(discount.siteId, siteId)).orderBy(desc(discount.createdAt)),
    getCategoryTree(siteId),
    db.select({ timezone: siteSettings.timezone }).from(siteSettings).where(eq(siteSettings.siteId, siteId)).limit(1),
  ]);
  const zone = settings?.timezone ?? DEFAULT_ZONE;
  const selected = sp.id && uuid.test(sp.id) ? codes.find((c) => c.id === sp.id) : undefined;
  const creating = !selected && sp.new === "1";

  const conditions = selected ? await db.select().from(discountCondition).where(eq(discountCondition.discountId, selected.id)) : [];
  const targets = (type: (typeof conditions)[number]["type"]) => conditions.filter((c) => c.type === type).flatMap((c) => c.targetIds);
  const productIds = targets("SPECIFIC_PRODUCTS");
  const productRefs = productIds.length
    ? await db
        .select({ ref: sql<string>`coalesce(${product.sourceSnapshot}->>'Référence', ${product.legacyId}, ${product.slug})` })
        .from(product)
        .where(and(eq(product.siteId, siteId), inArray(product.id, productIds)))
    : [];
  const categoryIds = new Set(targets("SPECIFIC_CATEGORIES"));
  const minQuantity = targets("MIN_QUANTITY")[0] ?? "";

  const editing = selected ?? null;
  const showEditor = Boolean(editing) || creating;

  return (
    <Page
      title={t("title")}
      subtitle={codes.length ? t("codes.subtitle", { count: codes.length }) : undefined}
      width="wide"
      actions={
        <Button size="sm" asChild>
          <Link href={`${base}?new=1`}>
            <Plus /> {t("codes.new")}
          </Link>
        </Button>
      }
    >
      <PromotionsTabs site={site.slug} active="codes" />

      <div className="@container">
        <div className={showEditor ? "grid items-start gap-4 @min-[64rem]:grid-cols-[minmax(0,1fr)_28rem]" : ""}>
          <Panel flush>
            {codes.length === 0 ? (
              <EmptyState
                icon={TicketPercent}
                title={t("codes.empty.title")}
                description={t("codes.empty.description")}
                action={
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`${base}?new=1`}>{t("codes.empty.action")}</Link>
                  </Button>
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/30">
                    <tr>
                      <th className={th}>{t("codes.table.code")}</th>
                      <th className={th}>{t("codes.table.discount")}</th>
                      <th className={th}>{t("codes.table.used")}</th>
                      <th className={th}>{t("codes.table.dates")}</th>
                      <th className={th}>{t("codes.table.status")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {codes.map((c) => {
                      const s = state(c);
                      return (
                        <tr key={c.id} className={c.id === editing?.id ? "bg-accent/50" : "hover:bg-accent/30"}>
                          <td className={td}>
                            <Link href={`${base}?id=${c.id}`} className="font-mono font-medium hover:underline">
                              {c.code}
                            </Link>
                            {c.name && <span className="block text-xs text-muted-foreground">{c.name}</span>}
                          </td>
                          <td className={td}>
                            {describe(c)}
                            {c.minPurchaseAmount && <span className="block text-xs text-muted-foreground">{t("codes.describe.from", { amount: money(c.minPurchaseAmount) })}</span>}
                          </td>
                          <td className={`${td} tabular-nums`}>
                            {format.number(c.usedCount)}
                            {c.maxUsesTotal !== null && <span className="text-muted-foreground"> / {format.number(c.maxUsesTotal)}</span>}
                          </td>
                          <td className={`${td} whitespace-nowrap text-muted-foreground`}>
                            {c.startsAt || c.endsAt
                              ? t("codes.dates.range", {
                                  start: c.startsAt ? shortDate(c.startsAt) : t("codes.dates.now"),
                                  end: c.endsAt ? shortDate(c.endsAt) : t("codes.dates.noEnd"),
                                })
                              : t("codes.dates.always")}
                          </td>
                          <td className={td}>
                            <span className="inline-flex items-center gap-1.5">
                              <StatusDot tone={s.tone} />
                              {t(`codes.status.${s.key}`)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          {showEditor && (
            <Panel
              key={editing?.id ?? "new"}
              title={editing ? editing.code : t("codes.editor.newTitle")}
              description={editing ? t("codes.editor.usedTimes", { count: editing.usedCount }) : t("codes.editor.newDescription")}
              className="@min-[64rem]:sticky @min-[64rem]:top-4"
            >
              <SettingsForm action={saveDiscount} noun="code" watch={editing ? { table: "discount", id: editing.id } : undefined}>
                <input type="hidden" name="site" value={site.slug} />
                {editing && <input type="hidden" name="id" value={editing.id} />}
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label={t("codes.fields.code")} htmlFor="code">
                      <TextInput id="code" name="code" required defaultValue={editing?.code} placeholder="WINTER15" className="font-mono uppercase" autoComplete="off" />
                    </Field>
                    <Field label={t("codes.fields.name")} htmlFor="name" hint={t("codes.fields.nameHint")}>
                      <TextInput id="name" name="name" defaultValue={editing?.name ?? ""} placeholder={t("codes.fields.namePlaceholder")} />
                    </Field>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label={t("codes.fields.type")} htmlFor="type">
                      <Select id="type" name="type" defaultValue={editing?.type ?? "PERCENTAGE"}>
                        <option value="PERCENTAGE">{t("codes.fields.typePercentage")}</option>
                        <option value="FIXED_AMOUNT">{t("codes.fields.typeFixed", { currency })}</option>
                        <option value="FREE_SHIPPING">{t("codes.fields.typeFreeShipping")}</option>
                      </Select>
                    </Field>
                    <Field label={t("codes.fields.value")} htmlFor="value" hint={t("codes.fields.valueHint")}>
                      <TextInput id="value" name="value" inputMode="decimal" defaultValue={editing && editing.type !== "FREE_SHIPPING" ? Number(editing.value).toString() : ""} placeholder="15" />
                    </Field>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label={t("codes.fields.startsAt")} htmlFor="startsAt" hint={zone}>
                      <TextInput id="startsAt" name="startsAt" type="datetime-local" defaultValue={toLocalInput(editing?.startsAt, zone)} />
                    </Field>
                    <Field label={t("codes.fields.endsAt")} htmlFor="endsAt">
                      <TextInput id="endsAt" name="endsAt" type="datetime-local" defaultValue={toLocalInput(editing?.endsAt, zone)} />
                    </Field>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label={t("codes.fields.minPurchase", { currency })} htmlFor="minPurchase">
                      <TextInput id="minPurchase" name="minPurchase" inputMode="decimal" defaultValue={editing?.minPurchaseAmount ?? ""} placeholder={t("codes.fields.none")} />
                    </Field>
                    <Field label={t("codes.fields.minQuantity")} htmlFor="minQuantity" hint={t("codes.fields.minQuantityHint")}>
                      <TextInput id="minQuantity" name="minQuantity" inputMode="numeric" defaultValue={minQuantity} placeholder={t("codes.fields.none")} />
                    </Field>
                    <Field label={t("codes.fields.maxUsesTotal")} htmlFor="maxUsesTotal">
                      <TextInput id="maxUsesTotal" name="maxUsesTotal" inputMode="numeric" defaultValue={editing?.maxUsesTotal ?? ""} placeholder={t("codes.fields.unlimited")} />
                    </Field>
                    <Field label={t("codes.fields.maxUsesPerCustomer")} htmlFor="maxUsesPerCustomer" hint={t("codes.fields.maxUsesPerCustomerHint")}>
                      <TextInput id="maxUsesPerCustomer" name="maxUsesPerCustomer" inputMode="numeric" defaultValue={editing?.maxUsesPerCustomer ?? ""} placeholder={t("codes.fields.unlimited")} />
                    </Field>
                  </div>
                  <Field label={t("codes.fields.products")} htmlFor="products" hint={t("codes.fields.productsHint")}>
                    <TextArea id="products" name="products" defaultValue={productRefs.map((p) => p.ref).join("\n")} placeholder={"A77006\nWTAG716"} className="font-mono text-xs" />
                  </Field>
                  {tree.length > 0 && (
                    <fieldset className="space-y-1.5">
                      <legend className="text-[13px] font-medium">{t("codes.fields.categories")}</legend>
                      <div className="max-h-48 overflow-y-auto rounded-lg border bg-card p-2 text-sm">
                        {tree.map((c) => (
                          <label key={c.id} className="flex items-center gap-2 rounded px-1 py-0.5 hover:bg-accent/40" style={{ paddingLeft: `${c.depth * 1 + 0.25}rem` }}>
                            <input type="checkbox" name="categoryIds" value={c.id} defaultChecked={categoryIds.has(c.id)} />
                            <span className="truncate">{c.name}</span>
                          </label>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">{t("codes.fields.categoriesHint")}</p>
                    </fieldset>
                  )}
                  <div className="-mx-4 border-y sm:-mx-5">
                    <SwitchRow name="isActive" defaultChecked={editing?.isActive ?? true} label={t("codes.fields.active")} description={t("codes.fields.activeDescription")} />
                  </div>
                </div>
              </SettingsForm>
              {editing && (
                <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
                  <form action={toggleDiscount}>
                    <input type="hidden" name="site" value={site.slug} />
                    <input type="hidden" name="id" value={editing.id} />
                    <Button type="submit" size="sm" variant="outline">
                      {editing.isActive ? t("codes.pause") : t("codes.resume")}
                    </Button>
                  </form>
                  {editing.usedCount === 0 ? (
                    <form action={deleteDiscount}>
                      <input type="hidden" name="site" value={site.slug} />
                      <input type="hidden" name="id" value={editing.id} />
                      <Button type="submit" size="sm" variant="ghost" className="text-destructive">
                        {t("codes.delete")}
                      </Button>
                    </form>
                  ) : (
                    <p className="self-center text-xs text-muted-foreground">{t("codes.usedCannotDelete")}</p>
                  )}
                </div>
              )}
            </Panel>
          )}
        </div>
      </div>
    </Page>
  );
}
