import "dotenv/config";
import { Worker } from "bullmq";
import { redis } from "../lib/redis";
import { sendOrderConfirmation, sendResellerStatusEmail, sendAdminNotification } from "../utils/email";

if (!redis) {
  console.error("UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required to run the email worker.");
  process.exit(1);
}

const worker = new Worker(
  "email",
  async (job) => {
    switch (job.name) {
      case "order_confirmation":
        await sendOrderConfirmation(job.data.to, job.data.order, job.data.paymentUrl);
        break;
      case "reseller_status":
        await sendResellerStatusEmail(job.data.to, job.data.reseller);
        break;
      case "admin_notification":
        await sendAdminNotification(job.data.subject, job.data.contentHtml);
        break;
      default:
        throw new Error(`Unknown email job type: ${job.name}`);
    }
  },
  { connection: redis as any }
);

worker.on("completed", (job) => {
  console.log(`Email job completed: ${job.id} (${job.name})`);
});

worker.on("failed", (job, err) => {
  console.error(`Email job failed: ${job?.id} (${job?.name})`, err);
});

worker.on("error", (err) => {
  console.error("Email worker error:", err);
});

console.log("Email worker started.");
