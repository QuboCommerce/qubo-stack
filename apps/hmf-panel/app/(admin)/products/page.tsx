import { toggleProductArchive } from "@/app/actions";
import { getProducts } from "@/lib/queries";

const money = new Intl.NumberFormat("fr-BE", {
  style: "currency",
  currency: "EUR",
});

export default async function ProductsPage() {
  const products = await getProducts();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Produits</h1>
        <p className="text-muted-foreground">{products.length} produits affichés</p>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left">
            <tr>
              <th className="p-4">Produit</th>
              <th className="p-4">Prix</th>
              <th className="p-4">Variantes</th>
              <th className="p-4">État</th>
              <th className="p-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {products.map((item) => (
              <tr key={item.id}>
                <td className="p-4">
                  <p className="font-medium">{item.name}</p>
                  <p className="text-muted-foreground">{item.brand ?? "Sans marque"}</p>
                </td>
                <td className="p-4">{money.format(Number(item.basePrice))}</td>
                <td className="p-4">{item.variantCount}</td>
                <td className="p-4">{item.isArchived ? "Archivé" : "Actif"}</td>
                <td className="p-4 text-right">
                  <form action={toggleProductArchive}>
                    <input name="id" type="hidden" value={item.id} />
                    <input name="archive" type="hidden" value={String(!item.isArchived)} />
                    <button className="rounded-md border px-3 py-2 hover:bg-accent" type="submit">
                      {item.isArchived ? "Réactiver" : "Archiver"}
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
