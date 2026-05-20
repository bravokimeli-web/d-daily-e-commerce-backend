import { Queue, JobScheduler } from "bullmq";
import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL;
const redisHost = process.env.REDIS_HOST;
const redisPort = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379;
const redisPassword = process.env.REDIS_PASSWORD;
const redisTls = process.env.REDIS_TLS === "true";

let emailQueue: Queue | null = null;
let emailQueueScheduler: JobScheduler | null = null;
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

if (connection) {
  emailQueue = new Queue("email", { connection });
  emailQueueScheduler = new JobScheduler("email", { connection });
}

export { emailQueue, emailQueueScheduler };
