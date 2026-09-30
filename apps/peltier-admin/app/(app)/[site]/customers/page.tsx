import { Search, UserPlus, Users } from "lucide-react";
import { Pagination, td, th } from "@/components/index-table";
import { EmptyState, Page, Panel } from "@/components/page";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireSite } from "@/lib/admin";
import { number, shortDate } from "@/lib/format";
import { getCustomers } from "@/lib/queries";
import { cn } from "@peltier/shared/utils";

export default async function CustomersPage({ params, searchParams }: { params: Promise<{ site: string }>; searchParams: Promise<{ q?: string; page?: string }> }) {
  const [{ site: slug }, sp] = await Promise.all([params, searchParams]);
  const { site, siteId } = await requireSite(slug);
  const result = await getCustomers(siteId, { q: sp.q, page: Number(sp.page) || 1 });
  const base = `/${site.slug}/customers`;
  const href = (p: number) => `${base}?page=${p}${sp.q ? `&q=${encodeURIComponent(sp.q)}` : ""}`;

  return (
    <Page
      title="Customers"
      subtitle={`${number(result.total)} customers`}
      width="wide"
      actions={<Button size="sm" className="w-full xs:w-auto"><UserPlus /> Add customer</Button>}
    >
      <Panel flush className="@container">
        <form action={base} className="relative border-b p-2">
          <Search className="pointer-events-none absolute left-4.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            name="q"
            defaultValue={sp.q}
            placeholder="Search by name, email or company"
            className="h-8 w-full rounded-lg border bg-background pl-8 pr-3 text-[13px] outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40"
          />
        </form>
        {result.rows.length === 0 ? (
          <EmptyState icon={Users} title="No customers found" description="Customers who create an account or place an order appear here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="border-b bg-muted/40">
                <tr>
                  <th className={th}>Customer</th>
                  <th className={cn(th, "hidden @min-[48rem]:table-cell")}>Company</th>
                  <th className={cn(th, "hidden @min-[64rem]:table-cell")}>Phone</th>
                  <th className={cn(th, "hidden @min-[36rem]:table-cell")}>Email subscription</th>
                  <th className={cn(th, "hidden @min-[80rem]:table-cell")}>Customer since</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {result.rows.map((c) => {
                  const name = [c.firstName, c.lastName].filter(Boolean).join(" ") || c.company || c.email;
                  return (
                    <tr key={c.id} className="hover:bg-accent/40">
                      <td className={td}>
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar className="size-8">
                            <AvatarFallback className="bg-gradient-to-br from-brand-cold/20 to-brand-hot/20 text-[11px] font-semibold">
                              {name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{name}</p>
                            <p className="truncate text-xs text-muted-foreground">{c.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className={cn(td, "hidden text-muted-foreground @min-[48rem]:table-cell")}>{c.company || "—"}</td>
                      <td className={cn(td, "hidden whitespace-nowrap text-muted-foreground @min-[64rem]:table-cell")}>{c.phone || "—"}</td>
                      <td className={cn(td, "hidden @min-[36rem]:table-cell")}>
                        {c.acceptsMarketing ? <Badge className="border-transparent bg-success/15 text-success hover:bg-success/15">Subscribed</Badge> : <Badge variant="secondary">Not subscribed</Badge>}
                      </td>
                      <td className={cn(td, "hidden whitespace-nowrap text-muted-foreground @min-[80rem]:table-cell")}>{shortDate(c.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pagination href={href} page={result.page} perPage={result.perPage} total={result.total} />
      </Panel>
    </Page>
  );
}
