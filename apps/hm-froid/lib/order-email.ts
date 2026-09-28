import "server-only";

export async function sendOrderConfirmation(input: {
  email: string | null | undefined;
  customerName: string | null | undefined;
  orderNumber: string;
  total: string;
  currency: string;
}) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.ORDER_EMAIL_FROM?.trim();
  if (!apiKey || !from || !input.email) return { sent: false as const };

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.email],
      subject: `Confirmation de commande ${input.orderNumber}`,
      html: `<p>Bonjour ${escapeHtml(input.customerName || "client")},</p>
<p>Votre commande <strong>${escapeHtml(input.orderNumber)}</strong> a bien été payée.</p>
<p>Total&nbsp;: <strong>${escapeHtml(input.total)} ${escapeHtml(input.currency)}</strong></p>
<p>HM Froid vous contactera pour confirmer la livraison.</p>`,
    }),
  });

  if (!response.ok) {
    throw new Error(`Resend rejected order confirmation (${response.status})`);
  }
  return { sent: true as const };
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character]!,
  );
}
