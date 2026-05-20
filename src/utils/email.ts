import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@ddaily.co.ke";

let client: Resend | null = null;
if (apiKey) client = new Resend(apiKey);

function formatCurrency(n: number) {
  return `KES ${n.toLocaleString()}`;
}

export async function sendOrderConfirmation(to: string, order: any, paymentUrl?: string) {
  if (!client) {
    console.warn("Resend client not configured; skipping order confirmation email");
    return;
  }

  const itemsHtml = (order.items || [])
    .map((it: any) => `<li>${it.name} &times; ${it.qty} — ${formatCurrency(it.price)}</li>`)
    .join("\n");

  const html = `
    <p>Hi ${order.customer?.name || "Customer"},</p>
    <p>Thanks for your order <strong>${order.orderNumber}</strong>. Summary:</p>
    <ul>
      ${itemsHtml}
    </ul>
    <p><strong>Total:</strong> ${formatCurrency(order.total)}</p>
    ${paymentUrl ? `<p>You can complete payment here: <a href="${paymentUrl}">${paymentUrl}</a></p>` : ""}
    <p>Thanks,<br/>D-Daily Team</p>
  `;

  try {
    await client.emails.send({
      from: fromEmail,
      to,
      subject: `Order received — ${order.orderNumber}`,
      html,
    });
  } catch (err) {
    console.error("Failed to send order confirmation email:", err);
  }
}

export async function sendResellerStatusEmail(to: string, reseller: any) {
  if (!client) {
    console.warn("Resend client not configured; skipping reseller status email");
    return;
  }

  const html = `
    <p>Hi ${reseller.full_name || "Applicant"},</p>
    <p>Your reseller application status: <strong>${reseller.status}</strong></p>
    ${reseller.notes ? `<p>Notes: ${reseller.notes}</p>` : ""}
    <p>Thanks for applying — D-Daily Team</p>
  `;

  try {
    await client.emails.send({
      from: fromEmail,
      to,
      subject: `Reseller application ${reseller.status}`,
      html,
    });
  } catch (err) {
    console.error("Failed to send reseller status email:", err);
  }
}
