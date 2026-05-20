import { emailQueue } from "../queues/emailQueue";
import { sendOrderConfirmation, sendResellerStatusEmail, sendAdminNotification } from "./email";

export async function queueOrderConfirmationEmail(to: string, order: any, paymentUrl?: string) {
  if (emailQueue) {
    await emailQueue.add(
      "order_confirmation",
      { to, order, paymentUrl },
      {
        attempts: 5,
        backoff: { type: "exponential", delay: 500 },
        removeOnComplete: true,
        removeOnFail: false,
      }
    );
    return;
  }

  await sendOrderConfirmation(to, order, paymentUrl);
}

export async function queueResellerStatusEmail(to: string, reseller: any) {
  if (emailQueue) {
    await emailQueue.add(
      "reseller_status",
      { to, reseller },
      {
        attempts: 5,
        backoff: { type: "exponential", delay: 500 },
        removeOnComplete: true,
        removeOnFail: false,
      }
    );
    return;
  }

  await sendResellerStatusEmail(to, reseller);
}

export async function queueAdminNotification(subject: string, contentHtml: string) {
  if (emailQueue) {
    await emailQueue.add(
      "admin_notification",
      { subject, contentHtml },
      {
        attempts: 5,
        backoff: { type: "exponential", delay: 500 },
        removeOnComplete: true,
        removeOnFail: false,
      }
    );
    return;
  }

  await sendAdminNotification(subject, contentHtml);
}
