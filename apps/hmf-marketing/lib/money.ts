export function formatMoney(amount: string | number, currency = "EUR") {
  return new Intl.NumberFormat("fr-BE", {
    style: "currency",
    currency,
  }).format(Number(amount));
}
