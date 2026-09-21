import IORedis from "ioredis";

export function createRedisConnection(): IORedis {
  const url = process.env.REDIS_URL ?? "redis://localhost:6379";
  // BullMQ requires this exact setting on the ioredis connection it's given.
  return new IORedis(url, { maxRetriesPerRequest: null });
}
