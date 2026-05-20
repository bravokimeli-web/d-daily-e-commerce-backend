import "dotenv/config";
import { Worker } from "bullmq";
import Redis from "ioredis";
import { sendOrderConfirmation, sendResellerStatusEmail, sendAdminNotification } from "../utils/email";

const redisUrl = process.env.REDIS_URL;
const redisHost = process.env.REDIS_HOST;
const redisPort = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379;
const redisPassword = process.env.REDIS_PASSWORD;
const redisTls = process.env.REDIS_TLS === "true";

let connection: Redis | null = null;
if (redisUrl) {
  connection = new Redis(redisUrl);
} else if (redisHost) {
  connection = new Redis({
    host: redisHost,
    port: redisPort,
    password: redisPassword,
    tls: redisTls ? {} : undefined,
  });
}

if (!connection) {
  console.error("REDIS_URL or REDIS_HOST is required to run the email worker.");
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
  { connection }
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
