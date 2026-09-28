import { AdminShell } from "@/components/admin-shell";
import { getDashboardData } from "@/lib/queries";

const money = new Intl.NumberFormat("fr-BE", {
  style: "currency",
  currency: "EUR",
});

export default async function PanelHomePage() {
  const data = await getDashboardData();
  const cards = [
    ["Produits", data.productCount],
    ["Clients", data.customerCount],
    ["Commandes", data.orderCount],
    ["Chiffre d’affaires", money.format(Number(data.revenue))],
  ];

  return (
    <AdminShell>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-semibold">Tableau de bord</h1>
          <p className="text-muted-foreground">Vue d’ensemble de la boutique.</p>
        </div>
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map(([label, value]) => (
            <div className="rounded-xl border bg-card p-5" key={label}>
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="mt-2 text-2xl font-semibold">{value}</p>
            </div>
          ))}
        </section>
        <section className="rounded-xl border bg-card">
          <div className="border-b p-5">
            <h2 className="font-semibold">Commandes récentes</h2>
          </div>
          <div className="divide-y">
            {data.recentOrders.map((item) => (
              <div className="flex items-center justify-between p-4" key={item.id}>
                <div>
                  <p className="font-medium">{item.orderNumber}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.customerName ?? item.customerEmail ?? "Client invité"}
                  </p>
                </div>
                <div className="text-right">
                  <p>{money.format(Number(item.total))}</p>
                  <p className="text-xs text-muted-foreground">{item.status}</p>
                </div>
              </div>
            ))}
            {!data.recentOrders.length && (
              <p className="p-5 text-sm text-muted-foreground">Aucune commande.</p>
            )}
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
