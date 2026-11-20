import Link from "next/link";
import { notFound } from "next/navigation";
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
import { money, number, shortDate } from "@/lib/format";
import { DEFAULT_ZONE, toLocalInput } from "@/lib/zoned";

const uuid = /^[0-9a-f-]{36}$/i;
type Row = typeof discount.$inferSelect;

function state(d: Row, now = new Date()): { label: string; tone: "success" | "warning" | "info" | "muted" | "destructive" } {
  if (!d.isActive) return { label: "Paused", tone: "muted" };
  if (d.endsAt && d.endsAt <= now) return { label: "Expired", tone: "muted" };
  if (d.maxUsesTotal !== null && d.usedCount >= d.maxUsesTotal) return { label: "Used up", tone: "warning" };
  if (d.startsAt && d.startsAt > now) return { label: "Scheduled", tone: "info" };
  return { label: "Active", tone: "success" };
}

function describe(d: Row, currency: string) {
  if (d.type === "FREE_SHIPPING") return "Free delivery";
  if (d.type === "PERCENTAGE") return `${Number(d.value)}% off`;
  return `${money(d.value, currency)} off`;
}

export default async function DiscountCodesPage({ params, searchParams }: { params: Promise<{ site: string }>; searchParams: Promise<{ id?: string; new?: string }> }) {
  const [{ site: slug }, sp] = await Promise.all([params, searchParams]);
  const { site, siteId } = await requireSite(slug);
  if (!(site.capabilities ?? []).includes("commerce")) notFound();
  const currency = site.currency ?? "EUR";
  const base = `/${site.slug}/promotions/codes`;

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
      title="Promotions"
      subtitle={codes.length ? `${number(codes.length)} discount codes` : undefined}
      width="wide"
      actions={
        <Button size="sm" asChild>
          <Link href={`${base}?new=1`}>
            <Plus /> New code
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
                title="No discount codes yet"
                description="Shoppers type a code in the cart. A code can take a percentage or an amount off, or make delivery free, with dates, a minimum order and usage limits."
                action={
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`${base}?new=1`}>Create a code</Link>
                  </Button>
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/30">
                    <tr>
                      <th className={th}>Code</th>
                      <th className={th}>Discount</th>
                      <th className={th}>Used</th>
                      <th className={th}>Dates</th>
                      <th className={th}>Status</th>
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
                            {describe(c, currency)}
                            {c.minPurchaseAmount && <span className="block text-xs text-muted-foreground">from {money(c.minPurchaseAmount, currency)}</span>}
                          </td>
                          <td className={`${td} tabular-nums`}>
                            {number(c.usedCount)}
                            {c.maxUsesTotal !== null && <span className="text-muted-foreground"> / {number(c.maxUsesTotal)}</span>}
                          </td>
                          <td className={`${td} whitespace-nowrap text-muted-foreground`}>
                            {c.startsAt || c.endsAt ? `${c.startsAt ? shortDate(c.startsAt) : "now"} to ${c.endsAt ? shortDate(c.endsAt) : "no end"}` : "Always"}
                          </td>
                          <td className={td}>
                            <span className="inline-flex items-center gap-1.5">
                              <StatusDot tone={s.tone} />
                              {s.label}
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
              title={editing ? editing.code : "New discount code"}
              description={editing ? `Used ${number(editing.usedCount)} times` : "Codes are not case sensitive. Shoppers see the saving in the cart and on the Stripe payment page."}
              className="@min-[64rem]:sticky @min-[64rem]:top-4"
            >
              <SettingsForm action={saveDiscount} noun="code" watch={editing ? { table: "discount", id: editing.id } : undefined}>
                <input type="hidden" name="site" value={site.slug} />
                {editing && <input type="hidden" name="id" value={editing.id} />}
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Code" htmlFor="code">
                      <TextInput id="code" name="code" required defaultValue={editing?.code} placeholder="WINTER15" className="font-mono uppercase" autoComplete="off" />
                    </Field>
                    <Field label="Internal name" htmlFor="name" hint="Only you see this.">
                      <TextInput id="name" name="name" defaultValue={editing?.name ?? ""} placeholder="Winter campaign" />
                    </Field>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Type" htmlFor="type">
                      <Select id="type" name="type" defaultValue={editing?.type ?? "PERCENTAGE"}>
                        <option value="PERCENTAGE">Percentage off</option>
                        <option value="FIXED_AMOUNT">Amount off ({currency})</option>
                        <option value="FREE_SHIPPING">Free delivery</option>
                      </Select>
                    </Field>
                    <Field label="Value" htmlFor="value" hint="Percent or amount. Ignored for free delivery.">
                      <TextInput id="value" name="value" inputMode="decimal" defaultValue={editing && editing.type !== "FREE_SHIPPING" ? Number(editing.value).toString() : ""} placeholder="15" />
                    </Field>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Starts" htmlFor="startsAt" hint={zone}>
                      <TextInput id="startsAt" name="startsAt" type="datetime-local" defaultValue={toLocalInput(editing?.startsAt, zone)} />
                    </Field>
                    <Field label="Ends" htmlFor="endsAt">
                      <TextInput id="endsAt" name="endsAt" type="datetime-local" defaultValue={toLocalInput(editing?.endsAt, zone)} />
                    </Field>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label={`Minimum order (${currency})`} htmlFor="minPurchase">
                      <TextInput id="minPurchase" name="minPurchase" inputMode="decimal" defaultValue={editing?.minPurchaseAmount ?? ""} placeholder="None" />
                    </Field>
                    <Field label="Minimum quantity" htmlFor="minQuantity" hint="Counts eligible items only.">
                      <TextInput id="minQuantity" name="minQuantity" inputMode="numeric" defaultValue={minQuantity} placeholder="None" />
                    </Field>
                    <Field label="Total uses" htmlFor="maxUsesTotal">
                      <TextInput id="maxUsesTotal" name="maxUsesTotal" inputMode="numeric" defaultValue={editing?.maxUsesTotal ?? ""} placeholder="Unlimited" />
                    </Field>
                    <Field label="Uses per customer" htmlFor="maxUsesPerCustomer" hint="Needs a signed-in shopper.">
                      <TextInput id="maxUsesPerCustomer" name="maxUsesPerCustomer" inputMode="numeric" defaultValue={editing?.maxUsesPerCustomer ?? ""} placeholder="Unlimited" />
                    </Field>
                  </div>
                  <Field label="Only these products" htmlFor="products" hint="References or handles, one per line. Leave empty for the whole cart.">
                    <TextArea id="products" name="products" defaultValue={productRefs.map((p) => p.ref).join("\n")} placeholder={"A77006\nWTAG716"} className="font-mono text-xs" />
                  </Field>
                  {tree.length > 0 && (
                    <fieldset className="space-y-1.5">
                      <legend className="text-[13px] font-medium">Only these categories</legend>
                      <div className="max-h-48 overflow-y-auto rounded-lg border bg-card p-2 text-sm">
                        {tree.map((c) => (
                          <label key={c.id} className="flex items-center gap-2 rounded px-1 py-0.5 hover:bg-accent/40" style={{ paddingLeft: `${c.depth * 1 + 0.25}rem` }}>
                            <input type="checkbox" name="categoryIds" value={c.id} defaultChecked={categoryIds.has(c.id)} />
                            <span className="truncate">{c.name}</span>
                          </label>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">A category includes its subcategories.</p>
                    </fieldset>
                  )}
                  <div className="-mx-4 border-y sm:-mx-5">
                    <SwitchRow name="isActive" defaultChecked={editing?.isActive ?? true} label="Active" description="Paused codes are refused in the cart." />
                  </div>
                </div>
              </SettingsForm>
              {editing && (
                <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
                  <form action={toggleDiscount}>
                    <input type="hidden" name="site" value={site.slug} />
                    <input type="hidden" name="id" value={editing.id} />
                    <Button type="submit" size="sm" variant="outline">
                      {editing.isActive ? "Pause" : "Resume"}
                    </Button>
                  </form>
                  {editing.usedCount === 0 ? (
                    <form action={deleteDiscount}>
                      <input type="hidden" name="site" value={site.slug} />
                      <input type="hidden" name="id" value={editing.id} />
                      <Button type="submit" size="sm" variant="ghost" className="text-destructive">
                        Delete
                      </Button>
                    </form>
                  ) : (
                    <p className="self-center text-xs text-muted-foreground">Used codes can be paused, not deleted.</p>
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
