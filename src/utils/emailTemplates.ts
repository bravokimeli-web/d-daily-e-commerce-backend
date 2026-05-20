export function renderOrderConfirmation(order: any, paymentUrl?: string) {
  const items = (order.items || [])
    .map((it: any) => `<li>${escapeHtml(it.name)} &times; ${it.qty} — KES ${Number(it.price).toLocaleString()}</li>`)
    .join("\n");

  return `
  <div>
    <p>Hi ${escapeHtml(order.customer?.name || "Customer")},</p>
    <p>Thanks for your order <strong>${escapeHtml(order.orderNumber)}</strong>.</p>
    <p>Summary:</p>
    <ul>
      ${items}
    </ul>
    <p><strong>Total:</strong> KES ${Number(order.total).toLocaleString()}</p>
    ${paymentUrl ? `<p>Complete payment: <a href="${escapeHtml(paymentUrl)}">Pay now</a></p>` : ""}
    <p>Thanks,<br/>D-Daily Team</p>
  </div>
  `;
}

export function renderResellerStatus(reseller: any) {
  return `
  <div>
    <p>Hi ${escapeHtml(reseller.full_name || "Applicant")},</p>
    <p>Your reseller application status: <strong>${escapeHtml(reseller.status)}</strong></p>
    ${reseller.notes ? `<p>Notes: ${escapeHtml(reseller.notes)}</p>` : ""}
    <p>Thanks,<br/>D-Daily Team</p>
  </div>
  `;
}

export function renderAdminNotification(type: "order" | "reseller", payload: any) {
  if (type === "order") {
    return `
    <div>
      <p>New order received: <strong>${escapeHtml(payload.orderNumber)}</strong></p>
      <p>Total: KES ${Number(payload.total).toLocaleString()}</p>
      <p>Customer: ${escapeHtml(payload.customer?.name || payload.customer?.phone || "Unknown")}</p>
      <p><a href="${escapeHtml(payload.adminUrl || "")}">View in admin</a></p>
    </div>
    `;
  }
  return `
  <div>
    <p>New reseller application: <strong>${escapeHtml(payload.full_name)}</strong></p>
    <p>Email: ${escapeHtml(payload.email)}</p>
    <p><a href="${escapeHtml(payload.adminUrl || "")}">View in admin</a></p>
  </div>
  `;
}

function escapeHtml(s: string) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
