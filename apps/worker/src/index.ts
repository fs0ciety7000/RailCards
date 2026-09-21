import { Queue, Worker, type Job } from "bullmq";
import { createRedisConnection } from "./redis";
import { expireStaleTrades } from "./jobs/expire-trades";

const QUEUE_NAME = "railcards-maintenance";
const EXPIRE_TRADES_JOB = "expire-trades";

async function main() {
  const connection = createRedisConnection();
  const queue = new Queue(QUEUE_NAME, { connection });

  // upsertJobScheduler is idempotent by scheduler id, so restarting the
  // worker never creates duplicate repeatable schedules.
  await queue.upsertJobScheduler(
    EXPIRE_TRADES_JOB,
    { every: 5 * 60_000 }, // every 5 minutes
    { name: EXPIRE_TRADES_JOB, opts: { removeOnComplete: 10, removeOnFail: 50 } },
  );

  const worker = new Worker(
    QUEUE_NAME,
    async (job: Job) => {
      switch (job.name) {
        case EXPIRE_TRADES_JOB: {
          const result = await expireStaleTrades();
          if (result.expiredCount > 0) {
            // eslint-disable-next-line no-console
            console.log(`[worker] expired ${result.expiredCount} stale trade(s)`);
          }
          return result;
        }
        default:
          throw new Error(`Unknown job: ${job.name}`);
      }
    },
    { connection },
  );

  worker.on("failed", (job, err) => {
     
    console.error(`[worker] job ${job?.name} failed:`, err);
  });

  // eslint-disable-next-line no-console
  console.log("[worker] RailCards worker started, listening for jobs on", QUEUE_NAME);

  const shutdown = async () => {
    await worker.close();
    await queue.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
   
  console.error("[worker] fatal error", err);
  process.exit(1);
});
