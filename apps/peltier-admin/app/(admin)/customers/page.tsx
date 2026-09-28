import { getCustomers } from "@/lib/queries";

export default async function CustomersPage() {
  const customers = await getCustomers();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Clients</h1>
        <p className="text-muted-foreground">{customers.length} clients affichés</p>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left">
            <tr>
              <th className="p-4">Client</th>
              <th className="p-4">Contact</th>
              <th className="p-4">Société</th>
              <th className="p-4">Marketing</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {customers.map((item) => (
              <tr key={item.id}>
                <td className="p-4 font-medium">
                  {[item.firstName, item.lastName].filter(Boolean).join(" ") || "Sans nom"}
                </td>
                <td className="p-4">
                  <p>{item.email}</p>
                  <p className="text-muted-foreground">{item.phone ?? "—"}</p>
                </td>
                <td className="p-4">{item.company ?? "—"}</td>
                <td className="p-4">{item.acceptsMarketing ? "Oui" : "Non"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
