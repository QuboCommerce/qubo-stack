import { ShoppingBag } from "lucide-react";
import { updateOrderStatus } from "@/app/actions";
import { td, th } from "@/components/index-table";
import { EmptyState, Page, Panel } from "@/components/page";
import { Button } from "@/components/ui/button";
import { requireSite } from "@/lib/admin";
import { money, shortDate } from "@/lib/format";
import { getOrders } from "@/lib/queries";
import { cn } from "@qubo/shared/utils";

const statuses = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "COMPLETED", "CANCELLED", "REFUNDED"] as const;

export default async function OrdersPage({ params }: { params: Promise<{ site: string }> }) {
  const { site: slug } = await params;
  const { site, siteId } = await requireSite(slug);
  const orders = await getOrders(siteId);

  return (
    <Page title="Orders" width="wide" actions={<Button variant="outline" size="sm">Export</Button>}>
      <Panel flush className="@container">
        {orders.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title="Your orders will show here"
            description="Orders placed on the storefront, and draft orders you create for customers, are managed from this page."
            action={<Button size="sm">Create draft order</Button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="border-b bg-muted/40">
                <tr>
                  <th className={th}>Order</th>
                  <th className={cn(th, "hidden @min-[40rem]:table-cell")}>Date</th>
                  <th className={th}>Customer</th>
                  <th className={cn(th, "text-right")}>Total</th>
                  <th className={th}>Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-accent/40">
                    <td className={cn(td, "font-medium")}>#{o.orderNumber}</td>
                    <td className={cn(td, "hidden text-muted-foreground @min-[40rem]:table-cell")}>{shortDate(o.createdAt)}</td>
                    <td className={td}>
                      <p>{o.customerName ?? "Guest"}</p>
                      <p className="text-xs text-muted-foreground">{o.customerEmail ?? "—"}</p>
                    </td>
                    <td className={cn(td, "text-right tabular-nums")}>{money(o.total, o.currency)}</td>
                    <td className={td}>
                      <form action={updateOrderStatus} className="flex gap-2">
                        <input type="hidden" name="site" value={site.slug} />
                        <input type="hidden" name="id" value={o.id} />
                        <select name="status" defaultValue={o.status} className="h-8 rounded-lg border bg-background px-2 text-[13px]">
                          {statuses.map((s) => (
                            <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>
                          ))}
                        </select>
                        <Button type="submit" variant="outline" size="sm">Save</Button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </Page>
  );
}
