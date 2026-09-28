import { updateOrderStatus } from "@/app/actions";
import { getOrders } from "@/lib/queries";

const statuses = [
  "PENDING", "CONFIRMED", "PROCESSING", "SHIPPED",
  "DELIVERED", "COMPLETED", "CANCELLED", "REFUNDED",
] as const;

export default async function OrdersPage() {
  const orders = await getOrders();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Commandes</h1>
        <p className="text-muted-foreground">{orders.length} commandes affichées</p>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left">
            <tr>
              <th className="p-4">Commande</th>
              <th className="p-4">Client</th>
              <th className="p-4">Total</th>
              <th className="p-4">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {orders.map((item) => (
              <tr key={item.id}>
                <td className="p-4">
                  <p className="font-medium">{item.orderNumber}</p>
                  <p className="text-muted-foreground">
                    {new Intl.DateTimeFormat("fr-BE").format(item.createdAt)}
                  </p>
                </td>
                <td className="p-4">
                  <p>{item.customerName ?? "Client invité"}</p>
                  <p className="text-muted-foreground">{item.customerEmail ?? "—"}</p>
                </td>
                <td className="p-4">
                  {new Intl.NumberFormat("fr-BE", {
                    style: "currency",
                    currency: item.currency,
                  }).format(Number(item.total))}
                </td>
                <td className="p-4">
                  <form action={updateOrderStatus} className="flex gap-2">
                    <input name="id" type="hidden" value={item.id} />
                    <select
                      className="rounded-md border bg-background px-2 py-2"
                      defaultValue={item.status}
                      name="status"
                    >
                      {statuses.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                    <button className="rounded-md border px-3 py-2 hover:bg-accent" type="submit">
                      Enregistrer
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
