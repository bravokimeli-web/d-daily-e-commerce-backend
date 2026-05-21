import { Queue, JobScheduler } from "bullmq";
import { redis } from "../lib/redis";

let emailQueue: Queue | null = null;
let emailQueueScheduler: JobScheduler | null = null;

try {
  if (redis) {
    // For Upstash REST API with BullMQ, we need the connection details
    // BullMQ requires a standard Redis connection, not REST API
    // If you have both REST and native protocol credentials, use native for BullMQ
    emailQueue = new Queue("email", { connection: redis as any });
    emailQueueScheduler = new JobScheduler("email", { connection: redis as any });
  }
} catch (error) {
  console.warn(
    "Failed to initialize email queue. Email jobs will be sent directly without queueing.",
    error
  );
}

export { emailQueue, emailQueueScheduler };
