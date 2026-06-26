import { emailQueue } from "../queues/emailQueue";
import {
  sendOrderConfirmation,
  sendOrderPaymentReminderEmail,
  sendOrderShippedNotificationEmail,
  sendOrderDeliveredNotificationEmail,
  sendResellerStatusEmail,
  sendAdminNotification,
  sendResellerApplicationReceivedEmail,
} from "./email";

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

export async function queueOrderPaymentReminderEmail(to: string, order: any, paymentUrl?: string) {
  if (emailQueue) {
    await emailQueue.add(
      "order_payment_reminder",
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

  await sendOrderPaymentReminderEmail(to, order, paymentUrl);
}

export async function queueOrderShippedNotificationEmail(to: string, order: any) {
  if (emailQueue) {
    await emailQueue.add(
      "order_shipped_notification",
      { to, order },
      {
        attempts: 5,
        backoff: { type: "exponential", delay: 500 },
        removeOnComplete: true,
        removeOnFail: false,
      }
    );
    return;
  }

  await sendOrderShippedNotificationEmail(to, order);
}

export async function queueOrderDeliveredNotificationEmail(to: string, order: any) {
  if (emailQueue) {
    await emailQueue.add(
      "order_delivered_notification",
      { to, order },
      {
        attempts: 5,
        backoff: { type: "exponential", delay: 500 },
        removeOnComplete: true,
        removeOnFail: false,
      }
    );
    return;
  }

  await sendOrderDeliveredNotificationEmail(to, order);
}

export async function queueResellerApplicationReceivedEmail(to: string, reseller: any) {
  if (emailQueue) {
    await emailQueue.add(
      "reseller_received",
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

  await sendResellerApplicationReceivedEmail(to, reseller);
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
