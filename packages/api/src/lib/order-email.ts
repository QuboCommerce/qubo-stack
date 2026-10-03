const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[c]!);

/** Order confirmation via Resend; a no-op when RESEND_API_KEY / ORDER_EMAIL_FROM are unset. */
export async function sendOrderConfirmation(input: {
  siteName: string;
  locale: string;
  email: string | null;
  customerName: string | null;
  orderNumber: string;
  total: string;
  currency: string;
}) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.ORDER_EMAIL_FROM?.trim();
  if (!apiKey || !from || !input.email) return { sent: false as const };

  const total = new Intl.NumberFormat(input.locale, { style: "currency", currency: input.currency }).format(Number(input.total));
  const fr = input.locale.startsWith("fr");
  const name = escapeHtml(input.customerName || (fr ? "client" : "customer"));
  const order = escapeHtml(input.orderNumber);
  const site = escapeHtml(input.siteName);
  const html = fr
    ? `<p>Bonjour ${name},</p><p>Votre commande <strong>${order}</strong> a bien été payée.</p><p>Total&nbsp;: <strong>${escapeHtml(total)}</strong></p><p>${site} vous contactera pour confirmer la livraison.</p>`
    : `<p>Hello ${name},</p><p>Your order <strong>${order}</strong> has been paid.</p><p>Total: <strong>${escapeHtml(total)}</strong></p><p>${site} will contact you to confirm delivery.</p>`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      from,
      to: [input.email],
      subject: fr ? `Confirmation de commande ${input.orderNumber}` : `Order confirmation ${input.orderNumber}`,
      html,
    }),
  });
  if (!response.ok) throw new Error(`Resend rejected order confirmation (${response.status})`);
  return { sent: true as const };
}
