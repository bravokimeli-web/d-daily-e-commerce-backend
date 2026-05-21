import "dotenv/config";
import { Worker } from "bullmq";
import { redis } from "../lib/redis";
import { sendOrderConfirmation, sendResellerStatusEmail, sendAdminNotification } from "../utils/email";

// DISABLED: BullMQ requires native Redis protocol, Upstash REST API doesn't support it.
// Email jobs are sent directly with retry logic instead.
// This file remains for future use if switching to native Redis provider

console.log(
  "Email worker is disabled. Emails are sent directly via Resend with retry logic."
);
process.exit(0);
