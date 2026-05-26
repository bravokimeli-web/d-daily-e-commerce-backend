export function renderOrderConfirmation(order: any, paymentUrl?: string) {
  const items = (order.items || [])
    .map((it: any) => `<li>${escapeHtml(it.name)} &times; ${it.qty} — KES ${Number(it.price).toLocaleString()}</li>`)
    .join("\n");

  const status = order.status || "pending_payment";
  const statusMessages: Record<string, string> = {
    pending_payment: `We've received your order and it is currently <strong>pending payment</strong>. Complete payment now to confirm your purchase and begin the delivery process.`,`
    paid: `Payment has been received. Your order is now <strong>paid and waiting for shipping</strong>. We'll update you when it ships.`,
    processing: `Your order is paid and being prepared for shipping. We'll notify you once it has left the warehouse.`,
    shipped: `Your order has shipped and is on its way to your delivery location. We'll contact you once it arrives.`,
    delivered: `Your order has been delivered. We hope you enjoy it!`,
    cancelled: `This order has been cancelled. If you believe this is an error, please contact support.`,
    refunded: `This order has been refunded. If you have questions, please contact support.`,
  };

  const statusLabel: Record<string, string> = {
    pending_payment: "Payment pending",
    paid: "Paid, awaiting shipping",
    processing: "Processing",
    shipped: "Shipped",
    delivered: "Delivered",
    cancelled: "Cancelled",
    refunded: "Refunded",
  };

  const location = [order.customer?.address, order.customer?.city].filter(Boolean).join(", ") || "Not provided";
  const paymentButton = status === "pending_payment" && paymentUrl
    ? `<p><a href="${escapeHtml(paymentUrl)}" style="background: #ff6d00; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Complete Payment Now</a></p>`
    : "";

  return `
  <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px;">
    <h2>${statusLabel[status] || "Order update"}</h2>
    <p>Hi ${escapeHtml(order.customer?.name || "Customer")},</p>
    <p>${statusMessages[status] || "Here is an update for your order."}</p>
    <p><strong>Order Number:</strong> ${escapeHtml(order.orderNumber)}</p>
    <p><strong>Delivery location:</strong> ${escapeHtml(location)}</p>
    <h3>Order Details:</h3>
    <ul style="background: #f5f5f5; padding: 15px; border-radius: 5px;">
      ${items}
    </ul>
    <p style="background: #fff3cd; padding: 10px; border-left: 4px solid #ff6d00; margin: 15px 0;"><strong>Total Amount: KES ${Number(order.total).toLocaleString()}</strong></p>
    ${paymentButton}
    <p>Questions? Contact us anytime.</p>
    <p><strong>D-Daily Ltd Team</strong></p>
  </div>
  `;
}

export function renderOrderPaymentReminder(order: any, paymentUrl: string) {
  const items = (order.items || [])
    .map((it: any) => `<li>${escapeHtml(it.name)} &times; ${it.qty} — KES ${Number(it.price).toLocaleString()}</li>`)
    .join("\n");

  const location = [order.customer?.address, order.customer?.city].filter(Boolean).join(", ") || "Not provided";

  return `
  <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px;">
    <h2>Payment Reminder</h2>
    <p>Hi ${escapeHtml(order.customer?.name || "Customer")},</p>
    <p>We received your order but it is still <strong>pending payment</strong>. Please complete payment to confirm your order and let us ship it to you.</p>
    <p><strong>Order Number:</strong> ${escapeHtml(order.orderNumber)}</p>
    <p><strong>Delivery location:</strong> ${escapeHtml(location)}</p>
    <h3>Order Items:</h3>
    <ul style="background: #f5f5f5; padding: 15px; border-radius: 5px;">
      ${items}
    </ul>
    <p style="background: #fff3cd; padding: 10px; border-left: 4px solid #ff6d00; margin: 15px 0;"><strong>Total Amount: KES ${Number(order.total).toLocaleString()}</strong></p>
    <p><a href="${escapeHtml(paymentUrl)}" style="background: #ff6d00; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Complete Payment Now</a></p>
    <p>If you have questions or need help, reply to this email.</p>
    <p><strong>D-Daily Ltd Team</strong></p>
  </div>
  `;
}

