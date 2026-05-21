export function renderOrderConfirmation(order: any, paymentUrl?: string) {
  const items = (order.items || [])
    .map((it: any) => `<li>${escapeHtml(it.name)} &times; ${it.qty} — KES ${Number(it.price).toLocaleString()}</li>`)
    .join("\n");

  return `
  <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px;">
    <h2>Order Confirmed! 🎉</h2>
    <p>Hi ${escapeHtml(order.customer?.name || "Customer")},</p>
    <p>Thank you for your order! We're excited to process it for you.</p>
    <p><strong>Order Number:</strong> ${escapeHtml(order.orderNumber)}</p>
    
    <h3>Order Details:</h3>
    <ul style="background: #f5f5f5; padding: 15px; border-radius: 5px;">
      ${items}
    </ul>
    
    <p style="background: #fff3cd; padding: 10px; border-left: 4px solid #ff6d00; margin: 15px 0;">
      <strong>Total Amount: KES ${Number(order.total).toLocaleString()}</strong>
    </p>
    
    ${paymentUrl ? `<p><a href="${escapeHtml(paymentUrl)}" style="background: #ff6d00; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Complete Payment Now</a></p>` : ""}
    
    <p>We'll notify you as soon as your order ships.</p>
    <p>Questions? Contact us anytime!</p>
    <p><strong>D-Daily Ltd Team</strong></p>
  </div>
  `;
}

export function renderResellerApplicationReceived(reseller: any) {
  return `
  <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px;">
    <h2>Application Received ✅</h2>
    <p>Hi ${escapeHtml(reseller.full_name || "Applicant")},</p>
    <p>Thank you for submitting your reseller application to D-Daily Ltd!</p>
    
    <p style="background: #e3f2fd; padding: 10px; border-left: 4px solid #1976d2; margin: 15px 0;">
      <strong>We've received your application and it's being processed.</strong>
    </p>
    
    <h3>What happens next?</h3>
    <ul>
      <li>Our team will review your application within 2-3 business days</li>
      <li>We'll verify your documents and contact information</li>
      <li>You'll receive an email with the status update</li>
    </ul>
    
    <p><strong>In the meantime:</strong></p>
    <p>You can track your application status anytime by visiting: <a href="https://d-daily-frontend.vercel.app/reseller.track">Check Application Status</a></p>
    
    <p>Questions? Reach out to our support team!</p>
    <p><strong>D-Daily Ltd Team</strong></p>
  </div>
  `;
}

export function renderResellerStatus(reseller: any) {
  const statusMessages: { [key: string]: string } = {
    approved: "🎉 <strong>Congratulations! Your application has been approved!</strong><br/>You're now an official D-Daily Ltd reseller. Welcome to our team!",
    rejected: "❌ <strong>Unfortunately, your application has been declined.</strong><br/>We appreciate your interest and encourage you to reapply in the future with updated information.",
    pending: "⏳ <strong>Your application is still being reviewed.</strong><br/>We're processing your submission and will update you soon.",
  };

  const message = statusMessages[reseller.status] || `Your application status: <strong>${escapeHtml(reseller.status)}</strong>`;

  return `
  <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px;">
    <h2>Application Status Update</h2>
    <p>Hi ${escapeHtml(reseller.full_name || "Applicant")},</p>
    
    <p style="background: #f0f0f0; padding: 15px; border-radius: 5px; font-size: 16px;">
      ${message}
    </p>
    
    ${reseller.notes ? `<p><strong>Notes from our team:</strong><br/>${escapeHtml(reseller.notes)}</p>` : ""}
    
    ${reseller.status === "approved" ? `
      <p style="background: #c8e6c9; padding: 10px; border-left: 4px solid #4caf50; margin: 15px 0;">
        <strong>Next Steps:</strong> Log in to your reseller dashboard to start selling with D-Daily Ltd!
      </p>
    ` : ""}
    
    ${reseller.status === "rejected" ? `
      <p>If you have any questions about this decision, please don't hesitate to contact us.</p>
    ` : ""}
    
    <p>Thanks for your interest in partnering with us!</p>
    <p><strong>D-Daily Ltd Team</strong></p>
  </div>
  `;
}

export function renderAdminNotification(type: "order" | "reseller", payload: any) {
  if (type === "order") {
    return `
    <div style="font-family: Arial, sans-serif; color: #333;">
      <h2>📦 New Order Received</h2>
      <p><strong>Order Number:</strong> ${escapeHtml(payload.orderNumber)}</p>
      <p><strong>Customer:</strong> ${escapeHtml(payload.customer?.name || payload.customer?.phone || "Unknown")}</p>
      <p><strong>Email:</strong> ${escapeHtml(payload.customer?.email || "N/A")}</p>
      <p><strong>Total Amount:</strong> KES ${Number(payload.total).toLocaleString()}</p>
      <p><a href="${escapeHtml(payload.adminUrl || "")}" style="background: #ff6d00; color: white; padding: 10px 15px; text-decoration: none; border-radius: 5px; display: inline-block;">View Order in Admin</a></p>
    </div>
    `;
  }
  return `
  <div style="font-family: Arial, sans-serif; color: #333;">
    <h2>👤 New Reseller Application</h2>
    <p><strong>Applicant Name:</strong> ${escapeHtml(payload.full_name)}</p>
    <p><strong>Email:</strong> ${escapeHtml(payload.email)}</p>
    <p><strong>Phone:</strong> ${escapeHtml(payload.phone || "N/A")}</p>
    <p><a href="${escapeHtml(payload.adminUrl || "")}" style="background: #1976d2; color: white; padding: 10px 15px; text-decoration: none; border-radius: 5px; display: inline-block;">Review Application in Admin</a></p>
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
