import { Resend } from "resend";
import { renderOrderConfirmation, renderResellerStatus, renderAdminNotification, renderResellerApplicationReceived } from "./emailTemplates";

const apiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@ddaily.co.ke";
const adminEmails = (process.env.RESEND_ADMIN_EMAILS || "").split(",").map((s) => s.trim()).filter(Boolean);

let client: Resend | null = null;
if (apiKey) client = new Resend(apiKey);

async function sendWithRetry(opts: { from: string; to: string | string[]; subject: string; html?: string; text?: string }, attempts = 3) {
  if (!client) throw new Error("Resend not configured");
  let lastErr: any = null;
  for (let i = 0; i < attempts; i++) {
    try {
      return await client.emails.send(opts as any);
    } catch (err) {
      lastErr = err;
      const backoff = Math.pow(2, i) * 100; // ms
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
  throw lastErr;
}

export async function sendOrderConfirmation(to: string, order: any, paymentUrl?: string) {
  if (!client) {
    console.warn("Resend client not configured; skipping order confirmation email");
    return;
  }

  const html = renderOrderConfirmation(order, paymentUrl);
  try {
    await sendWithRetry({ from: fromEmail, to, subject: `Order received — ${order.orderNumber}`, html }, 3);
  } catch (err) {
    console.error("Failed to send order confirmation email:", err);
  }
}

export async function sendResellerApplicationReceivedEmail(to: string, reseller: any) {
  if (!client) {
    console.warn("Resend client not configured; skipping reseller application received email");
    return;
  }

  const html = renderResellerApplicationReceived(reseller);
  try {
    await sendWithRetry({ from: fromEmail, to, subject: "Reseller Application Received ✅", html }, 3);
  } catch (err) {
    console.error("Failed to send reseller application received email:", err);
  }
}

export async function sendResellerStatusEmail(to: string, reseller: any) {
  if (!client) {
    console.warn("Resend client not configured; skipping reseller status email");
    return;
  }
  const html = renderResellerStatus(reseller);
  try {
    await sendWithRetry({ from: fromEmail, to, subject: `Reseller Application ${reseller.status.charAt(0).toUpperCase() + reseller.status.slice(1)}`, html }, 3);
  } catch (err) {
    console.error("Failed to send reseller status email:", err);
  }
}

export async function sendAdminNotification(subject: string, contentHtml: string) {
  if (!client) {
    console.warn("Resend client not configured; skipping admin notification");
    return;
  }
  const to = adminEmails.length ? adminEmails : [];
  if (to.length === 0) {
    console.warn("No admin emails configured (RESEND_ADMIN_EMAILS)");
    return;
  }
  try {
    await sendWithRetry({ from: fromEmail, to, subject, html: contentHtml }, 3);
  } catch (err) {
    console.error("Failed to send admin notification email:", err);
  }
}