export function renderOrderShippedNotification(order: any) {
  const items = (order.items || [])
    .map((it: any) => `<li>${escapeHtml(it.name)} &times; ${it.qty}</li>`)
    .join("\n");

  const location = [order.customer?.address, order.customer?.city].filter(Boolean).join(", ") || "Not provided";

  return `
  <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px;">
    <h2>Your order has shipped! 🚚</h2>
    <p>Hi ${escapeHtml(order.customer?.name || "Customer")},</p>
    <p>Your order is on its way and will be delivered to <strong>${escapeHtml(location)}</strong>. We will contact you as soon as it arrives.</p>
    <p><strong>Order Number:</strong> ${escapeHtml(order.orderNumber)}</p>
    <h3>Order Items:</h3>
    <ul style="background: #f5f5f5; padding: 15px; border-radius: 5px;">
      ${items}
    </ul>
    <p>If you have any questions before delivery, please reply to this email.</p>
    <p><strong>D-Daily Ltd Team</strong></p>
  </div>
  `;
}

export function renderOrderDeliveredNotification(order: any) {
  const items = (order.items || [])
    .map((it: any) => `<li>${escapeHtml(it.name)} &times; ${it.qty}</li>`)
    .join("\n");

  const location = [order.customer?.address, order.customer?.city].filter(Boolean).join(", ") || "Not provided";

  return `
  <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px;">
    <h2>Order Delivered ✅</h2>
    <p>Hi ${escapeHtml(order.customer?.name || "Customer")},</p>
    <p>Your order has been delivered to <strong>${escapeHtml(location)}</strong>. We hope everything arrived safely and in good condition.</p>
    <p><strong>Order Number:</strong> ${escapeHtml(order.orderNumber)}</p>
    <h3>Order Items:</h3>
    <ul style="background: #f5f5f5; padding: 15px; border-radius: 5px;">
      ${items}
    </ul>
    <p>We will contact you once the delivery is confirmed. If you need any help, reply to this email.</p>
    <p><strong>D-Daily Ltd Team</strong></p>
  </div>
  `;
}

export function renderResellerApplicationReceived(reseller: any) {
  return `
  <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px;">
    <h2>Application Received ✅</h2>
    <p>Hi ${escapeHtml(reseller.full_name || "Applicant")},</p>
    <p>Thank you for applying to become a reseller with D-Daily Ltd.</p>
    
    <p style="background: #e3f2fd; padding: 10px; border-left: 4px solid #1976d2; margin: 15px 0;">
      <strong>We have your application and our team is reviewing it now.</strong>
    </p>
    
    <h3>What happens next?</h3>
    <ul>
      <li>Our reseller team will review your application within 2-3 business days</li>
      <li>We'll verify your details and contact information</li>
      <li>You'll receive a status update by email once the review is complete</li>
    </ul>
    
    <p><strong>In the meantime:</strong></p>
    <p>You can track your application status anytime by visiting: <a href="https://d-daily-frontend.vercel.app/reseller.track">Check Application Status</a></p>
    
    <p>If you have any questions, please contact our support team.</p>
    <p><strong>D-Daily Ltd Team</strong></p>
  </div>
  `;
}

export function renderResellerStatus(reseller: any) {
  const statusMessages: { [key: string]: string } = {
    approved: "🎉 <strong>Congratulations! Your application has been approved!</strong><br/>You're now an official D-Daily Ltd reseller. Welcome to our team! We will contact you soon with the next steps.",
    rejected: "❌ <strong>Unfortunately, your application has been declined.</strong><br/>We appreciate your interest and encourage you to reapply in the future with updated information.",
    pending: "⏳ <strong>Your application is still being reviewed.</strong><br/>Our team is checking your details and will email you the outcome shortly.",
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
