import { Queue, JobScheduler } from "bullmq";

// BullMQ requires native Redis protocol, Upstash REST API doesn't support it.
// Instead, we use direct email sending with retry logic in email.ts
// This file is kept for future use if switching to native Redis provider

let emailQueue: Queue | null = null;
let emailQueueScheduler: JobScheduler | null = null;

// Queue is disabled for Upstash REST API. Emails are sent directly with retry logic.
export { emailQueue, emailQueueScheduler };
